import express from 'express';
import { query } from '../database/connection.js';
import { getActiveUserIds } from '../utils/activeTracker.js';

const router = express.Router();

// 获取在线人数
router.get('/count', async (req, res, next) => {
  try {
    const activeIds = getActiveUserIds();
    res.json({ count: activeIds.length });
  } catch (error) {
    next(error);
  }
});

// 获取在线用户列表
router.get('/list', async (req, res, next) => {
  try {
    const activeIds = getActiveUserIds();
    
    if (activeIds.length === 0) {
      return res.json({ users: [], count: 0 });
    }

    const placeholders = activeIds.map(() => '?').join(',');
    
    const [users] = await query(
      `SELECT id, username, nickname, avatar, online_status
       FROM users
       WHERE id IN (${placeholders})
       ORDER BY FIELD(online_status, 'online', 'busy', 'away'), last_login_at DESC`,
      activeIds
    );

    res.json({ users: users || [], count: users?.length || 0 });
  } catch (error) {
    next(error);
  }
});

export default router;
