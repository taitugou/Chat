import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { filterSensitiveWords } from '../utils/sensitiveWords.js';
import { checkPermission } from '../middleware/permission.js';
import { processMentions, cleanupMentions } from '../utils/mentionHelper.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import {
  initChunkedUploadSession,
  getChunkedUploadMeta,
  listReceivedChunks,
  writeChunk,
  finalizeChunkedUpload
} from '../services/chunkedUploadService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    let uploadDir;
    // 优先从 req.body 获取，如果为空则尝试从 file.mimetype 判断
    let messageType = req.body.messageType;
    
    if (!messageType) {
      if (file.mimetype.startsWith('image/')) messageType = 'image';
      else if (file.mimetype.startsWith('video/')) messageType = 'video';
      else if (file.mimetype.startsWith('audio/')) messageType = 'audio';
      else messageType = 'file';
    }
    
    // 根据文件类型选择存储目录
    if (messageType === 'image') {
      uploadDir = path.join(__dirname, '../uploads/images');
    } else if (messageType === 'video') {
      uploadDir = path.join(__dirname, '../uploads/videos');
    } else if (messageType === 'audio') {
      uploadDir = path.join(__dirname, '../uploads/audio');
    } else {
      uploadDir = path.join(__dirname, '../uploads/files');
    }
    
    // 确保目录存在
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const rawHash = (req.body.fileHash || '').toString().trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(rawHash)) {
      cb(null, `${rawHash}${ext.toLowerCase()}`);
      return;
    }
    cb(null, `${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

router.post('/send-file-chunked/init', authenticate, async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const {
      receiverId,
      messageType = 'file',
      fileName,
      fileSize,
      mimeType,
      totalChunks,
      chunkSize,
      fileHash,
      isSnapchat = false,
      snapchatDuration = 0
    } = req.body || {};

    if (!receiverId) {
      return res.status(400).json({ error: '请提供接收者ID' });
    }

    const [blacklist] = await query(
      'SELECT id FROM user_blacklist WHERE blocker_id = ? AND blocked_id = ?',
      [receiverId, senderId]
    );
    if (blacklist && blacklist.length > 0) {
      return res.status(403).json({ error: '你已被对方加入黑名单' });
    }

    const isSnapchatBool = isSnapchat === 'true' || isSnapchat === true || isSnapchat === 1;
    if (isSnapchatBool) {
      if (parseInt(snapchatDuration) > 30) {
        return res.status(400).json({
          error: '阅后即焚时长不能超过30秒',
          maxDuration: 30,
        });
      }
    }

    const meta = await initChunkedUploadSession({
      senderId,
      receiverId: Number(receiverId),
      messageType,
      fileName,
      fileSize,
      mimeType,
      totalChunks,
      chunkSize,
      fileHash,
      isSnapchat: isSnapchatBool,
      snapchatDuration
    });

    res.status(201).json({ uploadId: meta.uploadId, meta });
  } catch (error) {
    next(error);
  }
});

router.get('/send-file-chunked/:uploadId/status', authenticate, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const meta = await getChunkedUploadMeta(uploadId);
    if (meta.senderId !== req.user.id) return res.status(403).json({ error: '无权限' });
    const received = await listReceivedChunks(uploadId);
    res.json({ uploadId, received, totalChunks: meta.totalChunks });
  } catch (error) {
    next(error);
  }
});

router.put(
  '/send-file-chunked/:uploadId/chunk',
  authenticate,
  express.raw({ type: 'application/octet-stream', limit: '12mb' }),
  async (req, res, next) => {
    try {
      const { uploadId } = req.params;
      const meta = await getChunkedUploadMeta(uploadId);
      if (meta.senderId !== req.user.id) return res.status(403).json({ error: '无权限' });
      const index = Number(req.query.index);
      await writeChunk(uploadId, index, req.body);
      res.json({ ok: true, index });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/send-file-chunked/:uploadId/complete', authenticate, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const meta = await getChunkedUploadMeta(uploadId);
    if (meta.senderId !== req.user.id) return res.status(403).json({ error: '无权限' });

    const finalized = await finalizeChunkedUpload(uploadId);
    const conversationId = [finalized.senderId, finalized.receiverId].sort().join('_');

    const [result] = await query(
      `INSERT INTO messages (sender_id, receiver_id, conversation_id, message_type, content,
                             file_url, file_size, duration, is_snapchat, snapchat_duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        finalized.senderId,
        finalized.receiverId,
        conversationId,
        finalized.messageType,
        finalized.fileName,
        finalized.fileUrl,
        finalized.fileSize,
        0,
        finalized.isSnapchat ? 1 : 0,
        finalized.snapchatDuration || 0
      ]
    );

    const [rows] = await query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    const message = rows?.[0];
    if (message && req.io) {
      req.io.to(`user:${finalized.receiverId}`).emit('message:receive', message);
      req.io.to(`user:${finalized.senderId}`).emit('message:receive', message);
    }

    res.status(201).json({
      message: '文件消息发送成功',
      messageId: result.insertId,
      data: message
    });
  } catch (error) {
    next(error);
  }
});

// 获取会话列表
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [conversations] = await query(
      `SELECT 
        CASE 
          WHEN sender_id = ? THEN receiver_id
          ELSE sender_id
        END as other_user_id,
        MAX(created_at) as last_message_time,
        (SELECT 
           CASE 
             WHEN is_burned = 1 AND ? = 0 THEN '[消息已焚毁]'
             WHEN is_snapchat = 1 AND is_read = 0 AND ? = 0 THEN '[阅后即焚消息]'
             ELSE content 
           END
         FROM messages 
         WHERE (sender_id = ? AND receiver_id = other_user_id) 
            OR (sender_id = other_user_id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages 
         WHERE receiver_id = ? AND sender_id = other_user_id AND is_read = 0) as unread_count
       FROM messages
       WHERE sender_id = ? OR receiver_id = ?
       GROUP BY other_user_id
       ORDER BY last_message_time DESC`,
      [userId, req.user.isAdmin ? 1 : 0, req.user.isAdmin ? 1 : 0, userId, userId, userId, userId, userId]
    );

    // 获取用户信息
    const conversationList = await Promise.all(
      conversations.map(async (conv) => {
        const [users] = await query(
          'SELECT id, username, nickname, avatar FROM users WHERE id = ?',
          [conv.other_user_id]
        );
        return {
          ...conv,
          user: users[0] || null,
        };
      })
    );

    res.json({ conversations: conversationList });
  } catch (error) {
    next(error);
  }
});

// 获取聊天记录
router.get('/messages/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user.id;
    const { page = 1, limit = 50, room_id: roomId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql, params;
    if (roomId) {
      // 如果指定了房间ID（临时聊天室），只获取该房间的消息
      sql = `SELECT m.*, 
                    sender.username as sender_username, sender.nickname as sender_nickname, sender.avatar as sender_avatar,
                    receiver.username as receiver_username, receiver.nickname as receiver_nickname, receiver.avatar as receiver_avatar
             FROM messages m
             JOIN users sender ON m.sender_id = sender.id
             JOIN users receiver ON m.receiver_id = receiver.id
             WHERE m.conversation_id = ?
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?`;
      params = [roomId, parseInt(limit), offset];
    } else {
      // 普通聊天记录
      sql = `SELECT m.*, 
                    sender.username as sender_username, sender.nickname as sender_nickname, sender.avatar as sender_avatar,
                    receiver.username as receiver_username, receiver.nickname as receiver_nickname, receiver.avatar as receiver_avatar
             FROM messages m
             JOIN users sender ON m.sender_id = sender.id
             JOIN users receiver ON m.receiver_id = receiver.id
             WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?`;
      params = [currentUserId, otherUserId, otherUserId, currentUserId, parseInt(limit), offset];
    }

    const [messages] = await query(sql, params);

    // 处理阅后即焚消息和权限
    const isAdmin = req.user.isAdmin;

    const processedMessages = messages.map(msg => {
      // 如果消息已焚毁且不是管理员，则屏蔽内容
      if (msg.is_burned && !isAdmin) {
        return {
          ...msg,
          content: '[消息已焚毁]',
          file_url: null,
          is_burned_visible: false,
          message_type: 'text' // 焚毁后统一作为文本处理，显示已焚毁提示
        };
      }
      return {
        ...msg,
        is_burned_visible: msg.is_burned && isAdmin
      };
    });

    // 标记普通消息为已读（阅后即焚消息由用户点击触发）
    if (roomId) {
      await query(
        'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ? AND is_snapchat = 0 AND is_read = 0',
        [roomId, currentUserId]
      );
    } else {
      await query(
        'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_snapchat = 0 AND is_read = 0',
        [currentUserId, otherUserId]
      );
    }

    res.json({ messages: processedMessages.reverse() });
  } catch (error) {
    next(error);
  }
});

// 获取群聊消息
router.get('/group-messages/:groupId', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 检查用户是否是群聊成员
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }

    const [messages] = await query(
      `SELECT m.*, 
              sender.username as sender_username, sender.nickname as sender_nickname, sender.avatar as sender_avatar
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       WHERE m.group_id = ?
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [groupId, parseInt(limit), offset]
    );

    // 处理阅后即焚消息和权限
    const isAdmin = req.user.isAdmin;

    const processedMessages = messages.map(msg => {
      // 如果是未读的阅后即焚消息且不是管理员
      if (msg.is_snapchat && !msg.is_read && !isAdmin) {
        return {
          ...msg,
          content: '[阅后即焚消息]',
          file_url: null,
          message_type: 'text' // 临时作为文本处理，直到点击查看
        };
      }

      if (msg.is_burned && !isAdmin) {
        return {
          ...msg,
          content: '[消息已焚毁]',
          file_url: null,
          is_burned_visible: false,
          message_type: 'text' // 焚毁后统一作为文本处理，显示已焚毁提示
        };
      }
      return {
        ...msg,
        is_burned_visible: msg.is_burned && isAdmin
      };
    });

    // 标记普通消息为已读（阅后即焚消息由用户点击触发）
    await query(
      'UPDATE messages SET is_read = 1 WHERE group_id = ? AND sender_id != ? AND is_snapchat = 0 AND is_read = 0',
      [groupId, currentUserId]
    );

    res.json({ messages: processedMessages.reverse() });
  } catch (error) {
    next(error);
  }
});

// 发送消息（通过Socket.IO，这里仅作为备用）
router.post('/send', authenticate, async (req, res, next) => {
  try {
    const { receiverId, groupId, content, messageType = 'text', isSnapchat = false, snapchatDuration = 0 } = req.body;
    const senderId = req.user.id;

    if ((!receiverId && !groupId) || !content) {
      return res.status(400).json({ error: '请提供接收者或群聊ID和消息内容' });
    }

    // 敏感词过滤
    const filteredContent = filterSensitiveWords(content);
    let finalContent = content;
    if (filteredContent !== content) {
      finalContent = filteredContent;
    }

    // 阅后即焚时长限制（统一30秒）
    if (isSnapchat && snapchatDuration > 30) {
      return res.status(400).json({ 
        error: '阅后即焚时长不能超过30秒',
        maxDuration: 30,
      });
    }

    let conversationId, queryParams;
    if (groupId) {
      // 群聊消息
      // 检查用户是否是群聊成员
      const [membership] = await query(
        `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, senderId]
      );

      if (!membership || membership.length === 0) {
        return res.status(403).json({ error: '你不是该群聊成员' });
      }

      conversationId = `group_${groupId}`;
      queryParams = [senderId, null, groupId, conversationId, messageType, finalContent, isSnapchat ? 1 : 0, snapchatDuration || 0];
    } else {
      // 私聊消息
      // 检查是否在黑名单中
      const [blacklist] = await query(
        'SELECT id FROM user_blacklist WHERE blocker_id = ? AND blocked_id = ?',
        [receiverId, senderId]
      );

      if (blacklist && blacklist.length > 0) {
        return res.status(403).json({ error: '你已被对方加入黑名单' });
      }

      conversationId = [senderId, receiverId].sort().join('_');
      queryParams = [senderId, receiverId, null, conversationId, messageType, finalContent, isSnapchat ? 1 : 0, snapchatDuration || 0];
    }

    const [result] = await query(
      `INSERT INTO messages (sender_id, receiver_id, group_id, conversation_id, message_type, content, 
                             is_snapchat, snapchat_duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      queryParams
    );

    // 处理提及
    if (messageType === 'text') {
      await processMentions({
        content: finalContent,
        chatMessageId: result.insertId,
        userId: senderId
      });
    }

    res.status(201).json({
      message: '消息发送成功',
      messageId: result.insertId,
    });
  } catch (error) {
    next(error);
  }
});

// 删除消息
router.delete('/messages/:messageId', authenticate, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // 检查消息所有权
    const [messages] = await query(
      'SELECT sender_id, receiver_id, group_id, is_snapchat FROM messages WHERE id = ?',
      [messageId]
    );

    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: '消息不存在' });
    }

    const message = messages[0];
    
    // 检查权限：
    // 1. 发送者可以删除自己的消息
    // 2. 阅后即焚消息的接收者（个人或群成员）在读完后可以触发“焚毁”
    let canDelete = message.sender_id === userId;
    
    if (!canDelete && message.is_snapchat) {
      if (message.group_id) {
        // 检查是否是群成员
        const [membership] = await query(
          'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?',
          [message.group_id, userId]
        );
        if (membership && membership.length > 0) {
          canDelete = true;
        }
      } else if (message.receiver_id === userId) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: '无权删除此消息' });
    }

    if (message.is_snapchat) {
      // 阅后即焚消息，标记为已焚毁
      await query('UPDATE messages SET is_burned = 1 WHERE id = ?', [messageId]);
      
      // 通知相关用户消息已焚毁
      if (req.io) {
        if (message.group_id) {
          req.io.to(`group:${message.group_id}`).emit('message:destroyed', { messageId, groupId: message.group_id });
        } else {
          const targetUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
          req.io.to(`user:${targetUserId}`).emit('message:destroyed', { messageId });
          req.io.to(`user:${userId}`).emit('message:destroyed', { messageId });
        }
      }
      
      res.json({ message: '消息已焚毁' });
    } else {
      // 普通消息，标记为已删除
      await query('UPDATE messages SET is_deleted = 1 WHERE id = ?', [messageId]);

      // 清理提及
      try {
        await cleanupMentions({ chatMessageId: messageId });
      } catch (error) {
        console.error('清理提及失败:', error);
      }

      res.json({ message: '消息已删除' });
    }
  } catch (error) {
    next(error);
  }
});

// 撤回消息
router.put('/messages/:messageId/recall', authenticate, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // 检查消息所有权
    const [messages] = await query(
      'SELECT sender_id, receiver_id, group_id, created_at FROM messages WHERE id = ?',
      [messageId]
    );

    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: '消息不存在' });
    }

    const message = messages[0];
    if (message.sender_id !== userId) {
      return res.status(403).json({ error: '无权撤回此消息' });
    }

    // 检查撤回时间限制（统一120秒）
    const messageTime = new Date(message.created_at).getTime();
    const currentTime = Date.now();
    const timeDiff = (currentTime - messageTime) / 1000;
    
    if (timeDiff > 120) {
      return res.status(400).json({ 
        error: '超过撤回时间限制（120秒）',
        timeLimit: 120
      });
    }

    // 撤回消息
    await query('UPDATE messages SET is_recalled = 1, content = NULL WHERE id = ?', [messageId]);

    // 清理提及
    try {
      await cleanupMentions({ chatMessageId: messageId });
    } catch (error) {
      console.error('清理提及失败:', error);
    }

    // 通知其他用户
    if (req.io) {
      if (message.group_id) {
        req.io.to(`group:${message.group_id}`).emit('message:recall', { 
          messageId, 
          groupId: message.group_id 
        });
      } else {
        // 私聊通知接收者
        req.io.to(`user:${message.receiver_id}`).emit('message:recall', { 
          messageId,
          senderId: message.sender_id
        });
      }
    }

    res.json({ message: '消息已撤回' });
  } catch (error) {
    next(error);
  }
});

// 标记消息为已读（用于阅后即焚）
router.put('/messages/:messageId/read', authenticate, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // 检查消息是否存在
    const [messages] = await query(
      'SELECT id, receiver_id, group_id FROM messages WHERE id = ?',
      [messageId]
    );

    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: '消息不存在' });
    }

    const message = messages[0];

    // 权限检查
    if (message.group_id) {
      // 如果是群聊消息，检查用户是否是群成员
      const [membership] = await query(
        'SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?',
        [message.group_id, userId]
      );
      if (!membership || membership.length === 0) {
        return res.status(403).json({ error: '你不是该群聊成员' });
      }
    } else {
      // 如果是私聊消息，检查用户是否是接收者
      if (message.receiver_id !== userId) {
        return res.status(403).json({ error: '无权标记此消息为已读' });
      }
    }

    // 标记为已读
    await query('UPDATE messages SET is_read = 1 WHERE id = ?', [messageId]);

    // 如果是阅后即焚消息，需要通知其他在线用户该消息已开始倒计时（对于群聊很重要）
    if (req.io) {
      if (message.group_id) {
        // 获取消息详情以同步倒计时
        const [msgDetails] = await query('SELECT * FROM messages WHERE id = ?', [messageId]);
        if (msgDetails && msgDetails.length > 0) {
          req.io.to(`group:${message.group_id}`).emit('message:read', { 
            messageId, 
            groupId: message.group_id,
            snapchat_duration: msgDetails[0].snapchat_duration
          });
        }
      } else {
        // 私聊也通知发送者，以便同步倒计时
        const [msgDetails] = await query('SELECT sender_id FROM messages WHERE id = ?', [messageId]);
        if (msgDetails && msgDetails.length > 0) {
          req.io.to(`user:${msgDetails[0].sender_id}`).emit('message:read', { messageId });
        }
      }
    }

    // 获取最新的消息内容返回给前端
    const [updatedMessages] = await query('SELECT * FROM messages WHERE id = ?', [messageId]);
    
    res.json({ 
      message: '消息已标记为已读',
      data: updatedMessages[0]
    });
  } catch (error) {
    next(error);
  }
});

// 发送音频消息
router.post('/send-audio', authenticate, upload.single('audio'), async (req, res, next) => {
  try {
    const { receiverId, isSnapchat = false, snapchatDuration = 0 } = req.body;
    const senderId = req.user.id;
    const vipLevel = req.user.vipLevel || 'none';

    if (!receiverId) {
      return res.status(400).json({ error: '请提供接收者ID' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的音频文件' });
    }

    // 检查是否在黑名单中
    const [blacklist] = await query(
      'SELECT id FROM user_blacklist WHERE blocker_id = ? AND blocked_id = ?',
      [receiverId, senderId]
    );

    if (blacklist && blacklist.length > 0) {
      return res.status(403).json({ error: '你已被对方加入黑名单' });
    }

    // 阅后即焚时长限制（统一30秒）
    const isSnapchatBool = isSnapchat === 'true' || isSnapchat === true || isSnapchat === 1;
    if (isSnapchatBool) {
      if (parseInt(snapchatDuration) > 30) {
        return res.status(400).json({ 
          error: '阅后即焚时长不能超过30秒',
          maxDuration: 30,
        });
      }
    }

    const conversationId = [senderId, receiverId].sort().join('_');
    const fileUrl = `/uploads/audio/${req.file.filename}`;
    const duration = 0; // 需要添加音频时长检测

    const [result] = await query(
      `INSERT INTO messages (sender_id, receiver_id, conversation_id, message_type, content, 
                             file_url, file_size, duration, is_snapchat, snapchat_duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [senderId, receiverId, conversationId, 'audio', req.file.originalname, fileUrl, req.file.size, duration, isSnapchat ? 1 : 0, snapchatDuration || 0]
    );

    const [rows] = await query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    const message = rows?.[0];
    if (message && req.io) {
      req.io.to(`user:${receiverId}`).emit('message:receive', message);
      req.io.to(`user:${senderId}`).emit('message:receive', message);
    }

    res.status(201).json({
      message: '音频消息发送成功',
      messageId: result.insertId,
      data: message
    });
  } catch (error) {
    next(error);
  }
});

// 发送文件消息
router.post('/send-file', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const { receiverId, messageType = 'file', isSnapchat = false, snapchatDuration = 0 } = req.body;
    const senderId = req.user.id;

    if (!receiverId) {
      return res.status(400).json({ error: '请提供接收者ID' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    // 检查是否在黑名单中
    const [blacklist] = await query(
      'SELECT id FROM user_blacklist WHERE blocker_id = ? AND blocked_id = ?',
      [receiverId, senderId]
    );

    if (blacklist && blacklist.length > 0) {
      return res.status(403).json({ error: '你已被对方加入黑名单' });
    }

    // 阅后即焚时长限制（统一30秒）
    const isSnapchatBool = isSnapchat === 'true' || isSnapchat === true || isSnapchat === 1;
    if (isSnapchatBool) {
      if (parseInt(snapchatDuration) > 30) {
        return res.status(400).json({ 
          error: '阅后即焚时长不能超过30秒',
          maxDuration: 30,
        });
      }
    }

    const conversationId = [senderId, receiverId].sort().join('_');
    let fileUrl;
    
    // 根据文件类型保存到不同目录
    if (messageType === 'image') {
      fileUrl = `/uploads/images/${req.file.filename}`;
    } else if (messageType === 'video') {
      fileUrl = `/uploads/videos/${req.file.filename}`;
    } else if (messageType === 'audio') {
      fileUrl = `/uploads/audio/${req.file.filename}`;
    } else {
      fileUrl = `/uploads/files/${req.file.filename}`;
    }

    // 视频和音频需要添加时长检测
    const duration = 0;

    const [result] = await query(
      `INSERT INTO messages (sender_id, receiver_id, conversation_id, message_type, content, 
                             file_url, file_size, duration, is_snapchat, snapchat_duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [senderId, receiverId, conversationId, messageType, req.file.originalname, fileUrl, req.file.size, duration, isSnapchat ? 1 : 0, snapchatDuration || 0]
    );

    const [rows] = await query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    const message = rows?.[0];
    if (message && req.io) {
      req.io.to(`user:${receiverId}`).emit('message:receive', message);
      req.io.to(`user:${senderId}`).emit('message:receive', message);
    }

    res.status(201).json({
      message: '文件消息发送成功',
      messageId: result.insertId,
      data: message
    });
  } catch (error) {
    next(error);
  }
});

router.post('/send-p2p-file-meta', authenticate, async (req, res, next) => {
  try {
    const { receiverId, messageType = 'file', fileName, fileSize, isSnapchat = false, snapchatDuration = 0 } = req.body;
    const senderId = req.user.id;

    if (!receiverId) {
      return res.status(400).json({ error: '请提供接收者ID' });
    }

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: '请提供文件名' });
    }

    const size = Number(fileSize);
    if (!Number.isFinite(size) || size <= 0) {
      return res.status(400).json({ error: '请提供正确的文件大小' });
    }

    const allowedTypes = new Set(['image', 'video', 'audio', 'file']);
    const normalizedType = allowedTypes.has(messageType) ? messageType : 'file';

    const [blacklist] = await query(
      'SELECT id FROM user_blacklist WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
      [receiverId, senderId, senderId, receiverId]
    );

    if (blacklist && blacklist.length > 0) {
      return res.status(403).json({ error: '双方存在黑名单关系，无法直传' });
    }

    const isSnapchatBool = isSnapchat === 'true' || isSnapchat === true || isSnapchat === 1;
    if (isSnapchatBool) {
      if (parseInt(snapchatDuration) > 30) {
        return res.status(400).json({ 
          error: '阅后即焚时长不能超过30秒',
          maxDuration: 30,
        });
      }
    }

    const conversationId = [senderId, receiverId].sort().join('_');
    const duration = 0;

    const [result] = await query(
      `INSERT INTO messages (sender_id, receiver_id, conversation_id, message_type, content, 
                             file_url, file_size, duration, is_snapchat, snapchat_duration, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NOW())`,
      [senderId, receiverId, conversationId, normalizedType, fileName, Math.floor(size), duration, isSnapchat ? 1 : 0, snapchatDuration || 0]
    );

    const [rows] = await query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    const message = rows?.[0];
    if (message && req.io) {
      req.io.to(`user:${receiverId}`).emit('message:receive', message);
      req.io.to(`user:${senderId}`).emit('message:receive', message);
    }

    res.status(201).json({
      message: '快传消息创建成功',
      messageId: result.insertId,
      data: message
    });
  } catch (error) {
    next(error);
  }
});

// 创建群聊
router.post('/groups', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, memberIds } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '群聊名称不能为空' });
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: '至少需要选择一个成员' });
    }

    // 创建群聊
    const [result] = await query(
      `INSERT INTO chat_groups (name, creator_id, avatar, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [name.trim(), userId, null]
    );

    const groupId = result.insertId;

    // 添加创建者到群聊成员
    await query(
      `INSERT INTO chat_group_members (group_id, user_id, role, joined_at) 
       VALUES (?, ?, 'admin', NOW())`,
      [groupId, userId]
    );

    // 添加其他成员到群聊
    for (const memberId of memberIds) {
      await query(
        `INSERT INTO chat_group_members (group_id, user_id, role, joined_at) 
         VALUES (?, ?, 'member', NOW())`,
        [groupId, memberId]
      );
    }

    // 获取群聊信息
    const [groups] = await query(
      `SELECT g.*, 
              (SELECT COUNT(*) FROM chat_group_members WHERE group_id = g.id) as member_count
       FROM chat_groups g 
       WHERE g.id = ?`,
      [groupId]
    );

    res.status(201).json({
      message: '群聊创建成功',
      group: groups[0]
    });
  } catch (error) {
    next(error);
  }
});

export default router;
