// 活跃用户追踪器
// 用于追踪用户的实时活跃状态（基于心跳和交互）

const activeUsers = new Map(); // userId -> lastActiveTime (timestamp)
const userSockets = new Map(); // userId -> Set(socketId)
const ACTIVE_THRESHOLD = 30 * 1000; // 30秒无心跳视为不活跃

/**
 * 更新用户活跃时间并记录Socket
 * @param {number} userId 
 * @param {string} socketId
 */
export function updateActiveUser(userId, socketId = null) {
  activeUsers.set(userId, Date.now());
  if (socketId) {
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socketId);
  }
}

/**
 * 移除用户的特定Socket，如果该用户没有活跃的Socket了，则返回true
 * @param {number} userId 
 * @param {string} socketId
 * @returns {boolean} 是否已经完全离线
 */
export function removeActiveSocket(userId, socketId) {
  if (userSockets.has(userId)) {
    const sockets = userSockets.get(userId);
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userId);
      activeUsers.delete(userId);
      return true;
    }
  } else {
    // 降级处理：如果没有记录Socket，则直接删除用户
    activeUsers.delete(userId);
    return true;
  }
  return false;
}

/**
 * 强制移除用户（所有Socket）
 * @param {number} userId 
 */
export function removeActiveUser(userId) {
  activeUsers.delete(userId);
  userSockets.delete(userId);
}

/**
 * 获取所有活跃用户ID列表
 * @returns {number[]}
 */
export function getActiveUserIds() {
  const now = Date.now();
  const activeIds = [];
  
  for (const [userId, lastActive] of activeUsers.entries()) {
    // 如果有活跃Socket，或者最后心跳在阈值内
    const hasSockets = userSockets.has(userId) && userSockets.get(userId).size > 0;
    if (hasSockets || (now - lastActive < ACTIVE_THRESHOLD)) {
      activeIds.push(userId);
    } else {
      // 懒惰删除
      activeUsers.delete(userId);
      userSockets.delete(userId);
    }
  }
  
  return activeIds;
}

/**
 * 检查用户是否活跃
 * @param {number} userId 
 * @returns {boolean}
 */
export function isUserActive(userId) {
  const lastActive = activeUsers.get(userId);
  const hasSockets = userSockets.has(userId) && userSockets.get(userId).size > 0;
  
  if (hasSockets) return true;
  if (!lastActive) return false;
  
  const isActive = (Date.now() - lastActive) < ACTIVE_THRESHOLD;
  if (!isActive) {
    activeUsers.delete(userId);
    userSockets.delete(userId);
  }
  return isActive;
}
