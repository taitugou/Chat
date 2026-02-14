import { query } from '../database/connection.js';
import { getGame, deleteGame } from './gameRegistry.js';
import { updateGameRecord } from './gameService.js';

const DEFAULT_EMPTY_ROOM_TTL_HOURS = 24;
const DEFAULT_IDLE_ROOM_TTL_HOURS = 24;
const DEFAULT_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

let cleanupTimer = null;

function toMySqlDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function cleanupExpiredEmptyRooms({ emptyRoomTtlHours }) {
  const ttlHours = Number(emptyRoomTtlHours);
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) return;

  const threshold = toMySqlDateTime(Date.now() - ttlHours * 60 * 60 * 1000);
  const [expiredRooms] = await query(
    `SELECT id, room_code
     FROM game_rooms
     WHERE empty_at IS NOT NULL
       AND empty_at <= ?`,
    [threshold]
  );

  if (!expiredRooms || expiredRooms.length === 0) return;

  const roomIds = expiredRooms.map(r => r.id);
  const placeholders = roomIds.map(() => '?').join(',');

  await query(`DELETE FROM game_rooms WHERE id IN (${placeholders})`, roomIds);

  console.log(
    `[roomCleanup] 已清理空房间: ${expiredRooms.length} 个 (TTL=${ttlHours}h, 清理阈值: ${threshold})`
  );
}

async function cleanupIdleRooms({ idleRoomTtlHours }) {
  const ttlHours = Number(idleRoomTtlHours);
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) return;

  const threshold = toMySqlDateTime(Date.now() - ttlHours * 60 * 60 * 1000);
  const [expiredRooms] = await query(
    `SELECT id, room_code
     FROM game_rooms
     WHERE last_active_at IS NOT NULL
       AND last_active_at <= ?`,
    [threshold]
  );

  if (!expiredRooms || expiredRooms.length === 0) return;

  const roomIds = expiredRooms.map(r => r.id);
  const placeholders = roomIds.map(() => '?').join(',');

  await query(`DELETE FROM game_rooms WHERE id IN (${placeholders})`, roomIds);

  console.log(
    `[roomCleanup] 已清理闲置房间: ${expiredRooms.length} 个 (TTL=${ttlHours}h, 清理阈值: ${threshold})`
  );
}

async function fixZombieRooms() {
  try {
    const [playingRooms] = await query(
      `SELECT gr.id, gr.current_players,
              (SELECT COUNT(*) FROM game_room_players WHERE room_id = gr.id) as real_player_count
       FROM game_rooms gr
       WHERE gr.status = 'playing'`
    );

    if (!playingRooms || playingRooms.length === 0) return;

    for (const room of playingRooms) {
      const roomId = room.id;
      const realCount = room.real_player_count;
      
      if (realCount === 0) {
        console.log(`[roomCleanup] 发现僵尸房间 ${roomId} (0人但显示游戏中)，正在修复...`);
        
        const game = getGame(roomId);
        if (game) {
            try {
                await updateGameRecord(game.gameId, {
                  status: 'aborted',
                  totalPot: game.pot || 0,
                  gameData: (typeof game.getGameState === 'function') ? game.getGameState() : {}
                });
            } catch(e) {
                console.error(`[roomCleanup] 结束僵尸游戏记录失败:`, e);
            }
            deleteGame(roomId);
        }
        
        await query(
          `UPDATE game_rooms 
           SET status = 'waiting', current_players = 0, empty_at = NOW(), last_active_at = NOW() 
           WHERE id = ?`, 
          [roomId]
        );
      } 
      else if (!getGame(roomId)) {
         console.log(`[roomCleanup] 发现状态不一致房间 ${roomId} (数据库playing但内存无实例)，重置为waiting...`);
         await query(
          `UPDATE game_rooms SET status = 'waiting' WHERE id = ?`, 
          [roomId]
        );
      }
    }
  } catch (error) {
    console.error('[roomCleanup] 修复僵尸房间失败:', error);
  }
}

export function startRoomCleanupService(options = {}) {
  const emptyRoomTtlHours =
    options.emptyRoomTtlHours ?? DEFAULT_EMPTY_ROOM_TTL_HOURS;
  const idleRoomTtlHours =
    options.idleRoomTtlHours ?? DEFAULT_IDLE_ROOM_TTL_HOURS;
  const intervalMs = options.intervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;

  console.log(`[roomCleanup] 启动房间清理服务: 空房间TTL=${emptyRoomTtlHours}h, 闲置房间TTL=${idleRoomTtlHours}h, 间隔=${intervalMs/1000}s`);

  if (cleanupTimer) return;

  const tick = async () => {
    try {
      await fixZombieRooms();
      await cleanupExpiredEmptyRooms({ emptyRoomTtlHours });
      await cleanupIdleRooms({ idleRoomTtlHours });
    } catch (error) {
      console.error('[roomCleanup] 清理房间失败:', error);
    }
  };

  cleanupTimer = setInterval(tick, intervalMs);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

  tick();
}

export function stopRoomCleanupService() {
  if (!cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = null;
}
