import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { filterSensitiveWords } from '../utils/sensitiveWords.js';
import { processMentions, cleanupMentions } from '../utils/mentionHelper.js';

const router = express.Router();

router.get('/:profileUserId', authenticate, async (req, res, next) => {
  try {
    const { profileUserId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user.id;
    
    const offset = (page - 1) * limit;
    
    const [messages] = await query(
      `SELECT um.*, 
              u.username as sender_username, 
              u.nickname as sender_nickname, 
              u.avatar as sender_avatar,
              (SELECT COUNT(*) FROM user_message_likes WHERE message_id = um.id) as like_count,
              (SELECT COUNT(*) FROM user_messages WHERE parent_id = um.id AND is_deleted = FALSE) as reply_count,
              (SELECT COUNT(*) FROM user_message_likes WHERE message_id = um.id AND user_id = ?) as is_liked,
              (SELECT sender_id FROM user_messages WHERE id = um.parent_id) as parent_sender_id
       FROM user_messages um
       LEFT JOIN users u ON um.sender_id = u.id
       WHERE um.profile_user_id = ? AND um.parent_id IS NULL AND um.is_deleted = FALSE
       ORDER BY um.created_at DESC
       LIMIT ? OFFSET ?`,
      [currentUserId, profileUserId, parseInt(limit), offset]
    );
    
    const [countResult] = await query(
      `SELECT COUNT(*) as total 
       FROM user_messages 
       WHERE profile_user_id = ? AND parent_id IS NULL AND is_deleted = FALSE`,
      [profileUserId]
    );
    
    for (const message of messages) {
      const [replies] = await query(
        `SELECT um.*, 
                u.username as sender_username, 
                u.nickname as sender_nickname, 
                u.avatar as sender_avatar,
                (SELECT COUNT(*) FROM user_message_likes WHERE message_id = um.id) as like_count,
                (SELECT COUNT(*) FROM user_message_likes WHERE message_id = um.id AND user_id = ?) as is_liked,
                (SELECT sender_id FROM user_messages WHERE id = um.parent_id) as parent_sender_id
         FROM user_messages um
         LEFT JOIN users u ON um.sender_id = u.id
         WHERE um.parent_id = ? AND um.is_deleted = FALSE
         ORDER BY um.created_at ASC`,
        [currentUserId, message.id]
      );
      
      message.replies = replies || [];
    }
    
    res.json({
      messages: messages || [],
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:profileUserId', authenticate, async (req, res, next) => {
  try {
    const { profileUserId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user.id;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '留言内容不能为空' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ error: '留言内容不能超过1000字' });
    }
    
    const filteredContent = filterSensitiveWords(content);
    
    if (parentId) {
      const [parentMessage] = await query(
        `SELECT * FROM user_messages WHERE id = ? AND is_deleted = FALSE`,
        [parentId]
      );
      
      if (!parentMessage || parentMessage.length === 0) {
        return res.status(404).json({ error: '父留言不存在' });
      }
      
      if (parentMessage[0].profile_user_id !== parseInt(profileUserId)) {
        return res.status(400).json({ error: '回复的留言不属于该用户' });
      }
    }
    
    const [result] = await query(
      `INSERT INTO user_messages (profile_user_id, sender_id, parent_id, content, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [profileUserId, userId, parentId || null, filteredContent]
    );

    // 处理提及
    await processMentions({
      content: filteredContent,
      messageId: result.insertId,
      userId
    });
    
    if (parentId) {
      await query(
        `UPDATE user_messages SET reply_count = reply_count + 1 WHERE id = ?`,
        [parentId]
      );
    }
    
    if (parseInt(profileUserId) !== userId) {
      const [sender] = await query(
        `SELECT username, nickname, avatar FROM users WHERE id = ?`,
        [userId]
      );
      
      await query(
        `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type, is_read)
         VALUES (?, 'profile_message', ?, ?, ?, ?, ?, ?, ?, FALSE)`,
        [
          profileUserId,
          '有人给你留言了',
          `${sender[0]?.nickname || sender[0]?.username} 给你留言了`,
          userId,
          sender[0]?.avatar,
          sender[0]?.nickname || sender[0]?.username,
          result.insertId,
          'user_message'
        ]
      );
    }
    
    res.status(201).json({
      message: '留言成功',
      messageId: result.insertId
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:messageId', authenticate, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    const [message] = await query(
      `SELECT um.*, pm.sender_id as parent_sender_id 
       FROM user_messages um
       LEFT JOIN user_messages pm ON um.parent_id = pm.id
       WHERE um.id = ? AND um.is_deleted = FALSE`,
      [messageId]
    );
    
    if (!message || message.length === 0) {
      return res.status(404).json({ error: '留言不存在' });
    }
    
    const msg = message[0];
    
    // 发送者、被发送者（空间主人）、父留言发送者（如果是回复）都可以删除
    if (msg.sender_id !== userId && 
        msg.profile_user_id !== userId && 
        msg.parent_sender_id !== userId) {
      return res.status(403).json({ error: '无权删除此留言' });
    }
    
    // 如果是主留言删除（或者是空间主人删回复），删除所有相关子回复
    if (!msg.parent_id || msg.profile_user_id === userId) {
      // 获取子留言ID以便清理提及
      const [replies] = await query(`SELECT id FROM user_messages WHERE parent_id = ?`, [messageId]);
      const replyIds = replies.map(r => r.id);
      
      await query(
        `UPDATE user_messages SET is_deleted = TRUE WHERE id = ? OR parent_id = ?`,
        [messageId, messageId]
      );

      // 清理提及
      await cleanupMentions({ messageId });
      if (replyIds.length > 0) {
        await cleanupMentions({ messageId: replyIds });
      }
    } else {
      await query(
        `UPDATE user_messages SET is_deleted = TRUE WHERE id = ?`,
        [messageId]
      );
      
      // 清理提及
      await cleanupMentions({ messageId });
    }
    
    if (msg.parent_id) {
      await query(
        `UPDATE user_messages SET reply_count = reply_count - 1 WHERE id = ?`,
        [msg.parent_id]
      );
    }
    
    res.json({ message: '删除成功' });
  } catch (error) {
    next(error);
  }
});

router.post('/:messageId/like', authenticate, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    const [existing] = await query(
      `SELECT * FROM user_message_likes WHERE message_id = ? AND user_id = ?`,
      [messageId, userId]
    );
    
    if (existing && existing.length > 0) {
      await query(
        `DELETE FROM user_message_likes WHERE message_id = ? AND user_id = ?`,
        [messageId, userId]
      );
      
      await query(
        `UPDATE user_messages SET like_count = like_count - 1 WHERE id = ?`,
        [messageId]
      );
      
      return res.json({ message: '取消点赞成功', liked: false });
    } else {
      await query(
        `INSERT INTO user_message_likes (message_id, user_id, created_at) VALUES (?, ?, NOW())`,
        [messageId, userId]
      );
      
      await query(
        `UPDATE user_messages SET like_count = like_count + 1 WHERE id = ?`,
        [messageId]
      );
      
      const [message] = await query(
        `SELECT sender_id, profile_user_id FROM user_messages WHERE id = ?`,
        [messageId]
      );
      
      if (message && message.length > 0) {
        const msg = message[0];
        const targetUserId = msg.sender_id;
        
        if (targetUserId !== userId) {
          const [liker] = await query(
            `SELECT username, nickname, avatar FROM users WHERE id = ?`,
            [userId]
          );
          
          await query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type, is_read)
             VALUES (?, 'like', ?, ?, ?, ?, ?, ?, ?, FALSE)`,
            [
              targetUserId,
              '有人赞了你的留言',
              `${liker[0]?.nickname || liker[0]?.username} 赞了你的留言`,
              userId,
              liker[0]?.avatar,
              liker[0]?.nickname || liker[0]?.username,
              messageId,
              'user_message'
            ]
          );
        }
      }
      
      return res.json({ message: '点赞成功', liked: true });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/:messageId/replies', authenticate, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user.id;
    
    const offset = (page - 1) * limit;
    
    const [replies] = await query(
      `SELECT um.*, 
              u.username as sender_username, 
              u.nickname as sender_nickname, 
              u.avatar as sender_avatar,
              (SELECT COUNT(*) FROM user_message_likes WHERE message_id = um.id) as like_count,
              (SELECT COUNT(*) FROM user_message_likes WHERE message_id = um.id AND user_id = ?) as is_liked,
              (SELECT sender_id FROM user_messages WHERE id = um.parent_id) as parent_sender_id
       FROM user_messages um
       LEFT JOIN users u ON um.sender_id = u.id
       WHERE um.parent_id = ? AND um.is_deleted = FALSE
       ORDER BY um.created_at ASC
       LIMIT ? OFFSET ?`,
      [currentUserId, messageId, parseInt(limit), offset]
    );
    
    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM user_messages WHERE parent_id = ? AND is_deleted = FALSE`,
      [messageId]
    );
    
    res.json({
      replies: replies || [],
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
