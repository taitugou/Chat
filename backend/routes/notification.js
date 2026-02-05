import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type, unreadOnly = false, includeDeleted = false } = req.query;

    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;
    const canIncludeDeleted = req.user?.isAdmin && includeDeleted === 'true';
    
    let whereClause = 'WHERE n.user_id = ?';
    const params = [userId];
    
    if (type) {
      whereClause += ' AND n.type = ?';
      params.push(type);
    }
    
    if (unreadOnly === 'true') {
      whereClause += ' AND n.is_read = FALSE';
    }

    if (!canIncludeDeleted) {
      whereClause += ' AND n.is_deleted = FALSE';
    }
    
    const [notifications] = await query(
      `SELECT n.*, 
              u.username as sender_username, 
              u.nickname as sender_nickname, 
              u.avatar as sender_avatar
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNumber, offset]
    );
    
    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
      params
    );
    
    const [unreadCount] = await query(
      `SELECT COUNT(*) as count 
       FROM notifications 
       WHERE user_id = ? AND is_read = FALSE AND is_deleted = FALSE`,
      [userId]
    );
    
    res.json({
      notifications: notifications || [],
      total: countResult[0]?.total || 0,
      unreadCount: unreadCount[0]?.count || 0,
      page: pageNumber,
      limit: limitNumber
    });
  } catch (error) {
    next(error);
  }
});

router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [result] = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'message' THEN 1 ELSE 0 END) as message_count,
        SUM(CASE WHEN type = 'profile_message' THEN 1 ELSE 0 END) as profile_message_count,
        SUM(CASE WHEN type = 'mention' THEN 1 ELSE 0 END) as mention_count,
        SUM(CASE WHEN type = 'comment' THEN 1 ELSE 0 END) as comment_count,
        SUM(CASE WHEN type = 'like' THEN 1 ELSE 0 END) as like_count,
        SUM(CASE WHEN type = 'follow' THEN 1 ELSE 0 END) as follow_count,
        SUM(CASE WHEN type = 'system' THEN 1 ELSE 0 END) as system_count
       FROM notifications 
       WHERE user_id = ? AND is_read = FALSE AND is_deleted = FALSE`,
      [userId]
    );
    
    res.json({
      total: result[0]?.total || 0,
      messageCount: result[0]?.message_count || 0,
      profileMessageCount: result[0]?.profile_message_count || 0,
      mentionCount: result[0]?.mention_count || 0,
      commentCount: result[0]?.comment_count || 0,
      likeCount: result[0]?.like_count || 0,
      followCount: result[0]?.follow_count || 0,
      systemCount: result[0]?.system_count || 0
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:notificationId/read', authenticate, async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;
    
    const [notification] = await query(
      `SELECT * FROM notifications WHERE id = ? AND user_id = ? AND is_deleted = FALSE`,
      [notificationId, userId]
    );
    
    if (!notification || notification.length === 0) {
      return res.status(404).json({ error: '通知不存在' });
    }
    
    await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW() 
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
    
    res.json({ message: '标记成功' });
  } catch (error) {
    next(error);
  }
});

router.put('/mark-all-read', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW() 
       WHERE user_id = ? AND is_read = FALSE AND is_deleted = FALSE`,
      [userId]
    );
    
    res.json({ message: '全部标记成功' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:notificationId', authenticate, async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;
    
    const [notification] = await query(
      `SELECT * FROM notifications WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
    
    if (!notification || notification.length === 0) {
      return res.status(404).json({ error: '通知不存在' });
    }

    await query(
      `UPDATE notifications 
       SET is_deleted = TRUE, deleted_at = NOW() 
       WHERE id = ? AND user_id = ? AND is_deleted = FALSE`,
      [notificationId, userId]
    );
    
    res.json({ message: '删除成功' });
  } catch (error) {
    next(error);
  }
});

router.delete('/clear-all', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    await query(
      `UPDATE notifications 
       SET is_deleted = TRUE, deleted_at = NOW() 
       WHERE user_id = ? AND is_deleted = FALSE`,
      [userId]
    );
    
    res.json({ message: '清空成功' });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [result] = await query(
      `SELECT 
        type,
        COUNT(*) as count,
        SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread_count
       FROM notifications 
       WHERE user_id = ? AND is_deleted = FALSE
       GROUP BY type`,
      [userId]
    );
    
    const stats = {
      message: { count: 0, unread: 0 },
      comment: { count: 0, unread: 0 },
      like: { count: 0, unread: 0 },
      follow: { count: 0, unread: 0 },
      mention: { count: 0, unread: 0 },
      system: { count: 0, unread: 0 },
      profile_message: { count: 0, unread: 0 }
    };
    
    for (const row of result) {
      if (stats[row.type]) {
        stats[row.type].count = row.count;
        stats[row.type].unread = row.unread_count;
      }
    }
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
