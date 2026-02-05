import { query } from '../database/connection.js';

const DEFAULT_EMPTY_ROOM_TTL_HOURS = 6;
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
    `[roomCleanup] 已清理空房间: ${expiredRooms.length} 个 (TTL=${ttlHours}h)`
  );
}

export function startRoomCleanupService(options = {}) {
  const emptyRoomTtlHours =
    options.emptyRoomTtlHours ?? DEFAULT_EMPTY_ROOM_TTL_HOURS;
  const intervalMs = options.intervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;

  if (cleanupTimer) return;

  const tick = async () => {
    try {
      await cleanupExpiredEmptyRooms({ emptyRoomTtlHours });
    } catch (error) {
      console.error('[roomCleanup] 清理空房间失败:', error);
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
