import { query } from '../database/connection.js';
import { leaveRoom } from './roomService.js';
import { getGame, deleteGame } from './gameRegistry.js';
import { updateGameRecord } from './gameService.js';

const DEFAULT_INTERVAL_MS = 10 * 1000;
const DEFAULT_KICK_AFTER_MS = 20 * 1000;

let presenceTimer = null;
const offlineSinceByPlayer = new Map();

function normalizeUserId(value) {
  if (value === null || value === undefined) return null;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}

function playerKey(roomId, userId) {
  return `${roomId}:${userId}`;
}

async function reconcileRoom(io, roomId, { kickAfterMs }) {
  const roomName = `game_room:${roomId}`;
  const sockets = await io.in(roomName).fetchSockets();

  const connectedUserIds = Array.from(
    new Set(
      sockets
        .map((s) => normalizeUserId(s.data?.userId ?? s.userId))
        .filter((v) => v !== null)
    )
  );
  if (connectedUserIds.length > 0) {
    await query('UPDATE game_rooms SET last_active_at = NOW() WHERE id = ?', [roomId]);
  }

  const [rows] = await query(
    'SELECT user_id FROM game_room_players WHERE room_id = ?',
    [roomId]
  );
  const playerIds = (rows || [])
    .map((r) => normalizeUserId(r.user_id))
    .filter((v) => v !== null);

  const connectedSet = new Set(connectedUserIds.map((v) => String(v)));
  const now = Date.now();

  for (const userId of playerIds) {
    const key = playerKey(roomId, userId);
    const isConnected = connectedSet.has(String(userId));
    if (isConnected) {
      offlineSinceByPlayer.delete(key);
      continue;
    }

    const firstSeen = offlineSinceByPlayer.get(key) ?? now;
    offlineSinceByPlayer.set(key, firstSeen);

    if (now - firstSeen >= kickAfterMs) {
      offlineSinceByPlayer.delete(key);
      try {
        const result = await leaveRoom(userId, roomId);
        
        // Check if everyone left and clean up game
        if (result && result.remainingCount === 0) {
           const game = getGame(roomId);
           if (game) {
             console.log(`[Presence] Room ${roomId} empty after kick. Aborting game ${game.gameId}`);
             try {
               await updateGameRecord(game.gameId, {
                 status: 'aborted',
                 totalPot: game.pot || 0,
                 gameData: (typeof game.getGameState === 'function') ? game.getGameState() : {}
               });
               deleteGame(roomId);
             } catch (e) {
               console.error('[Presence] Failed to abort game:', e);
             }
           }
        }

        io.to(roomName).emit('game:player_left', { userId, roomId: Number(roomId) });
        if (result?.newCreatorId) {
          io.to(roomName).emit('game:owner_changed', {
            newOwnerId: result.newCreatorId,
            roomId: Number(roomId),
          });
        }
      } catch (error) {
        if ((error?.message || '') !== '不在房间中') {
          console.error(`[gameRoomPresence] auto leave failed room=${roomId} user=${userId}:`, error);
        }
      }
    }
  }

  if (connectedUserIds.length === 0) {
    await query('UPDATE game_room_players SET is_online = FALSE WHERE room_id = ?', [
      roomId,
    ]);
    return;
  }

  const placeholders = connectedUserIds.map(() => '?').join(',');
  await query('UPDATE game_room_players SET is_online = FALSE WHERE room_id = ?', [
    roomId,
  ]);
  await query(
    `UPDATE game_room_players SET is_online = TRUE WHERE room_id = ? AND user_id IN (${placeholders})`,
    [roomId, ...connectedUserIds]
  );
}

async function reconcileAllRooms(io, { kickAfterMs }) {
  const [rows] = await query('SELECT DISTINCT room_id FROM game_room_players', []);
  if (!rows || rows.length === 0) return;

  for (const r of rows) {
    const roomId = r.room_id;
    if (roomId === null || roomId === undefined) continue;
    try {
      await reconcileRoom(io, roomId, { kickAfterMs });
    } catch (error) {
      console.error(`[gameRoomPresence] reconcile room ${roomId} failed:`, error);
    }
  }
}

export async function resetAllRoomPresence() {
  await query('UPDATE game_room_players SET is_online = FALSE', []);
}

export function startGameRoomPresenceService(io, options = {}) {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const kickAfterMs = options.kickAfterMs ?? DEFAULT_KICK_AFTER_MS;
  if (presenceTimer) return;

  const tick = async () => {
    try {
      await reconcileAllRooms(io, { kickAfterMs });
    } catch (error) {
      console.error('[gameRoomPresence] reconcile failed:', error);
    }
  };

  presenceTimer = setInterval(tick, intervalMs);
  if (typeof presenceTimer.unref === 'function') presenceTimer.unref();

  tick();
}

export function stopGameRoomPresenceService() {
  if (!presenceTimer) return;
  clearInterval(presenceTimer);
  presenceTimer = null;
}
