import { query, transaction } from '../database/connection.js';

const POINTS_REWARDS = {
  DAILY_CHECKIN: 10,
  DAILY_CHECKIN_INCREMENT: 2,
  DAILY_CHECKIN_MAX: 25,
  POST_LIKED: 2,
  POST_COMMENTED: 5,
  BE_FOLLOWED: 20,
};

const POINTS_COSTS = {
  MATCH_QUEUE_JUMP: 2,         // 匹配插队
  PROMOTE_POST_PER_DAY: 100,   // 推广帖子（每天）
};

export async function addPoints(userId, amount, type = 'earn', description = '') {
  if (amount <= 0) return;

  try {
    await transaction(async (connection) => {
      await connection.query(
        `UPDATE users SET points = points + ? WHERE id = ?`,
        [amount, userId]
      );

      await connection.query(
        `INSERT INTO point_records (user_id, amount, type, description, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, amount, type, description]
      );
    });
  } catch (error) {
    console.error('addPoints error:', error);
    throw error;
  }
}

export async function deductPoints(userId, amount, description = '') {
  if (amount <= 0) return;

  try {
    await transaction(async (connection) => {
      const [users] = await connection.query(
        `SELECT points FROM users WHERE id = ?`,
        [userId]
      );

      if (!users || users.length === 0) {
        throw new Error('用户不存在');
      }

      if (users[0].points < amount) {
        throw new Error('积分不足');
      }

      await connection.query(
        `UPDATE users SET points = points - ? WHERE id = ?`,
        [amount, userId]
      );

      await connection.query(
        `INSERT INTO point_records (user_id, amount, type, description, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, -amount, 'spend', description]
      );
    });
  } catch (error) {
    console.error('deductPoints error:', error);
    throw error;
  }
}

export async function consumePoints(userId, amount, description = '') {
  return deductPoints(userId, amount, description);
}

export async function getUserPoints(userId) {
  const [result] = await query(
    `SELECT points FROM users WHERE id = ?`,
    [userId]
  );
  return result[0]?.points || 0;
}

export async function checkPoints(userId, amount) {
  const points = await getUserPoints(userId);
  return points >= amount;
}

export async function getPointsRecords(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [records] = await query(
    `SELECT id, amount, type, description, created_at
     FROM point_records
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, parseInt(limit), parseInt(offset)]
  );

  const [countResult] = await query(
    `SELECT COUNT(*) as total FROM point_records WHERE user_id = ?`,
    [userId]
  );

  return {
    records: Array.isArray(records) ? records : [],
    total: countResult[0]?.total || 0,
    page: parseInt(page),
    limit: parseInt(limit)
  };
}

export async function getPointsRanking(userId, limit = 20) {
  const [ranking] = await query(
    `SELECT u.id as user_id, u.username, u.nickname, u.points, u.avatar,
            CASE WHEN u.id = ? THEN 1 ELSE 0 END as is_current_user
     FROM users u
     WHERE u.status = 'active'
     ORDER BY u.points DESC, u.created_at ASC
     LIMIT ?`,
    [userId, parseInt(limit)]
  );

  return Array.isArray(ranking) ? ranking : [];
}

export { POINTS_REWARDS, POINTS_COSTS };
