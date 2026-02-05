import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query, transaction } from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';
import { getUserRoles } from '../middleware/permission.js';
import { getUserStats } from '../services/userService.js';
import rateLimit from 'express-rate-limit';
import { getLocationByIP, getClientIP, getRateLimitKey } from '../utils/ipGeoLocation.js';
import { ensureDefaultTasks } from '../utils/taskManager.js';

const router = express.Router();

const loginAttemptCounts = new Map();

function getLoginAttemptsKey(req) {
  return getRateLimitKey(req);
}

function checkLoginAttempts(key) {
  const now = Date.now();
  const record = loginAttemptCounts.get(key);

  if (!record) {
    return { count: 0, resetTime: now };
  }

  const { count, timestamp } = record;

  if (now - timestamp > 60 * 1000) {
    loginAttemptCounts.delete(key);
    return { count: 0, resetTime: now };
  }

  return { count, resetTime: timestamp + 60 * 1000 };
}

function incrementLoginAttempts(key) {
  const now = Date.now();
  const record = loginAttemptCounts.get(key);

  if (!record || now - record.timestamp > 60 * 1000) {
    loginAttemptCounts.set(key, { count: 1, timestamp: now });
    return 1;
  }

  record.count += 1;
  loginAttemptCounts.set(key, record);
  return record.count;
}

function resetLoginAttempts(key) {
  loginAttemptCounts.delete(key);
}

const loginBanStore = new Map();

function getBanStatus(req) {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const banRecord = loginBanStore.get(key);

  if (!banRecord) {
    return { banned: false, remainingTime: 0 };
  }

  if (now - banRecord.timestamp > 10 * 60 * 1000) {
    loginBanStore.delete(key);
    return { banned: false, remainingTime: 0 };
  }

  const remainingTime = Math.ceil((banRecord.timestamp + 10 * 60 * 1000 - now) / 1000);
  return { banned: true, remainingTime };
}

function setBan(req) {
  const key = getRateLimitKey(req);
  loginBanStore.set(key, { timestamp: Date.now() });
}

// 登录限流
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '登录尝试次数过多，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getRateLimitKey(req),
});

// 用户注册
router.post('/register', async (req, res, next) => {
  try {
    const { username, nickname, phone, email, password, interestTags } = req.body;

    // 验证必填字段
    if (!username || !nickname || !phone || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    // 验证格式
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '账号长度必须在3-20位之间' });
    }

    if (nickname.length < 2 || nickname.length > 20) {
      return res.status(400).json({ error: '昵称长度必须在2-20位之间' });
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    if (password.length < 8 || password.length > 20 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: '密码必须包含字母和数字，长度8-20位' });
    }

    // 检查唯一性
    const [existingUsers] = await query(
      'SELECT id FROM users WHERE username = ? OR phone = ? OR email = ?',
      [username, phone, email]
    );

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: '账号、手机号或邮箱已被使用' });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 生成默认头像URL
    const initialChar = nickname && nickname.length > 0 ? nickname.charAt(0).toUpperCase() : 'U';
    const avatarUrl = `/api/user/avatar/default/${initialChar}`;

    // 获取客户端IP地址
    const clientIP = getClientIP(req);
    let location = null;
    
    // 尝试根据IP获取地理位置
    try {
      const geoLocation = await getLocationByIP(clientIP);
      if (geoLocation) {
        location = geoLocation.fullLocation;
      }
    } catch (error) {
      console.error('获取用户位置失败:', error);
    }

    // 插入用户
    const result = await transaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO users (username, nickname, phone, email, password_hash, avatar, location, interest_tags, online_status, last_login_at, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [username, nickname, phone, email, passwordHash, avatarUrl, location, JSON.stringify(interestTags || []), 'online']
      );

      return result.insertId;
    });

    // 为新用户创建默认任务
    try {
      await ensureDefaultTasks(result);
      console.log(`✅ 为用户 ${username} 创建了默认任务`);
    } catch (taskError) {
      console.error('创建默认任务失败:', taskError);
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: result, username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result,
        username,
        nickname,
        avatar: avatarUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 游客登录
router.post('/guest-login', async (req, res, next) => {
  try {
    const guestId = Math.random().toString(36).substring(2, 10);
    const username = `guest_${guestId}`;
    const nickname = `游客_${guestId}`;
    
    // 生成默认头像URL
    const initialChar = 'G';
    const avatarUrl = `/api/user/avatar/default/${initialChar}`;

    // 获取客户端IP地址和位置
    const clientIP = getClientIP(req);
    let location = null;
    try {
      const geoLocation = await getLocationByIP(clientIP);
      if (geoLocation) location = geoLocation.fullLocation;
    } catch (error) {}

    // 插入游客用户
    const result = await transaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO users (username, nickname, avatar, location, is_guest, online_status, last_login_at, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [username, nickname, avatarUrl, location, true, 'online']
      );
      return result.insertId;
    });

    // 为游客创建默认任务
    try {
      await ensureDefaultTasks(result);
    } catch (taskError) {}

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: result, username, isGuest: true },
      config.jwt.secret,
      { expiresIn: config.jwt.rememberMeExpiresIn || '30d' } // 游客Token有效期延长，保持登录状态
    );

    res.json({
      message: '游客登录成功',
      token,
      user: {
        id: result,
        username,
        nickname,
        avatar: avatarUrl,
        isGuest: true
      }
    });
  } catch (error) {
    next(error);
  }
});

// 游客转正式用户
router.post('/upgrade-guest', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username, nickname, phone, email, password } = req.body;

    // 验证必填字段
    if (!username || !nickname || !password) {
      return res.status(400).json({ error: '请填写用户名、昵称和密码' });
    }

    // 验证格式 (复用注册逻辑)
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: '账号长度必须在3-20位之间' });
    if (nickname.length < 2 || nickname.length > 20) return res.status(400).json({ error: '昵称长度必须在2-20位之间' });
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });
    if (password.length < 8 || password.length > 20 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: '密码必须包含字母和数字，长度8-20位' });
    }

    // 检查该用户是否真的是游客
    const [currentUser] = await query('SELECT is_guest FROM users WHERE id = ?', [userId]);
    if (!currentUser || !currentUser[0].is_guest) {
      return res.status(400).json({ error: '该用户不是游客或已是正式用户' });
    }

    // 检查唯一性
    const conditions = [];
    const params = [username];
    
    let uniqueCheckSql = 'SELECT id FROM users WHERE (username = ?';
    
    if (phone) {
      uniqueCheckSql += ' OR phone = ?';
      params.push(phone);
    }
    if (email) {
      uniqueCheckSql += ' OR email = ?';
      params.push(email);
    }
    
    uniqueCheckSql += ') AND id != ?';
    params.push(userId);

    const [existingUsers] = await query(uniqueCheckSql, params);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: '账号、手机号或邮箱已被使用' });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 更新用户
    await query(
      `UPDATE users SET username = ?, nickname = ?, phone = ?, email = ?, password_hash = ?, is_guest = FALSE WHERE id = ?`,
      [username, nickname, phone || null, email || null, passwordHash, userId]
    );

    // 重新生成Token (因为username变了)
    const token = jwt.sign(
      { userId, username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      message: '升级成功',
      token,
      user: {
        id: userId,
        username,
        nickname,
        isGuest: false
      }
    });
  } catch (error) {
    next(error);
  }
});

// 用户登录
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const ipKey = getLoginAttemptsKey(req);

    const banStatus = getBanStatus(req);
    if (banStatus.banned) {
      return res.status(429).json({
        error: '登录尝试次数过多，请稍后再试',
        remainingTime: banStatus.remainingTime,
        retryAfter: banStatus.remainingTime
      });
    }

    const { account, password, rememberMe } = req.body;

    if (!account || !password) {
      return res.status(400).json({ error: '请提供账号和密码' });
    }

    // 查找用户（支持用户名、手机号、邮箱登录）
    const [users] = await query(
      `SELECT id, username, nickname, avatar, password_hash, status
       FROM users 
       WHERE username = ? OR phone = ? OR email = ?`,
      [account, account, account]
    );

    if (!users || users.length === 0) {
      incrementLoginAttempts(ipKey);
      const attempts = checkLoginAttempts(ipKey);
      if (attempts.count >= 10) {
        setBan(req);
        return res.status(429).json({
          error: '登录尝试次数过多，请稍后再试',
          remainingTime: 600,
          retryAfter: 600
        });
      }
      return res.status(401).json({ error: '账号不存在', remainingAttempts: Math.max(0, 10 - attempts.count) });
    }

    const user = users[0];
    
    // 如果用户没有密码（通常是未升级的游客），则不允许通过此接口登录
    if (!user.password_hash) {
      return res.status(401).json({ error: '该账号未设置密码，请使用其他方式登录或联系管理员' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: '账号已冻结' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      incrementLoginAttempts(ipKey);
      const attempts = checkLoginAttempts(ipKey);
      if (attempts.count >= 10) {
        setBan(req);
        return res.status(429).json({
          error: '登录尝试次数过多，请稍后再试',
          remainingTime: 600,
          retryAfter: 600
        });
      }
      return res.status(401).json({ error: '密码错误', remainingAttempts: Math.max(0, 10 - attempts.count) });
    }

    resetLoginAttempts(ipKey);

    // 获取客户端IP地址和地理位置
    const clientIP = getClientIP(req);
    let location = null;
    
    // 尝试根据IP获取地理位置
    try {
      const geoLocation = await getLocationByIP(clientIP);
      if (geoLocation) {
        location = geoLocation.fullLocation;
      }
    } catch (error) {
      console.error('获取用户位置失败:', error);
    }

    // 获取设备信息
    const userAgent = req.headers['user-agent'] || '';
    const device = userAgent.substring(0, 100);

    // 更新用户最后登录时间和在线状态
    await query('UPDATE users SET last_login_at = NOW(), online_status = ? WHERE id = ?', ['online', user.id]);

    // 记录登录日志
    try {
      await query(
        `INSERT INTO user_login_logs (user_id, login_time, ip, location, device) 
         VALUES (?, NOW(), ?, ?, ?)`,
        [user.id, clientIP, location, device]
      );
    } catch (logError) {
      console.error('记录登录日志失败:', logError);
    }

    // 生成JWT令牌
    const expiresIn = rememberMe ? config.jwt.rememberMeExpiresIn : config.jwt.expiresIn;
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      config.jwt.secret,
      { expiresIn }
    );

    // 获取用户角色
    const roles = await getUserRoles(user.id);

    res.json({
      message: '登录成功',
      token,
      expiresIn,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        // 将角色名转换为数组对象格式，以适配前端 isAdmin 计算属性
        roles: roles.map(r => ({ name: r.name })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 忘记密码
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { phone, email, newPassword } = req.body;

    if (!phone || !email || !newPassword) {
      return res.status(400).json({ error: '请填写所有字段' });
    }

    // 验证手机号和邮箱是否属于同一用户
    const [users] = await query(
      'SELECT id FROM users WHERE phone = ? AND email = ?',
      [phone, email]
    );

    if (!users || users.length === 0) {
      return res.status(400).json({ error: '信息不匹配' });
    }

    // 验证新密码格式
    if (newPassword.length < 8 || newPassword.length > 20 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ error: '密码必须包含字母和数字，长度8-20位' });
    }

    // 更新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE phone = ? AND email = ?', [passwordHash, phone, email]);

    res.json({ message: '密码已重置成功' });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res, next) => {
  try {
    // 更新用户最后登录时间 (对游客尤为重要，防止被清理)
    await query('UPDATE users SET last_login_at = NOW(), online_status = ? WHERE id = ?', ['online', req.user.id]);

    const [users] = await query(
      `SELECT id, username, nickname, avatar, email, phone, gender, location, bio, 
              interest_tags, created_at, last_login_at, online_status,
              background_image, privacy_settings, is_guest,
              posts_visibility, likes_visibility, following_visibility, followers_visibility
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    console.log('查询结果数量:', users ? users.length : 0);

    if (!users || users.length === 0) {
      console.log('用户不存在，返回404');
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];

    try {
      if (typeof user.interest_tags === 'string') {
        user.interest_tags = JSON.parse(user.interest_tags || '[]');
      } else if (!Array.isArray(user.interest_tags)) {
        user.interest_tags = [];
      }
    } catch (error) {
      user.interest_tags = [];
    }

    try {
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

      if (user.privacy_settings) {
        const raw = user.privacy_settings;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

        user.privacy = {
          locationVisibility: normalizeVisibility(parsed.locationVisibility ?? parsed.location_visibility, 'public'),
          profileVisibility: normalizeVisibility(parsed.profileVisibility ?? parsed.profile_visibility, 'public'),
          onlineStatus: normalizeVisibility(parsed.onlineStatus ?? parsed.online_status, 'friends'),
          lastSeen: normalizeVisibility(parsed.lastSeen ?? parsed.last_seen, 'friends'),
          dynamicVisibility: normalizeVisibility(parsed.dynamicVisibility ?? parsed.dynamic_visibility, 'public')
        };
      } else {
        user.privacy = {
          locationVisibility: 'public',
          profileVisibility: 'public',
          onlineStatus: 'friends',
          lastSeen: 'friends',
          dynamicVisibility: 'public'
        };
      }
    } catch (error) {
      user.privacy = {
        locationVisibility: 'public',
        profileVisibility: 'public',
        onlineStatus: 'friends',
        lastSeen: 'friends',
        dynamicVisibility: 'public'
      };
    }

    // 获取统计信息
    const stats = await getUserStats(req.user.id);

    // 初始化默认在线信息
    const onlineInfo = {
      last_active_time: new Date().toISOString()
    };

    // 获取用户角色
    const roles = await getUserRoles(req.user.id);
    // 将角色名转换为数组对象格式，以适配前端 isAdmin 计算属性
    user.roles = roles.map(r => ({ name: r.name }));

    res.json({
      user,
      stats,
      onlineInfo
    });
  } catch (error) {
    next(error);
  }
});

export default router;
