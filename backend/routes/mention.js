import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { filterSensitiveWords } from '../utils/sensitiveWords.js';
import { processMentions } from '../utils/mentionHelper.js';

const router = express.Router();

router.get('/search-users', authenticate, async (req, res, next) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword || keyword.trim().length === 0) {
      return res.json({ users: [] });
    }
    
    const [users] = await query(
      `SELECT u.id, u.username, u.nickname, u.avatar,
       (CASE 
         WHEN f1.id IS NOT NULL AND f2.id IS NOT NULL THEN 1
         WHEN f1.id IS NOT NULL THEN 2
         WHEN f2.id IS NOT NULL THEN 3
         ELSE 4
       END) as priority
       FROM users u
       LEFT JOIN user_follows f1 ON f1.follower_id = ? AND f1.following_id = u.id
       LEFT JOIN user_follows f2 ON f2.follower_id = u.id AND f2.following_id = ?
       WHERE (u.username LIKE ? OR u.nickname LIKE ?)
       ORDER BY priority ASC, u.username ASC
       LIMIT 10`,
      [req.user.id, req.user.id, `%${keyword}%`, `%${keyword}%`]
    );
    
    res.json({ users: users || [] });
  } catch (error) {
    next(error);
  }
});

router.post('/create', authenticate, async (req, res, next) => {
  try {
    const { content, postId, topicId, commentId } = req.body;
    const userId = req.user.id;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '内容不能为空' });
    }
    
    const filteredContent = filterSensitiveWords(content);
    const mentionedUserIds = await processMentions({
      content: filteredContent,
      postId,
      topicId,
      commentId,
      userId
    });
    
    res.json({ 
      success: true, 
      mentions: mentionedUserIds || []
    });
  } catch (error) {
    next(error);
  }
});

router.get('/my-mentions', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE m.mentioned_user_id = ?';
    const params = [userId];
    
    if (unreadOnly === 'true') {
      whereClause += ' AND m.is_read = FALSE';
    }
    
    const [mentions] = await query(
      `SELECT m.*, 
              u.username as mentioner_username, 
              u.nickname as mentioner_nickname, 
              u.avatar as mentioner_avatar,
              p.content as post_content,
              t.title as topic_title,
              c.content as comment_content
       FROM mentions m
       LEFT JOIN users u ON m.mentioner_id = u.id
       LEFT JOIN posts p ON m.post_id = p.id
       LEFT JOIN topics t ON m.topic_id = t.id
       LEFT JOIN post_comments c ON m.comment_id = c.id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    
    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM mentions m ${whereClause}`,
      params
    );
    
    res.json({
      mentions: mentions || [],
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/mark-read', authenticate, async (req, res, next) => {
  try {
    const { mentionIds } = req.body;
    const userId = req.user.id;
    
    if (!mentionIds || !Array.isArray(mentionIds)) {
      return res.status(400).json({ error: '无效的提及ID列表' });
    }
    
    const placeholders = mentionIds.map(() => '?').join(',');
    
    await query(
      `UPDATE mentions 
       SET is_read = TRUE 
       WHERE id IN (${placeholders}) AND mentioned_user_id = ?`,
      [...mentionIds, userId]
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
      `UPDATE mentions SET is_read = TRUE WHERE mentioned_user_id = ?`,
      [userId]
    );
    
    res.json({ message: '全部标记成功' });
  } catch (error) {
    next(error);
  }
});

router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [result] = await query(
      `SELECT COUNT(*) as count FROM mentions WHERE mentioned_user_id = ? AND is_read = FALSE`,
      [userId]
    );
    
    res.json({ count: result[0]?.count || 0 });
  } catch (error) {
    next(error);
  }
});

export default router;
