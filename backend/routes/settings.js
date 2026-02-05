import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { redisUtils } from '../database/redis.js';
import { addPoints, POINTS_REWARDS } from '../services/pointsService.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/chat_backgrounds');
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  },
});

// 上传聊天背景
router.post('/chat/background', authenticate, upload.single('background'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }

    const fileUrl = `/uploads/chat_backgrounds/${req.file.filename}`;
    res.json({ message: '背景上传成功', url: fileUrl });
  } catch (error) {
    next(error);
  }
});

// 应用背景到所有聊天
router.put('/chat/background/all', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { backgroundImage } = req.body;

    // 更新该用户所有的聊天背景
    // 注意：这里更新已有的记录，同时也可能需要一种方式让新生成的会话也默认使用这个背景
    // 为了简单起见，我们先更新所有已存在的 chat_settings 记录
    await query(
      `UPDATE chat_settings SET background_image = ?, updated_at = NOW() WHERE user_id = ?`,
      [backgroundImage, userId]
    );

    // 此外，我们可以考虑在 users 表中存一个全局默认背景字段，或者在这里插入/更新一个 conversation_id 为 NULL 的记录作为默认设置
    await query(
      `INSERT INTO chat_settings (user_id, conversation_id, background_image, updated_at)
       VALUES (?, NULL, ?, NOW())
       ON DUPLICATE KEY UPDATE
       background_image = VALUES(background_image),
       updated_at = NOW()`,
      [userId, backgroundImage]
    );

    res.json({ message: '已应用到所有聊天' });
  } catch (error) {
    next(error);
  }
});

// 聊天设置表（需要在数据库中创建）
// CREATE TABLE IF NOT EXISTS chat_settings (
//   id BIGINT PRIMARY KEY AUTO_INCREMENT,
//   user_id BIGINT NOT NULL,
//   conversation_id VARCHAR(100) DEFAULT NULL,
//   is_pinned BOOLEAN DEFAULT FALSE,
//   is_muted BOOLEAN DEFAULT FALSE,
//   background_image VARCHAR(255) DEFAULT NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   UNIQUE KEY uk_user_conversation (user_id, conversation_id),
//   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
// );

// 获取聊天设置
router.get('/chat', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.query;

    let sql = 'SELECT * FROM chat_settings WHERE user_id = ?';
    const params = [userId];

    if (conversationId) {
      sql += ' AND (conversation_id = ? OR conversation_id IS NULL)';
      params.push(conversationId);
    }

    const [settings] = await query(sql, params);

    res.json({ settings: settings || [] });
  } catch (error) {
    // 如果表不存在，返回默认设置
    res.json({ settings: [] });
  }
});

// 更新聊天设置
router.put('/chat/:conversationId', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { isPinned, isMuted, backgroundImage } = req.body;

    // 检查表是否存在，如果不存在则创建
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS chat_settings (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          conversation_id VARCHAR(100) DEFAULT NULL,
          is_pinned BOOLEAN DEFAULT FALSE,
          is_muted BOOLEAN DEFAULT FALSE,
          background_image VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_user_conversation (user_id, conversation_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (e) {
      // 表已存在，继续
    }

    // 更新或插入设置
    await query(
      `INSERT INTO chat_settings (user_id, conversation_id, is_pinned, is_muted, background_image, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
       is_pinned = VALUES(is_pinned),
       is_muted = VALUES(is_muted),
       background_image = VALUES(background_image),
       updated_at = NOW()`,
      [userId, conversationId, isPinned || false, isMuted || false, backgroundImage || null]
    );

    res.json({ message: '设置更新成功' });
  } catch (error) {
    next(error);
  }
});

// 获取用户设置
router.get('/user', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    let users;
    try {
      const [result] = await query(
        `SELECT privacy_settings, notification_settings, default_landing_page,
                posts_visibility, likes_visibility, following_visibility, followers_visibility
         FROM users WHERE id = ?`,
        [userId]
      );
      users = result;
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        try {
          const [result] = await query(
            'SELECT privacy_settings, notification_settings, default_landing_page FROM users WHERE id = ?',
            [userId]
          );
          users = result;
        } catch (innerError) {
          if (innerError.code === 'ER_BAD_FIELD_ERROR') {
            const [result] = await query(
              'SELECT privacy_settings, notification_settings FROM users WHERE id = ?',
              [userId]
            );
            users = result;
          } else {
            throw innerError;
          }
        }
      } else {
        throw error;
      }
    }

    const user = Array.isArray(users) ? users[0] : users || {};

    const parseJsonField = (value, defaultValue) => {
      if (!value) {
        return defaultValue;
      }
      try {
        if (typeof value === 'string') {
          return JSON.parse(value);
        }
        if (typeof value === 'object') {
          return value;
        }
        return defaultValue;
      } catch {
        return defaultValue;
      }
    };

    const rawPrivacy = parseJsonField(user?.privacy_settings, {});

    const normalizeVisibility = (value, fallback) => {
      if (value === 'all') {
        return 'public';
      }
      if (value === undefined || value === null || value === '') {
        return fallback;
      }
      if (value === true) {
        return fallback;
      }
      if (value === false) {
        return 'private';
      }
      if (['public', 'friends', 'private'].includes(value)) {
        return value;
      }
      return fallback;
    };

    const settings = {
      privacy: {
        profileVisibility: normalizeVisibility(rawPrivacy.profileVisibility ?? rawPrivacy.profile_visibility, 'public'),
        onlineStatus: normalizeVisibility(rawPrivacy.onlineStatus ?? rawPrivacy.online_status, 'friends'),
        lastSeen: normalizeVisibility(rawPrivacy.lastSeen ?? rawPrivacy.last_seen, 'friends'),
        locationVisibility: normalizeVisibility(rawPrivacy.locationVisibility ?? rawPrivacy.location_visibility, 'public'),
      },
      postsVisibility: user?.posts_visibility || 'public',
      likesVisibility: user?.likes_visibility || 'public',
      followingVisibility: user?.following_visibility || 'public',
      followersVisibility: user?.followers_visibility || 'public',
      notification: parseJsonField(user?.notification_settings, {
        like: true,
        comment: true,
        message: true,
        match: true,
      }),
      defaultLandingPage: user?.default_landing_page || 'home',
    };

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

// 更新用户设置
router.put('/user', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { privacy, notification, defaultLandingPage } = req.body;

    const updates = [];
    const params = [];

    if (privacy) {
      // 将隐私设置保存到单独的字段中
      if (privacy.profileVisibility !== undefined) {
        updates.push('privacy_settings = ?');
        params.push(JSON.stringify(privacy));
      }
      if (privacy.postsVisibility !== undefined) {
        updates.push('posts_visibility = ?');
        params.push(privacy.postsVisibility);
      }
      if (privacy.likesVisibility !== undefined) {
        updates.push('likes_visibility = ?');
        params.push(privacy.likesVisibility);
      }
      if (privacy.followingVisibility !== undefined) {
        updates.push('following_visibility = ?');
        params.push(privacy.followingVisibility);
      }
      if (privacy.followersVisibility !== undefined) {
        updates.push('followers_visibility = ?');
        params.push(privacy.followersVisibility);
      }
    }

    if (notification) {
      updates.push('notification_settings = ?');
      params.push(JSON.stringify(notification));
    }

    if (defaultLandingPage) {
      updates.push('default_landing_page = ?');
      params.push(defaultLandingPage);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的设置' });
    }

    try {
      params.push(userId);
      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        if (privacy) {
          await query('ALTER TABLE users ADD COLUMN privacy_settings JSON DEFAULT NULL');
        }
        if (notification) {
          await query('ALTER TABLE users ADD COLUMN notification_settings JSON DEFAULT NULL');
        }
        if (defaultLandingPage) {
          await query('ALTER TABLE users ADD COLUMN default_landing_page VARCHAR(50) DEFAULT "home"');
        }
        if (privacy?.postsVisibility !== undefined) {
          await query('ALTER TABLE users ADD COLUMN posts_visibility ENUM("public", "friends", "private") DEFAULT "public"');
        }
        if (privacy?.likesVisibility !== undefined) {
          await query('ALTER TABLE users ADD COLUMN likes_visibility ENUM("public", "friends", "private") DEFAULT "public"');
        }
        if (privacy?.followingVisibility !== undefined) {
          await query('ALTER TABLE users ADD COLUMN following_visibility ENUM("public", "friends", "private") DEFAULT "public"');
        }
        if (privacy?.followersVisibility !== undefined) {
          await query('ALTER TABLE users ADD COLUMN followers_visibility ENUM("public", "friends", "private") DEFAULT "public"');
        }
        await query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      } else {
        throw error;
      }
    }

    res.json({ message: '设置更新成功' });
  } catch (error) {
    next(error);
  }
});

router.post('/checkin', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = `checkin:done:${userId}:${today.toISOString().slice(0, 10)}`;

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS user_checkins (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL COMMENT '用户ID',
          consecutive_days INT DEFAULT 1 COMMENT '连续签到天数',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户签到表'
      `);
    } catch (e) {
      console.warn('创建 user_checkins 表失败:', e.message || e);
    }

    let redisExists = 0;
    try {
      redisExists = await redisUtils.exists(todayKey);
    } catch (e) {
      console.warn('Redis 检查签到状态失败:', e.message || e);
    }

    if (redisExists) {
      return res.status(400).json({ error: '今日已签到' });
    }

    const [rows] = await query(
      `SELECT consecutive_days, created_at 
       FROM user_checkins 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    let consecutiveDays = 1;

    if (Array.isArray(rows) && rows.length > 0) {
      const last = rows[0];
      const lastDate = new Date(last.created_at);
      const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
      const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return res.status(400).json({ error: '今日已签到' });
      }

      if (diffDays === 1) {
        consecutiveDays = (last.consecutive_days || 1) + 1;
      }
    }

    await query(
      `INSERT INTO user_checkins (user_id, consecutive_days, created_at)
       VALUES (?, ?, NOW())`,
      [userId, consecutiveDays]
    );

    let totalPointsEarned = 0;

    const basePoints = Number(POINTS_REWARDS.DAILY_CHECKIN) || 0;
    const increment = Number(POINTS_REWARDS.DAILY_CHECKIN_INCREMENT) || 0;
    const maxPoints = Number(POINTS_REWARDS.DAILY_CHECKIN_MAX) || 0;

    const computed = Math.min(basePoints + Math.max(0, consecutiveDays - 1) * increment, maxPoints || Infinity);
    if (computed > 0) {
      await addPoints(userId, computed, 'earn', `每日签到（连续${consecutiveDays}天）`);
      totalPointsEarned += computed;
    }
    try {
      await redisUtils.set(todayKey, true, 86400);
    } catch (e) {
      console.warn('Redis 记录签到结果失败:', e.message || e);
    }

    const [pointsRows] = await query(
      `SELECT points FROM users WHERE id = ?`,
      [userId]
    );

    const currentPoints = Array.isArray(pointsRows) ? pointsRows[0]?.points || 0 : pointsRows?.points || 0;

    res.json({
      message: '签到成功',
      pointsEarned: totalPointsEarned,
      consecutiveDays,
      todayCheckedIn: true,
      points: currentPoints,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/checkin/status', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = `checkin:done:${userId}:${today.toISOString().slice(0, 10)}`;

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS user_checkins (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL COMMENT '用户ID',
          consecutive_days INT DEFAULT 1 COMMENT '连续签到天数',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户签到表'
      `);
    } catch (e) {
      console.warn('创建 user_checkins 表失败:', e.message || e);
    }

    let checkedInToday = false;
    let redisExists = 0;

    try {
      redisExists = await redisUtils.exists(todayKey);
      if (redisExists) {
        checkedInToday = true;
      }
    } catch (e) {
      console.warn('Redis 获取签到状态失败:', e.message || e);
    }

    const [rows] = await query(
      `SELECT consecutive_days, created_at 
       FROM user_checkins 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    let consecutiveDays = 0;
    let lastCheckinDate = null;

    if (Array.isArray(rows) && rows.length > 0) {
      const last = rows[0];
      consecutiveDays = last.consecutive_days || 0;
      lastCheckinDate = last.created_at;

      if (!checkedInToday) {
        const lastDate = new Date(last.created_at);
        const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
          checkedInToday = true;
          try {
            await redisUtils.set(todayKey, true, 86400);
          } catch (e) {
            console.warn('Redis 回填签到状态失败:', e.message || e);
          }
        }
      }
    }

    res.json({
      checkedInToday,
      consecutiveDays,
      lastCheckinDate,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
