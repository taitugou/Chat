import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import { query, transaction } from '../database/connection.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { processMentions, cleanupMentions } from '../utils/mentionHelper.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Enable sharp cache with a limit to balance memory and HDD I/O
sharp.cache({ memory: 10, files: 20, items: 100 });
import fs from 'fs/promises';
import { createCanvas } from 'canvas';
import { addPoints, POINTS_REWARDS } from '../services/pointsService.js';
import { getUserStats } from '../services/userService.js';
import { updateTaskProgress } from '../utils/taskManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const fieldName = file.fieldname;
    const uploadDir = fieldName === 'background' 
      ? path.join(__dirname, '../uploads/backgrounds')
      : path.join(__dirname, '../uploads/avatars');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${req.user.id}_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  // 移除文件大小限制，所有图片都通过sharp压缩
  fileFilter: (req, file, cb) => {
    // 允许的图片类型
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    
    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype.toLowerCase();
    
    // 检查扩展名或MIME类型是否匹配（至少一个匹配即可）
    if (allowedExtensions.includes(extname) || allowedMimeTypes.includes(mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件 (jpg, jpeg, png)'));
    }
  },
});

// 好友分组相关路由

// 获取好友分组列表
router.get('/friend-groups', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [groups] = await query(
      `SELECT id, name, sort_order, created_at 
       FROM friend_groups 
       WHERE user_id = ? 
       ORDER BY sort_order ASC, created_at DESC`,
      [userId]
    );
    res.json({ groups: groups || [] });
  } catch (error) {
    console.error('获取好友分组失败:', error);
    res.json({ groups: [] });
  }
});

// 创建好友分组
router.post('/friend-groups', authenticate, async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '分组名称不能为空' });
    }

    if (name.length > 20) {
      return res.status(400).json({ error: '分组名称不能超过20字符' });
    }

    const [result] = await query(
      `INSERT INTO friend_groups (user_id, name, sort_order, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [userId, name.trim(), sortOrder || 0]
    );

    res.json({ 
      message: '分组创建成功', 
      group: { 
        id: result.insertId, 
        name: name.trim(), 
        sort_order: sortOrder || 0 
      }
    });
  } catch (error) {
    console.error('创建好友分组失败:', error);
    next(error);
  }
});

// 更新好友分组
router.put('/friend-groups/:groupId', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, sortOrder } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '分组名称不能为空' });
    }

    if (name.length > 20) {
      return res.status(400).json({ error: '分组名称不能超过20字符' });
    }

    const [result] = await query(
      `UPDATE friend_groups 
       SET name = ?, sort_order = ?, updated_at = NOW() 
       WHERE id = ? AND user_id = ?`,
      [name.trim(), sortOrder || 0, groupId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '分组不存在' });
    }

    res.json({ message: '分组更新成功' });
  } catch (error) {
    console.error('更新好友分组失败:', error);
    next(error);
  }
});

// 删除好友分组
router.delete('/friend-groups/:groupId', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    await query(
      `UPDATE user_friends 
       SET group_id = NULL 
       WHERE user_id = ? AND group_id = ?`,
      [userId, groupId]
    );

    await query(
      `DELETE FROM friend_groups 
       WHERE id = ? AND user_id = ?`,
      [groupId, userId]
    );

    res.json({ message: '分组删除成功' });
  } catch (error) {
    console.error('删除好友分组失败:', error);
    next(error);
  }
});

// 搜索用户
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { keyword } = req.query;
    const userId = req.user.id;

    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }

    const trimmedKeyword = keyword.trim();
    const searchPattern = `%${trimmedKeyword}%`;
    
    // 如果以 @ 开头，处理用户名搜索
    const actualUsername = trimmedKeyword.startsWith('@') ? trimmedKeyword.substring(1) : trimmedKeyword;
    
    // 搜索逻辑：支持账号(username)、昵称(nickname)、手机号(phone)、邮箱(email)的 100% 匹配
    // 同时支持 ID 匹配，并保留对账号和昵称的模糊匹配
    const [rows] = await query(
      `SELECT u.id, u.username, u.nickname, u.avatar,
              (SELECT COUNT(*) FROM user_friends WHERE user_id = ? AND friend_id = u.id) as is_friend,
              (SELECT status FROM friend_requests WHERE requester_id = ? AND receiver_id = u.id AND status = 'pending') as request_status
       FROM users u
       WHERE (
          u.id = ? OR
          u.username = ? OR 
          u.nickname = ? OR 
          u.phone = ? OR 
          u.email = ? OR
          u.username LIKE ? OR 
          u.nickname LIKE ?
        )
        AND u.status = 'active' AND u.is_visible = 1
        ORDER BY 
          (CASE 
            WHEN u.id = ? THEN 0
            WHEN u.username = ? THEN 1
            WHEN u.nickname = ? THEN 2
            WHEN u.phone = ? THEN 3
            WHEN u.email = ? THEN 4
            WHEN u.username LIKE ? THEN 5
            ELSE 6 
          END), u.username ASC
        LIMIT 20`,
       [
         userId, userId,
         trimmedKeyword, actualUsername, trimmedKeyword, trimmedKeyword, trimmedKeyword, searchPattern, searchPattern, 
         trimmedKeyword, actualUsername, trimmedKeyword, trimmedKeyword, trimmedKeyword, searchPattern
       ]
     );
    const users = rows;

    res.json({ users: users || [] });
  } catch (error) {
    next(error);
  }
});

// 好友申请相关路由

// 发送好友申请
router.post('/friend-requests/:receiverId', authenticate, async (req, res, next) => {
  try {
    const { receiverId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(receiverId);
    let targetReceiverId;

    if (isNumeric) {
      targetReceiverId = parseInt(receiverId);
    } else {
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [receiverId, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetReceiverId = users[0].id;
    }

    if (userId === targetReceiverId) {
      return res.status(400).json({ error: '不能添加自己为好友' });
    }

    // 检查是否已经是好友
    const [existingFriends] = await query(
      'SELECT id FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, targetReceiverId, targetReceiverId, userId]
    );

    if (existingFriends && existingFriends.length > 0) {
      return res.status(409).json({ error: '已经是好友关系' });
    }

    // 检查是否有对方发来的待处理申请
    const [incomingRequests] = await query(
      'SELECT id FROM friend_requests WHERE requester_id = ? AND receiver_id = ? AND status = ?',
      [targetReceiverId, userId, 'pending']
    );

    if (incomingRequests && incomingRequests.length > 0) {
      // 如果对方已经发了申请，直接通过该申请成为好友
      const requestId = incomingRequests[0].id;
      await transaction(async (connection) => {
        // 添加好友关系
        await connection.query(
          'INSERT IGNORE INTO user_friends (user_id, friend_id, created_at) VALUES (?, ?, NOW()), (?, ?, NOW())',
          [userId, targetReceiverId, targetReceiverId, userId]
        );
        // 更新申请状态
        await connection.query(
          'UPDATE friend_requests SET status = ?, updated_at = NOW() WHERE id = ?',
          ['accepted', requestId]
        );
      });
      return res.json({ message: '对方已向你发送过好友申请，已自动互加好友', action: 'accepted' });
    }

    // 检查是否已有自己发出的待处理申请
    const [existingRequests] = await query(
      'SELECT id FROM friend_requests WHERE requester_id = ? AND receiver_id = ? AND status = ?',
      [userId, targetReceiverId, 'pending']
    );

    if (existingRequests && existingRequests.length > 0) {
      return res.status(409).json({ error: '已发送好友申请，请等待对方处理' });
    }

    // 创建或更新好友申请 (使用 ON DUPLICATE KEY UPDATE 处理之前的拒绝记录)
    await query(
      'INSERT INTO friend_requests (requester_id, receiver_id, message, status, created_at) VALUES (?, ?, ?, "pending", NOW()) ON DUPLICATE KEY UPDATE status = "pending", message = VALUES(message), created_at = NOW()',
      [userId, targetReceiverId, message || null]
    );

    // 发送通知
    try {
      const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
      const [result] = await query(
        `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
         VALUES (?, 'message', '好友申请', ?, ?, ?, ?, ?, 'friend_request')`,
        [targetReceiverId, '收到了新的好友申请', userId, sender[0].avatar, sender[0].nickname, userId]
      );

      // 发送 Socket.IO 实时通知
      if (req.io) {
        req.io.to(`user:${targetReceiverId}`).emit('notification:new', {
          id: result.insertId,
          type: 'message',
          title: '好友申请',
          content: '收到了新的好友申请',
          sender_id: userId,
          sender_nickname: sender[0].nickname,
          sender_avatar: sender[0].avatar,
          related_id: userId,
          related_type: 'friend_request',
          created_at: new Date()
        });
        console.log(`已向用户 ${targetReceiverId} 发送好友申请 Socket 通知`);
      }
    } catch (notificationError) {
      console.error('发送好友申请通知失败:', notificationError);
    }

    res.json({ message: '好友申请已发送' });
  } catch (error) {
    console.error('发送好友申请错误:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: '好友申请表不存在，请联系管理员' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ error: '用户不存在' });
    }
    next(error);
  }
});

// 获取好友申请列表
router.get('/friend-requests', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [requests] = await query(
      `SELECT fr.id, fr.requester_id, fr.receiver_id, fr.message, fr.status, fr.created_at,
              u.username, u.nickname, u.avatar
       FROM friend_requests fr
       JOIN users u ON fr.requester_id = u.id
       WHERE fr.receiver_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    res.json({ requests });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      res.json({ requests: [] });
    } else {
      next(error);
    }
  }
});

// 处理好友申请
router.put('/friend-requests/:requestId', authenticate, async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;
    const userId = req.user.id;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: '无效的操作' });
    }

    // 检查申请是否存在且属于当前用户
    const [request] = await query(
      'SELECT id, requester_id, receiver_id FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = ?',
      [requestId, userId, 'pending']
    );

    if (!request || request.length === 0) {
      return res.status(404).json({ error: '申请不存在或已处理' });
    }

    const reqData = request[0];

    await transaction(async (connection) => {
      if (action === 'accept') {
        // 添加好友关系（双向）- 使用 INSERT IGNORE 避免已存在关系时报错
        await connection.query(
          'INSERT IGNORE INTO user_friends (user_id, friend_id, created_at) VALUES (?, ?, NOW()), (?, ?, NOW())',
          [userId, reqData.requester_id, reqData.requester_id, userId]
        );

        // 如果对方也给当前用户发了申请，一并处理掉
        await connection.query(
          'UPDATE friend_requests SET status = ?, updated_at = NOW() WHERE requester_id = ? AND receiver_id = ? AND status = ?',
          ['accepted', userId, reqData.requester_id, 'pending']
        );

        // 发送通知给申请人
        try {
          const [receiver] = await connection.query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
          const [notifResult] = await connection.query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
             VALUES (?, 'message', '好友申请已通过', ?, ?, ?, ?, ?, 'friend_accept')`,
            [reqData.requester_id, '通过了你的好友申请', userId, receiver[0].avatar, receiver[0].nickname, userId]
          );

          // 发送 Socket.IO 实时通知
          if (req.io) {
            req.io.to(`user:${reqData.requester_id}`).emit('notification:new', {
              id: notifResult.insertId,
              type: 'message',
              title: '好友申请已通过',
              content: '通过了你的好友申请',
              sender_id: userId,
              sender_nickname: receiver[0].nickname,
              sender_avatar: receiver[0].avatar,
              related_id: userId,
              related_type: 'friend_accept',
              created_at: new Date()
            });
          }
        } catch (notificationError) {
          console.error('发送好友通过通知失败:', notificationError);
        }
      }

      // 更新申请状态
      await connection.query(
        'UPDATE friend_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        [action === 'accept' ? 'accepted' : 'rejected', requestId]
      );

      // 同时也把对应的通知标记为已读
      await connection.query(
        "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND related_type = 'friend_request' AND related_id = ? AND is_read = FALSE",
        [userId, reqData.requester_id]
      );
    });

    res.json({ 
      message: action === 'accept' ? '已接受好友申请' : '已拒绝好友申请',
      action 
    });
  } catch (error) {
    console.error('处理好友申请错误:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: '好友相关表不存在，请联系管理员' });
    }
    next(error);
  }
});

// 删除好友申请
router.delete('/friend-requests/:requestId', authenticate, async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    // 获取申请信息以便清理通知
    const [request] = await query(
      'SELECT requester_id, receiver_id FROM friend_requests WHERE id = ?',
      [requestId]
    );

    await query(
      'DELETE FROM friend_requests WHERE id = ? AND (requester_id = ? OR receiver_id = ?)',
      [requestId, userId, userId]
    );

    if (request && request.length > 0) {
      const reqData = request[0];
      // 清理相关通知
      await query(
        "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE (user_id = ? AND related_type = 'friend_request' AND related_id = ?) OR (user_id = ? AND related_type = 'friend_request' AND related_id = ?)",
        [reqData.receiver_id, reqData.requester_id, reqData.requester_id, reqData.receiver_id]
      );
    }

    res.json({ message: '好友申请已删除' });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      res.json({ message: '好友申请已删除' });
    } else {
      next(error);
    }
  }
});

// 获取发送的好友申请
router.get('/friend-requests/sent', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [requests] = await query(
      `SELECT fr.id, fr.receiver_id, fr.message, fr.status, fr.created_at,
              u.username, u.nickname, u.avatar
       FROM friend_requests fr
       JOIN users u ON fr.receiver_id = u.id
       WHERE fr.requester_id = ?
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    res.json({ requests });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      res.json({ requests: [] });
    } else {
      next(error);
    }
  }
});

// 更新用户资料
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { nickname, bio, gender, location, interestTags, privacySettings, onlineStatus, locationVisibility } = req.body;
    const userId = req.user.id;

    const updates = [];
    const values = [];

    if (nickname !== undefined) {
      if (nickname.length < 2 || nickname.length > 20) {
        return res.status(400).json({ error: '昵称长度必须在2-20位之间' });
      }
      updates.push('nickname = ?');
      values.push(nickname);
    }

    if (bio !== undefined) {
      if (bio.length > 200) {
        return res.status(400).json({ error: '个性签名不能超过200字符' });
      }
      updates.push('bio = ?');
      values.push(bio);
    }

    if (gender !== undefined) {
      if (!['male', 'female', 'secret'].includes(gender)) {
        return res.status(400).json({ error: '性别参数无效' });
      }
      updates.push('gender = ?');
      values.push(gender);
    }

    if (location !== undefined) {
      updates.push('location = ?');
      values.push(location);
    }

    if (interestTags !== undefined) {
      if (Array.isArray(interestTags) && interestTags.length > 10) {
        return res.status(400).json({ error: '兴趣标签最多10个' });
      }
      updates.push('interest_tags = ?');
      values.push(JSON.stringify(interestTags || []));
    }

    if (privacySettings !== undefined) {
      updates.push('privacy_settings = ?');
      values.push(JSON.stringify(privacySettings));
    }

    if (locationVisibility !== undefined) {
      const validVisibilities = ['public', 'friends', 'private'];
      if (!validVisibilities.includes(locationVisibility)) {
        return res.status(400).json({ error: '地址可见性参数无效' });
      }

      const [currentSettings] = await query(
        `SELECT privacy_settings FROM users WHERE id = ?`,
        [userId]
      );

      let updatedPrivacy = {
        profile_visibility: 'all',
        online_status: true,
        dynamic_visibility: 'all'
      };

      try {
        if (currentSettings[0]?.privacy_settings) {
          const raw = currentSettings[0].privacy_settings;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          updatedPrivacy = {
            ...updatedPrivacy,
            ...parsed
          };
        }
      } catch (error) {
      }

      updatedPrivacy.location_visibility = locationVisibility;

      updates.push('privacy_settings = ?');
      values.push(JSON.stringify(updatedPrivacy));
    }

    if (onlineStatus !== undefined) {
      updates.push('online_status = ?');
      values.push(onlineStatus ? 'online' : 'offline');
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await query(sql, values);

    // 处理 bio 中的提及
    if (bio !== undefined) {
      // 先清理旧提及
      await cleanupMentions({ bioUserId: userId });
      
      await processMentions({
        content: bio,
        bioUserId: userId,
        userId: userId,
        io: req.io
      });
    }

    // 尝试更新任务进度
    try {
      await updateTaskProgress(userId, '完善资料', 1, true);
    } catch (error) {
      console.error('更新完善资料任务失败:', error);
    }

    res.json({ message: '资料更新成功' });
  } catch (error) {
    next(error);
  }
});

// 更新账号设置（注册信息）
router.put('/settings/account', authenticate, async (req, res, next) => {
  try {
    const { username, nickname, phone, email, newPassword } = req.body;
    const userId = req.user.id;

    // 1. 获取当前用户信息
    const [users] = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const currentUser = users[0];

    // 2. 验证并准备更新数据
    const updates = [];
    const values = [];

    // 验证用户名
    if (username && username !== currentUser.username) {
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '账号长度必须在3-20位之间' });
      }
      // 检查唯一性
      const [existing] = await query(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: '账号已被使用' });
      }
      updates.push('username = ?');
      values.push(username);
    }

    // 验证昵称
    if (nickname && nickname !== currentUser.nickname) {
      if (nickname.length < 2 || nickname.length > 20) {
        return res.status(400).json({ error: '昵称长度必须在2-20位之间' });
      }
      updates.push('nickname = ?');
      values.push(nickname);
    }

    // 验证手机号
    if (phone && phone !== currentUser.phone) {
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }
      // 检查唯一性
      const [existing] = await query(
        'SELECT id FROM users WHERE phone = ? AND id != ?',
        [phone, userId]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: '手机号已被使用' });
      }
      updates.push('phone = ?');
      values.push(phone);
    }

    // 验证邮箱
    if (email !== undefined && email !== currentUser.email) {
      // 允许设置为空
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
      }
      // 如果不是空，检查唯一性
      if (email) {
        const [existing] = await query(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, userId]
        );
        if (existing.length > 0) {
          return res.status(409).json({ error: '邮箱已被使用' });
        }
      }
      updates.push('email = ?');
      values.push(email || null);
    }

    // 验证新密码
    if (newPassword) {
      if (newPassword.length < 8 || newPassword.length > 20 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({ error: '新密码必须包含字母和数字，长度8-20位' });
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的信息' });
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: '账号信息更新成功' });

  } catch (error) {
    next(error);
  }
});

// 更新隐私设置
router.put('/settings/privacy', authenticate, async (req, res, next) => {
  try {
    const { profile_visibility, online_status, dynamic_visibility, 
            posts_visibility, likes_visibility, following_visibility, followers_visibility, lastSeen } = req.body;
    const userId = req.user.id;

    // 验证隐私设置值
    const validVisibilities = ['public', 'friends', 'private'];

    if (profile_visibility && !validVisibilities.includes(profile_visibility)) {
      return res.status(400).json({ error: '无效的资料可见性设置' });
    }

    if (dynamic_visibility && !validVisibilities.includes(dynamic_visibility)) {
      return res.status(400).json({ error: '无效的动态可见性设置' });
    }

    if (posts_visibility && !validVisibilities.includes(posts_visibility)) {
      return res.status(400).json({ error: '无效的帖子可见性设置' });
    }

    if (likes_visibility && !validVisibilities.includes(likes_visibility)) {
      return res.status(400).json({ error: '无效的获赞可见性设置' });
    }

    if (following_visibility && !validVisibilities.includes(following_visibility)) {
      return res.status(400).json({ error: '无效的关注可见性设置' });
    }

    if (followers_visibility && !validVisibilities.includes(followers_visibility)) {
      return res.status(400).json({ error: '无效的粉丝可见性设置' });
    }

    // 获取当前隐私设置和统计可见性
    const [currentSettings] = await query(
      `SELECT privacy_settings, posts_visibility, likes_visibility, following_visibility, followers_visibility 
       FROM users WHERE id = ?`,
      [userId]
    );

    const parsePrivacy = (value) => {
      if (!value) {
        return null;
      }
      try {
        if (typeof value === 'string') {
          return JSON.parse(value);
        }
        if (typeof value === 'object') {
          return value;
        }
        return null;
      } catch {
        return null;
      }
    };

    let updatedSettings = {
      profile_visibility: 'all',
      online_status: true,
      dynamic_visibility: 'all',
      ...(parsePrivacy(currentSettings[0]?.privacy_settings) || {})
    };

    // 更新隐私设置
    if (profile_visibility !== undefined) {
      updatedSettings.profile_visibility = profile_visibility;
    }

    if (online_status !== undefined) {
      updatedSettings.online_status = online_status;
    }

    if (dynamic_visibility !== undefined) {
      updatedSettings.dynamic_visibility = dynamic_visibility;
    }

    if (lastSeen !== undefined) {
      updatedSettings.lastSeen = lastSeen;
    }

    // 更新统计信息可见性
    const updates = [];
    const values = [];

    if (posts_visibility !== undefined) {
      updates.push('posts_visibility = ?');
      values.push(posts_visibility);
    }

    if (likes_visibility !== undefined) {
      updates.push('likes_visibility = ?');
      values.push(likes_visibility);
    }

    if (following_visibility !== undefined) {
      updates.push('following_visibility = ?');
      values.push(following_visibility);
    }

    if (followers_visibility !== undefined) {
      updates.push('followers_visibility = ?');
      values.push(followers_visibility);
    }

    if (updates.length > 0) {
      updates.push('privacy_settings = ?');
      values.push(JSON.stringify(updatedSettings));
      values.push(userId);

      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    } else {
      await query(
        `UPDATE users SET privacy_settings = ? WHERE id = ?`,
        [JSON.stringify(updatedSettings), userId]
      );
    }

    res.json({ 
      message: '隐私设置更新成功', 
      privacy_settings: updatedSettings,
      posts_visibility: posts_visibility || currentSettings[0]?.posts_visibility || 'public',
      likes_visibility: likes_visibility || currentSettings[0]?.likes_visibility || 'public',
      following_visibility: following_visibility || currentSettings[0]?.following_visibility || 'public',
      followers_visibility: followers_visibility || currentSettings[0]?.followers_visibility || 'public'
    });
  } catch (error) {
    next(error);
  }
});

// 获取隐私设置
router.get('/settings/privacy', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [result] = await query(
      `SELECT privacy_settings FROM users WHERE id = ?`,
      [userId]
    );

    const parsePrivacy = (value) => {
      if (!value) {
        return null;
      }
      try {
        if (typeof value === 'string') {
          return JSON.parse(value);
        }
        if (typeof value === 'object') {
          return value;
        }
        return null;
      } catch {
        return null;
      }
    };

    const privacySettings = parsePrivacy(result[0]?.privacy_settings) || {
      profile_visibility: 'all',
      online_status: true,
      dynamic_visibility: 'all',
      location_visibility: 'public'
    };

    res.json({ privacy_settings: privacySettings });
  } catch (error) {
    next(error);
  }
});

// 上传头像
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }

    const userId = req.user.id;
    const filePath = req.file.path;
    let compressedFilePath;

    try {
      // 压缩和裁剪图片 - 始终使用不同的临时输出文件
      const tempCompressedFilePath = filePath + '.temp.jpg';
      await sharp(filePath)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(tempCompressedFilePath);

      // 删除原文件
      await fs.unlink(filePath);
      
      // 重命名临时文件到最终路径
      compressedFilePath = filePath.replace(path.extname(filePath), '.jpg');
      await fs.rename(tempCompressedFilePath, compressedFilePath);
    } catch (sharpError) {
      console.error('图片处理失败:', sharpError);
      // 清理临时文件
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.error('清理原文件失败:', cleanupError);
      }
      // 清理可能存在的临时文件
      try {
        const tempCompressedFilePath = filePath + '.temp.jpg';
        await fs.unlink(tempCompressedFilePath);
      } catch (cleanupError) {
        console.error('清理临时文件失败:', cleanupError);
      }
      return res.status(500).json({ error: '图片处理失败' });
    }

    const avatarUrl = `/uploads/avatars/${path.basename(compressedFilePath)}`;

    // 更新数据库
    try {
      await query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);
    } catch (dbError) {
      console.error('更新头像失败:', dbError);
      // 清理处理后的文件
      try {
        await fs.unlink(compressedFilePath);
      } catch (cleanupError) {
        console.error('清理处理后文件失败:', cleanupError);
      }
      return res.status(500).json({ error: '更新头像失败' });
    }

    res.json({ message: '头像上传成功', avatar: avatarUrl });
  } catch (error) {
    console.error('头像上传失败:', error);
    res.status(500).json({ error: '头像上传失败' });
  }
});

// 上传背景图片
router.post('/background', authenticate, upload.single('background'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }

    const userId = req.user.id;
    const filePath = req.file.path;
    let compressedFilePath;

    try {
      // 优化背景图片处理：取消固定尺寸强制裁剪，改为保留原始比例并进行高质量压缩
      const tempCompressedFilePath = filePath + '.temp.jpg';
      const image = sharp(filePath);
      const metadata = await image.metadata();

      // 如果图片非常大（例如超过 2560px），则按比例缩小到 2560px 宽度以节省带宽
      // 否则保持原尺寸，不进行强制裁剪
      if (metadata.width > 2560) {
        await image
          .resize(2560, null, { withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toFile(tempCompressedFilePath);
      } else {
        await image
          .jpeg({ quality: 90 })
          .toFile(tempCompressedFilePath);
      }

      // 删除原文件
      await fs.unlink(filePath);
      
      // 重命名临时文件到最终路径
      compressedFilePath = filePath.replace(path.extname(filePath), '.jpg');
      await fs.rename(tempCompressedFilePath, compressedFilePath);
    } catch (sharpError) {
      console.error('背景图片处理失败:', sharpError);
      // 清理临时文件
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.error('清理原文件失败:', cleanupError);
      }
      // 清理可能存在的临时文件
      try {
        const tempCompressedFilePath = filePath + '.temp.jpg';
        await fs.unlink(tempCompressedFilePath);
      } catch (cleanupError) {
        console.error('清理临时文件失败:', cleanupError);
      }
      return res.status(500).json({ error: '背景图片处理失败' });
    }

    const backgroundUrl = `/uploads/backgrounds/${path.basename(compressedFilePath)}`;

    // 更新数据库
    try {
      await query('UPDATE users SET background_image = ? WHERE id = ?', [backgroundUrl, userId]);
    } catch (dbError) {
      console.error('更新背景图片失败:', dbError);
      // 清理处理后的文件
      try {
        await fs.unlink(compressedFilePath);
      } catch (cleanupError) {
        console.error('清理处理后文件失败:', cleanupError);
      }
      return res.status(500).json({ error: '更新背景图片失败' });
    }

    res.json({ message: '背景图片上传成功', background: backgroundUrl });
  } catch (error) {
    console.error('背景图片上传失败:', error);
    res.status(500).json({ error: '背景图片上传失败' });
  }
});

// 获取好友列表
router.get('/friends/list', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [friends] = await query(
      `SELECT u.id, u.username, u.nickname, u.avatar, u.online_status, uf.remark, 
              uf.group_id, uf.tags, uf.permissions, uf.created_at,
              (SELECT name FROM friend_groups WHERE id = uf.group_id) as group_name
       FROM user_friends uf
       JOIN users u ON uf.friend_id = u.id
       WHERE uf.user_id = ? AND u.status = 'active' AND u.is_visible = 1
       ORDER BY uf.created_at DESC`,
      [userId]
    );

    const formattedFriends = friends.map(friend => {
      try {
        friend.tags = friend.tags ? JSON.parse(friend.tags) : [];
      } catch (e) {
        friend.tags = [];
      }
      try {
        friend.permissions = friend.permissions ? JSON.parse(friend.permissions) : {
          viewProfile: true,
          viewPosts: true,
          sendMessage: true,
          viewOnlineStatus: true
        };
      } catch (e) {
        friend.permissions = {
          viewProfile: true,
          viewPosts: true,
          sendMessage: true,
          viewOnlineStatus: true
        };
      }
      return friend;
    });

    res.json({ friends: formattedFriends });
  } catch (error) {
    next(error);
  }
});

// 添加好友
router.post('/friends/:friendId', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const { remark } = req.body;

    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(friendId);
    let targetFriendId;
    
    if (isNumeric) {
      targetFriendId = parseInt(friendId);
    } else {
      // 通过用户名查询用户ID
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [friendId, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetFriendId = users[0].id;
    }

    if (userId === targetFriendId) {
      return res.status(400).json({ error: '不能添加自己为好友' });
    }

    // 检查是否已经是好友
    const [existing] = await query(
      'SELECT id FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, targetFriendId, targetFriendId, userId]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: '已经是好友关系' });
    }

    // 添加好友
    await query(
      'INSERT IGNORE INTO user_friends (user_id, friend_id, remark, created_at) VALUES (?, ?, ?, NOW()), (?, ?, NULL, NOW())',
      [userId, targetFriendId, remark || null, targetFriendId, userId]
    );

    res.json({ message: '添加好友成功' });
  } catch (error) {
    next(error);
  }
});

// 设置好友备注
router.put('/friends/:friendId/remark', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const { remark } = req.body;

    if (remark !== undefined && remark !== null && remark.trim().length > 0) {
      if (remark.length > 100) {
        return res.status(400).json({ error: '备注不能超过100字符' });
      }
    }

    const [result] = await query(
      'UPDATE user_friends SET remark = ? WHERE user_id = ? AND friend_id = ?',
      [remark || null, userId, friendId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '好友关系不存在' });
    }

    res.json({ message: '备注设置成功' });
  } catch (error) {
    next(error);
  }
});

// 设置好友标签
router.put('/friends/:friendId/tags', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: '标签必须是数组' });
    }

    if (tags.length > 10) {
      return res.status(400).json({ error: '最多添加10个标签' });
    }

    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length > 20) {
        return res.status(400).json({ error: '每个标签不能超过20字符' });
      }
    }

    const [result] = await query(
      'UPDATE user_friends SET tags = ? WHERE user_id = ? AND friend_id = ?',
      [JSON.stringify(tags), userId, friendId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '好友关系不存在' });
    }

    res.json({ message: '标签设置成功' });
  } catch (error) {
    next(error);
  }
});

// 设置好友权限
router.put('/friends/:friendId/permissions', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const { viewProfile, viewPosts, sendMessage, viewOnlineStatus } = req.body;

    const permissions = {
      viewProfile: viewProfile !== undefined ? viewProfile : true,
      viewPosts: viewPosts !== undefined ? viewPosts : true,
      sendMessage: sendMessage !== undefined ? sendMessage : true,
      viewOnlineStatus: viewOnlineStatus !== undefined ? viewOnlineStatus : true
    };

    const [result] = await query(
      'UPDATE user_friends SET permissions = ? WHERE user_id = ? AND friend_id = ?',
      [JSON.stringify(permissions), userId, friendId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '好友关系不存在' });
    }

    res.json({ message: '权限设置成功', permissions });
  } catch (error) {
    next(error);
  }
});

// 获取共同好友
router.get('/friends/:friendId/common', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    const [commonFriends] = await query(
      `SELECT u.id, u.username, u.nickname, u.avatar
       FROM user_friends uf1
       JOIN user_friends uf2 ON uf1.friend_id = uf2.friend_id
       JOIN users u ON uf1.friend_id = u.id
       WHERE uf1.user_id = ? AND uf2.user_id = ? AND u.id != ? AND u.id != ?
       GROUP BY u.id`,
      [userId, friendId, userId, friendId]
    );

    res.json({ commonFriends: commonFriends || [] });
  } catch (error) {
    next(error);
  }
});

// 删除好友
router.delete('/friends/:friendId', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    await query(
      'DELETE FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId]
    );

    res.json({ message: '删除好友成功' });
  } catch (error) {
    next(error);
  }
});

// 加入黑名单
router.post('/block/:userId', authenticate, async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const { userId } = req.params;

    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(userId);
    let targetUserId;
    
    if (isNumeric) {
      targetUserId = parseInt(userId);
    } else {
      // 通过用户名查询用户ID
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [userId, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetUserId = users[0].id;
    }

    if (blockerId === targetUserId) {
      return res.status(400).json({ error: '不能将自己加入黑名单' });
    }

    // 检查是否已在黑名单
    const [existing] = await query(
      'SELECT id FROM user_blacklist WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, targetUserId]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: '已在黑名单中' });
    }

    await query(
      'INSERT INTO user_blacklist (blocker_id, blocked_id, created_at) VALUES (?, ?, NOW())',
      [blockerId, targetUserId]
    );

    res.json({ message: '已加入黑名单' });
  } catch (error) {
    next(error);
  }
});

// 获取黑名单
router.get('/block/list', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [blacklist] = await query(
      `SELECT u.id, u.username, u.nickname, u.avatar, ub.created_at
       FROM user_blacklist ub
       JOIN users u ON ub.blocked_id = u.id
       WHERE ub.blocker_id = ? AND u.status = 'active' AND u.is_visible = 1
       ORDER BY ub.created_at DESC`,
      [userId]
    );

    res.json({ blacklist });
  } catch (error) {
    next(error);
  }
});

// 移除黑名单
router.delete('/block/:userId', authenticate, async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const { userId } = req.params;

    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(userId);
    let targetUserId;
    
    if (isNumeric) {
      targetUserId = parseInt(userId);
    } else {
      // 通过用户名查询用户ID
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [userId, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetUserId = users[0].id;
    }

    await query(
      'DELETE FROM user_blacklist WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, targetUserId]
    );

    res.json({ message: '已移除黑名单' });
  } catch (error) {
    next(error);
  }
});

// 更新好友分组
router.put('/friends/:friendId/group', authenticate, async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const { groupId } = req.body;
    const userId = req.user.id;

    const [result] = await query(
      `UPDATE user_friends 
       SET group_id = ?
       WHERE user_id = ? AND friend_id = ?`,
      [groupId, userId, friendId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '好友关系不存在' });
    }

    res.json({ message: '好友分组更新成功' });
  } catch (error) {
    next(error);
  }
});


// 好友关系自定义相关路由

// 设置自定义关系名称（双向确认机制）
router.post('/friends/:friendId/set-relation', authenticate, async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const { customName, visibility, targetGroups } = req.body;
    const userId = req.user.id;
    
    if (parseInt(friendId) === userId) {
      return res.status(400).json({ error: '不能为自己设置关系' });
    }
    
    if (!customName || customName.trim().length === 0) {
      return res.status(400).json({ error: '关系名称不能为空' });
    }
    
    if (customName.length > 10) {
      return res.status(400).json({ error: '关系名称不能超过10个字符' });
    }
    
    // 检查是否是好友关系
    const [friendship] = await query(
      `SELECT id FROM user_friends 
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );
    
    if (!friendship || friendship.length === 0) {
      return res.status(404).json({ error: '好友关系不存在' });
    }
    
    // 检查是否已存在待处理的请求
    const [existing] = await query(
      `SELECT id, status FROM user_friend_relations 
       WHERE user_id = ? AND friend_id = ?`,
      [userId, friendId]
    );
    
    if (existing && existing.length > 0) {
      if (existing[0].status === 'pending') {
        return res.status(409).json({ error: '已存在待处理的关系请求' });
      } else {
        // 更新现有关系
        await query(
          `UPDATE user_friend_relations 
           SET custom_name = ?, visibility = ?, target_groups = ?, 
               status = 'pending', requested_at = NOW(), responded_at = NULL 
           WHERE user_id = ? AND friend_id = ?`,
          [customName, visibility || 'both', JSON.stringify(targetGroups || []), userId, friendId]
        );
      }
    } else {
      // 创建新的关系请求
      await query(
        `INSERT INTO user_friend_relations 
         (user_id, friend_id, custom_name, visibility, target_groups, status) 
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [userId, friendId, customName, visibility || 'both', JSON.stringify(targetGroups || [])]
      );
    }
    
    res.json({ 
      message: '关系设置请求已发送，等待对方确认',
      customName 
    });
  } catch (error) {
    next(error);
  }
});

// 获取关系请求列表
router.get('/friends/relation-requests', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [requests] = await query(
      `SELECT ufr.id, ufr.user_id, u.username, u.nickname, u.avatar,
              ufr.custom_name, ufr.visibility, ufr.status, ufr.requested_at
       FROM user_friend_relations ufr
       JOIN users u ON ufr.user_id = u.id
       WHERE ufr.friend_id = ? AND ufr.status = 'pending'`,
      [userId]
    );
    
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

// 响应关系请求
router.put('/friends/relation-requests/:requestId', authenticate, async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // accept 或 reject
    const userId = req.user.id;
    
    // 检查请求是否存在且属于当前用户
    const [request] = await query(
      `SELECT id, user_id, friend_id, custom_name FROM user_friend_relations 
       WHERE id = ? AND friend_id = ? AND status = 'pending'`,
      [requestId, userId]
    );
    
    if (!request || request.length === 0) {
      return res.status(404).json({ error: '请求不存在或已处理' });
    }
    
    const reqData = request[0];
    let status;
    
    if (action === 'accept') {
      status = 'accepted';
    } else if (action === 'reject') {
      status = 'rejected';
    } else {
      return res.status(400).json({ error: '无效的操作' });
    }
    
    // 更新请求状态
    await query(
      `UPDATE user_friend_relations 
       SET status = ?, responded_at = NOW() 
       WHERE id = ?`,
      [status, requestId]
    );
    
    // 如果接受请求，为对方也创建一条关系记录（双向可见）
    if (action === 'accept') {
      await query(
        `INSERT INTO user_friend_relations 
         (user_id, friend_id, custom_name, visibility, status) 
         VALUES (?, ?, ?, ?, 'accepted') 
         ON DUPLICATE KEY UPDATE 
         custom_name = VALUES(custom_name), 
         visibility = VALUES(visibility), 
         status = 'accepted',
         updated_at = NOW()`,
        [reqData.friend_id, reqData.user_id, reqData.custom_name, 'both']
      );
    }
    
    res.json({ 
      message: action === 'accept' ? '关系请求已接受' : '关系请求已拒绝',
      action, 
      status
    });
  } catch (error) {
    next(error);
  }
});

// 获取好友关系信息
router.get('/friends/:friendId/relation', authenticate, async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const userId = req.user.id;
    
    // 获取双向关系信息
    const [relations] = await query(
      `SELECT * FROM user_friend_relations 
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );
    
    const userRelation = relations.find(r => r.user_id === userId && r.friend_id === parseInt(friendId));
    const friendRelation = relations.find(r => r.user_id === parseInt(friendId) && r.friend_id === userId);
    
    res.json({ 
      userRelation: userRelation || null,
      friendRelation: friendRelation || null
    });
  } catch (error) {
    next(error);
  }
});

// 更新关系可见性
router.put('/friends/:friendId/relation/visibility', authenticate, async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const { visibility, targetGroups } = req.body;
    const userId = req.user.id;
    
    const [result] = await query(
      `UPDATE user_friend_relations 
       SET visibility = ?, target_groups = ? 
       WHERE user_id = ? AND friend_id = ?`,
      [visibility, JSON.stringify(targetGroups || []), userId, friendId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '关系不存在' });
    }
    
    res.json({ message: '关系可见性已更新' });
  } catch (error) {
    next(error);
  }
});

// 删除自定义关系
router.delete('/friends/:friendId/relation', authenticate, async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const userId = req.user.id;
    
    await query(
      `DELETE FROM user_friend_relations 
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );
    
    res.json({ message: '关系已删除' });
  } catch (error) {
    next(error);
  }
});

// 关注系统相关路由

// 关注用户
router.post('/follow/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;
    
    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(userId);
    let targetUserId;
    
    if (isNumeric) {
      targetUserId = parseInt(userId);
    } else {
      // 通过用户名查询用户ID
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [userId, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetUserId = users[0].id;
    }
    
    if (followerId === targetUserId) {
      return res.status(400).json({ error: '不能关注自己' });
    }
    
    // 检查是否已关注
    const [existing] = await query(
      `SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?`,
      [followerId, targetUserId]
    );
    
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: '已经关注该用户' });
    }
    
    await query(
      `INSERT INTO user_follows (follower_id, following_id, created_at) VALUES (?, ?, NOW())`,
      [followerId, targetUserId]
    );

    try {
      const [rewardResult] = await query(
        `INSERT IGNORE INTO user_follow_point_rewards (follower_id, following_id, rewarded_at) VALUES (?, ?, NOW())`,
        [followerId, targetUserId]
      );
      if (rewardResult?.affectedRows > 0) {
        await addPoints(targetUserId, POINTS_REWARDS.BE_FOLLOWED, 'earn', '被用户关注');
      }
    } catch (error) {
      console.error('关注奖励积分失败:', error);
    }

    // 发送通知
    try {
      const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [followerId]);
      await query(
        `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
          VALUES (?, 'follow', '新关注', ?, ?, ?, ?, ?, 'user')`,
        [targetUserId, '有人关注了你', followerId, sender[0].avatar, sender[0].nickname, followerId]
      );
    } catch (notificationError) {
      console.error('发送关注通知失败:', notificationError);
    }

    res.json({ message: '关注成功' });
  } catch (error) {
    next(error);
  }
});

// 取消关注用户
router.delete('/follow/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;
    
    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(userId);
    let targetUserId;
    
    if (isNumeric) {
      targetUserId = parseInt(userId);
    } else {
      // 通过用户名查询用户ID
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [userId, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetUserId = users[0].id;
    }
    
    try {
      await query(
        `DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?`,
        [followerId, targetUserId]
      );
      
      res.json({ message: '取消关注成功' });
    } catch (followError) {
      console.error('取消关注失败:', followError);
      // 如果表不存在或其他错误，返回成功（幂等操作）
      res.json({ message: '取消关注成功' });
    }
  } catch (error) {
    next(error);
  }
});

// 获取关注列表
router.get('/follows/following', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    try {
      const [following] = await query(
        `SELECT u.id, u.username, u.nickname, u.avatar, u.online_status
         FROM user_follows uf
         JOIN users u ON uf.following_id = u.id
         WHERE uf.follower_id = ? AND u.status = 'active'
         ORDER BY uf.created_at DESC`,
        [userId]
      );
      
      res.json({ following: Array.isArray(following) ? following : [] });
    } catch (followError) {
      console.error('获取关注列表失败:', followError);
      res.json({ following: [] });
    }
  } catch (error) {
    next(error);
  }
});

// 获取指定用户的关注列表
router.get('/:id/following', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(id);
    let targetUserId;
    
    if (isNumeric) {
      targetUserId = parseInt(id);
    } else {
      // 通过用户名查询用户ID
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [id, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetUserId = users[0].id;
    }
    
    try {
      const [following] = await query(
        `SELECT u.id, u.username, u.nickname, u.avatar, u.online_status
         FROM user_follows uf
         JOIN users u ON uf.following_id = u.id
         WHERE uf.follower_id = ? AND u.status = 'active'
         ORDER BY uf.created_at DESC`,
        [targetUserId]
      );
      
      res.json({ following: Array.isArray(following) ? following : [] });
    } catch (followError) {
      console.error('获取关注列表失败:', followError);
      res.json({ following: [] });
    }
  } catch (error) {
    next(error);
  }
});

// 获取粉丝列表
router.get('/follows/followers', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    try {
      const [followers] = await query(
        `SELECT u.id, u.username, u.nickname, u.avatar, u.online_status
         FROM user_follows uf
         JOIN users u ON uf.follower_id = u.id
         WHERE uf.following_id = ? AND u.status = 'active'
         ORDER BY uf.created_at DESC`,
        [userId]
      );
      
      res.json({ followers: Array.isArray(followers) ? followers : [] });
    } catch (followError) {
      console.error('获取粉丝列表失败:', followError);
      res.json({ followers: [] });
    }
  } catch (error) {
    next(error);
  }
});

// 获取指定用户的粉丝列表
router.get('/:id/followers', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(id);
    let targetUserId;
    
    if (isNumeric) {
      targetUserId = parseInt(id);
    } else {
      // 通过用户名查询用户ID
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [id, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetUserId = users[0].id;
    }
    
    try {
      const [followers] = await query(
        `SELECT u.id, u.username, u.nickname, u.avatar, u.online_status
         FROM user_follows uf
         JOIN users u ON uf.follower_id = u.id
         WHERE uf.following_id = ? AND u.status = 'active'
         ORDER BY uf.created_at DESC`,
        [targetUserId]
      );
      
      res.json({ followers: Array.isArray(followers) ? followers : [] });
    } catch (followError) {
      console.error('获取粉丝列表失败:', followError);
      res.json({ followers: [] });
    }
  } catch (error) {
    next(error);
  }
});

// 获取用户获赞列表
router.get('/likes', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    try {
      const [likes] = await query(
        `SELECT pl.id, pl.created_at,
                u.id as user_id, u.username, u.nickname, u.avatar,
                p.id as post_id, p.content, p.post_type, p.images, p.video_url,
                p.link_title, p.link_description, p.link_image_url, p.link_url,
                p.poll_options, p.poll_votes, p.poll_expire_at, p.poll_type,
                p.links
         FROM post_likes pl
         JOIN posts p ON pl.post_id = p.id
         JOIN users u ON pl.user_id = u.id
         WHERE p.user_id = ? AND p.status = 'active'
         ORDER BY pl.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        [userId]
      );
      
      const [countResult] = await query(
        `SELECT COUNT(*) as total
         FROM post_likes pl
         JOIN posts p ON pl.post_id = p.id
         WHERE p.user_id = ? AND p.status = 'active'`,
        [userId]
      );
      
      const formattedLikes = likes.map(like => {
        let images = [];
        try {
          images = typeof like.images === 'string' ? JSON.parse(like.images) : (like.images || []);
        } catch (e) {
          images = [];
        }

        let linkInfo = null;
        if (like.link_url || like.link_title) {
          linkInfo = {
            title: like.link_title,
            description: like.link_description,
            image_url: like.link_image_url,
            url: like.link_url
          };
        }

        let pollInfo = null;
        if (like.poll_options) {
          let pollOptions = [];
          try {
            pollOptions = typeof like.poll_options === 'string' ? JSON.parse(like.poll_options) : (like.poll_options || []);
          } catch (e) {
            pollOptions = [];
          }

          let pollVotes = {};
          try {
            pollVotes = typeof like.poll_votes === 'string' ? JSON.parse(like.poll_votes) : (like.poll_votes || {});
          } catch (e) {
            pollVotes = {};
          }

          if (pollOptions.length >= 2) {
            pollInfo = {
              options: pollOptions,
              votes: pollVotes,
              expire_at: like.poll_expire_at,
              type: like.poll_type
            };
          }
        }

        let links = [];
        try {
          links = typeof like.links === 'string' ? JSON.parse(like.links) : (like.links || []);
        } catch (e) {
          links = [];
        }

        return {
          id: like.id,
          created_at: like.created_at,
          user: {
            id: like.user_id,
            username: like.username,
            nickname: like.nickname,
            avatar: like.avatar
          },
          post: {
            id: like.post_id,
            content: like.content,
            post_type: like.post_type,
            images,
            video_url: like.video_url,
            link_info: linkInfo,
            poll_info: pollInfo,
            links
          }
        };
      });
      
      res.json({
        likes: formattedLikes,
        total: countResult[0]?.total || 0,
        page,
        limit
      });
    } catch (likeError) {
      console.error('获取获赞列表失败:', likeError);
      res.json({ likes: [], total: 0, page, limit });
    }
  } catch (error) {
    next(error);
  }
});

// 获取指定用户的获赞列表
router.get('/:id/likes', async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // 判断是数字ID还是用户名
    const isNumeric = /^\d+$/.test(id);
    let targetUserId;
    
    if (isNumeric) {
      targetUserId = parseInt(id);
    } else {
      // 通过用户名查询用户ID
      const [users] = await query(
        'SELECT id FROM users WHERE username = ? AND status = ?',
        [id, 'active']
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      targetUserId = users[0].id;
    }
    
    try {
      const [likes] = await query(
        `SELECT pl.id, pl.created_at,
                u.id as user_id, u.username, u.nickname, u.avatar,
                p.id as post_id, p.content, p.post_type, p.images, p.video_url,
                p.link_info, p.poll_info, p.links
         FROM post_likes pl
         JOIN posts p ON pl.post_id = p.id
         JOIN users u ON pl.user_id = u.id
         WHERE p.user_id = ? AND p.status = 'active'
         ORDER BY pl.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        [targetUserId]
      );
      
      const [countResult] = await query(
        `SELECT COUNT(*) as total
         FROM post_likes pl
         JOIN posts p ON pl.post_id = p.id
         WHERE p.user_id = ? AND p.status = 'active'`,
        [targetUserId]
      );
      
      const formattedLikes = likes.map(like => {
        let images = [];
        try {
          images = typeof like.images === 'string' ? JSON.parse(like.images) : (like.images || []);
        } catch (e) {
          images = [];
        }

        let linkInfo = null;
        try {
          linkInfo = typeof like.link_info === 'string' ? JSON.parse(like.link_info) : like.link_info;
        } catch (e) {
          linkInfo = null;
        }

        let pollInfo = null;
        try {
          pollInfo = typeof like.poll_info === 'string' ? JSON.parse(like.poll_info) : like.poll_info;
        } catch (e) {
          pollInfo = null;
        }

        let links = [];
        try {
          links = typeof like.links === 'string' ? JSON.parse(like.links) : (like.links || []);
        } catch (e) {
          links = [];
        }

        return {
          id: like.id,
          created_at: like.created_at,
          user: {
            id: like.user_id,
            username: like.username,
            nickname: like.nickname,
            avatar: like.avatar
          },
          post: {
            id: like.post_id,
            content: like.content,
            post_type: like.post_type,
            images,
            video_url: like.video_url,
            link_info: linkInfo,
            poll_info: pollInfo,
            links
          }
        };
      });
      
      res.json({
        likes: formattedLikes,
        total: countResult[0]?.total || 0,
        page,
        limit
      });
    } catch (likeError) {
      console.error('获取获赞列表失败:', likeError);
      res.json({ likes: [], total: 0, page, limit });
    }
  } catch (error) {
    next(error);
  }
});

// 检查是否已关注
router.get('/follows/check/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;
    
    try {
      const [result] = await query(
        `SELECT COUNT(*) as is_following
         FROM user_follows 
         WHERE follower_id = ? AND following_id = ?`,
        [followerId, userId]
      );
      
      res.json({ is_following: result[0].is_following > 0 });
    } catch (followError) {
      console.error('检查关注状态失败:', followError);
      // 如果表不存在，返回未关注状态
      res.json({ is_following: false });
    }
  } catch (error) {
    next(error);
  }
});

// 获取互相关注好友列表
router.get('/follows/mutual', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    try {
      const [mutual] = await query(
        `SELECT u.id, u.username, u.nickname, u.avatar
         FROM user_follows uf1
         JOIN user_follows uf2 ON uf1.following_id = uf2.follower_id AND uf1.follower_id = uf2.following_id
         JOIN users u ON uf1.following_id = u.id
         WHERE uf1.follower_id = ? AND u.status = 'active' AND u.is_visible = 1
         ORDER BY uf1.created_at DESC`,
        [userId]
      );
      
      res.json({ mutual: Array.isArray(mutual) ? mutual : [] });
    } catch (followError) {
      console.error('获取互相关注列表失败:', followError);
      // 如果表不存在，返回空列表
      res.json({ mutual: [] });
    }
  } catch (error) {
    next(error);
  }
});

// 好友推荐
router.get('/friends/recommendations', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    try {
      const { getFriendRecommendations } = await import('../utils/recommendAlgorithm.js');
      const recommendations = await getFriendRecommendations(userId, limit);
      
      // 格式化返回结果
      const formattedRecommendations = recommendations.map(item => ({
        user: {
          id: item.user.id,
          username: item.user.username,
          nickname: item.user.nickname,
          avatar: item.user.avatar,

          online_status: item.user.online_status
        },
        common_friends: item.common_friends,
        score: item.score
      }));
      
      res.json({ recommendations: formattedRecommendations });
    } catch (recommendError) {
      console.error('好友推荐失败:', recommendError);
      // 如果推荐算法执行失败（如表不存在），返回空列表
      res.json({ recommendations: [] });
    }
  } catch (error) {
    console.error('好友推荐接口失败:', error);
    res.json({ recommendations: [] });
  }
});

// 获取默认头像
router.get('/avatar/default/:char', (req, res) => {
  try {
    let char = 'U';
    if (req.params.char && req.params.char.length > 0) {
      char = req.params.char.charAt(0).toUpperCase();
    }
    
    // 确保是有效的字母或数字，否则默认为 'U'
    if (!/[A-Z0-9]/.test(char)) {
      char = 'U';
    }
    
    const fontSize = 100;
    const backgroundColor = `hsl(${char.charCodeAt(0) * 137.5 % 360}, 70%, 60%)`;
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    
    // 绘制背景
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, 200, 200);
    
    // 绘制文字
    ctx.fillStyle = '#ffffff';
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, 100, 100);
    
    // 发送图片
    res.setHeader('Content-Type', 'image/png');
    canvas.createPNGStream().pipe(res);
  } catch (error) {
    console.error('生成默认头像失败:', error);
    res.status(500).json({ error: '生成默认头像失败' });
  }
});

// 获取发帖点赞最多的人
router.get('/likes/ranking', authenticate, cacheMiddleware(60), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    
    const [ranking] = await query(
      `SELECT u.id as user_id, u.username, u.nickname, u.avatar,
              SUM(p.like_count) as total_likes,
              CASE WHEN u.id = ? THEN 1 ELSE 0 END as is_current_user
       FROM users u
       LEFT JOIN posts p ON u.id = p.user_id
       WHERE u.status = 'active' AND u.is_visible = 1 AND p.status = 'active' AND p.is_visible = 1
       GROUP BY u.id, u.username, u.nickname, u.avatar
       HAVING total_likes > 0
       ORDER BY total_likes DESC, u.created_at ASC
       LIMIT ?`,
      [userId, limit]
    );
    
    res.json({ ranking: Array.isArray(ranking) ? ranking : [] });
  } catch (error) {
    next(error);
  }
});

// 获取赞助最多的人
router.get('/sponsorship/ranking', authenticate, cacheMiddleware(60), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    
    const [ranking] = await query(
      `SELECT u.id as user_id, u.username, u.nickname, u.avatar,
              COALESCE(SUM(s.amount), 0) as total_sponsorship,
              CASE WHEN u.id = ? THEN 1 ELSE 0 END as is_current_user
       FROM users u
       LEFT JOIN sponsorships s ON u.id = s.user_id AND s.status = 'completed' AND s.is_visible = 1
       WHERE u.status = 'active' AND u.is_visible = 1
       GROUP BY u.id, u.username, u.nickname, u.avatar
       HAVING total_sponsorship > 0
       ORDER BY total_sponsorship DESC, u.created_at ASC
       LIMIT ?`,
      [userId, limit]
    );
    
    res.json({ ranking: Array.isArray(ranking) ? ranking : [] });
  } catch (error) {
    next(error);
  }
});

// 获取用户资料
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    console.log('获取用户信息，参数:', id);
    
    // 判断是数字ID还是用户名
    // 优先使用用户名查询，因为用户名可能是数字
    const isNumeric = /^\d+$/.test(id);
    let whereClause, whereValue;
    
    if (isNumeric) {
      // 先尝试用用户名查询（因为用户名可能是数字）
      const [usersByUsername] = await query(
        `SELECT id, username, nickname, avatar, background_image, gender, location, bio,
                interest_tags, created_at, last_login_at, online_status, privacy_settings, is_guest,
                posts_visibility, likes_visibility, following_visibility, followers_visibility
         FROM users WHERE username = ? AND status = 'active' AND is_visible = 1`,
        [id]
      );
      
      if (usersByUsername && usersByUsername.length > 0) {
        return processUserInfo(res, usersByUsername[0]);
      }
      
      // 如果用户名查询失败，再尝试用ID查询
      whereClause = 'id = ?';
      whereValue = parseInt(id);
    } else {
      // 使用用户名查询
      whereClause = 'username = ?';
      whereValue = id;
    }
    
    console.log('查询条件:', whereClause, '值:', whereValue);
    
    // 简化查询，只查询存在的字段
    const [users] = await query(
      `SELECT id, username, nickname, avatar, background_image, gender, location, bio,
              interest_tags, created_at, last_login_at, online_status, privacy_settings, is_guest,
              posts_visibility, likes_visibility, following_visibility, followers_visibility
       FROM users WHERE ${whereClause} AND status = 'active' AND is_visible = 1`,
      [whereValue]
    );

    console.log('查询结果数量:', users ? users.length : 0);

    if (!users || users.length === 0) {
      console.log('用户不存在，返回404');
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];
    return processUserInfo(res, user);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

async function processUserInfo(res, user) {
  try {
    if (user.privacy_settings) {
      const raw = user.privacy_settings;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      user.privacy = {
        locationVisibility: parsed.location_visibility || 'public'
      };
    } else {
      user.privacy = {
        locationVisibility: 'public'
      };
    }
  } catch (error) {
    user.privacy = {
      locationVisibility: 'public'
    };
  }
  
  try {
    user.interest_tags = user.interest_tags ? JSON.parse(user.interest_tags) : [];
  } catch (error) {
    user.interest_tags = [];
  }

  // 获取统计信息
  const stats = await getUserStats(user.id);

  // 初始化默认在线信息
  const onlineInfo = {
    last_active_time: new Date().toISOString()
  };

  res.json({
    user,
    stats,
    onlineInfo
  });
}

export default router;
