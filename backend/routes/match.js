import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { redisUtils } from '../database/redis.js';
import { calculateMatchScore } from '../utils/matchAlgorithm.js';
import { consumePoints, POINTS_COSTS } from '../services/pointsService.js';
import { logSystem } from '../utils/logger.js';

const router = express.Router();

// 获取匹配设置
router.get('/settings', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [settings] = await query(
      `SELECT * FROM match_settings WHERE user_id = ?`,
      [userId]
    );
    
    if (settings && settings.length > 0) {
      return res.json({ settings: settings[0] });
    }
    
    // 返回默认设置
    res.json({ 
      settings: {
        min_age: 18,
        max_age: 80,
        enable_age_range: true,
        preferred_gender: 'both',
        preferred_location: null,
        distance_range: 50,
        matching_mode: 'random',
        is_anonymous: 'all',
        use_anonymous: false
      }
    });
  } catch (error) {
    next(error);
  }
});

// 更新匹配设置
router.put('/settings', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { min_age, max_age, enable_age_range, preferred_gender, preferred_location, distance_range, matching_mode, is_anonymous, use_anonymous } = req.body;
    
    // 检查设置是否存在
    const [settings] = await query(
      `SELECT id FROM match_settings WHERE user_id = ?`,
      [userId]
    );
    
    if (settings && settings.length > 0) {
      // 更新现有设置
      await query(
        `UPDATE match_settings 
         SET min_age = ?, max_age = ?, enable_age_range = ?, preferred_gender = ?, preferred_location = ?, 
             distance_range = ?, matching_mode = ?, is_anonymous = ?, use_anonymous = ? 
         WHERE user_id = ?`,
        [min_age, max_age, enable_age_range, preferred_gender, preferred_location, distance_range, matching_mode, is_anonymous, use_anonymous, userId]
      );
    } else {
      // 创建新设置
      await query(
        `INSERT INTO match_settings (user_id, min_age, max_age, enable_age_range, preferred_gender, preferred_location, distance_range, matching_mode, is_anonymous, use_anonymous)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, min_age, max_age, enable_age_range, preferred_gender, preferred_location, distance_range, matching_mode, is_anonymous, use_anonymous]
      );
    }
    
    res.json({ message: '匹配设置已更新' });
  } catch (error) {
    next(error);
  }
});

// 开始匹配
router.post('/start', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { matching_mode, accelerate = false } = req.body;
    
    // 获取用户匹配设置
    const [dbSettings] = await query(
      `SELECT * FROM match_settings WHERE user_id = ?`,
      [userId]
    );
    
    // 合并设置：优先级为 请求参数 > 数据库设置 > 默认设置
    const matchSettings = {
      min_age: req.body.min_age ?? dbSettings?.[0]?.min_age ?? 18,
      max_age: req.body.max_age ?? dbSettings?.[0]?.max_age ?? 80,
      enable_age_range: req.body.enable_age_range ?? dbSettings?.[0]?.enable_age_range ?? true,
      preferred_gender: req.body.preferred_gender ?? dbSettings?.[0]?.preferred_gender ?? 'both',
      preferred_location: req.body.preferred_location ?? dbSettings?.[0]?.preferred_location ?? null,
      distance_range: req.body.distance_range ?? dbSettings?.[0]?.distance_range ?? 50,
      matching_mode: req.body.matching_mode ?? dbSettings?.[0]?.matching_mode ?? 'random',
      is_anonymous: req.body.is_anonymous ?? dbSettings?.[0]?.is_anonymous ?? 'all',
      use_anonymous: req.body.use_anonymous ?? dbSettings?.[0]?.use_anonymous ?? false
    };

    let estimatedWaitTime = 300;
    let pointsConsumed = 0;

    // 如果请求加速匹配
    if (accelerate) {
      // 获取用户插队次数
      const queueJumpKey = `match:queue_jump:${userId}`;
      const queueJumpCount = await redisUtils.get(queueJumpKey) || 0;
      
      // 计算本次插队消耗的积分：2 * 2^(插队次数)
      const pointsRequired = POINTS_COSTS.MATCH_QUEUE_JUMP * Math.pow(2, queueJumpCount);
      
      // 消耗积分
      await consumePoints(userId, pointsRequired, `匹配插队加速（第${queueJumpCount + 1}次）`);
      pointsConsumed = pointsRequired;
      
      // 更新插队次数
      await redisUtils.set(queueJumpKey, queueJumpCount + 1, 86400); // 24小时内有效
      
      // 加速匹配：设置更短的等待时间
      estimatedWaitTime = 30;
    }

    // 将用户加入匹配队列
    const matchQueueKey = 'match:queue';
    const currentUserId = Number(userId);
    const userMatchKey = `match:user:${currentUserId}`;
    
    // 将用户 ID 添加到全局匹配队列
    const queueData = await redisUtils.get(matchQueueKey) || [];
    // 统一存储格式为 ID (Number)
    const numericQueue = queueData.map(item => {
      const id = typeof item === 'object' && item !== null ? item.userId : item;
      return Number(id);
    }).filter(id => !isNaN(id));
    
    if (!numericQueue.includes(currentUserId)) {
      numericQueue.push(currentUserId);
      await redisUtils.set(matchQueueKey, numericQueue, 300);
    }
    
    await redisUtils.set(userMatchKey, {
      userId: currentUserId,
      matchSettings,
      timestamp: Date.now(),
      lastPerformMatch: Date.now(),
      accelerate: !!accelerate,
      queueJumpPriority: accelerate ? await redisUtils.get(`match:queue_jump:${currentUserId}`) || 0 : 0,
    }, 300);

    // 异步执行匹配算法
    setTimeout(async () => {
      try {
        await performMatch(currentUserId, matchSettings, !!accelerate);
        
        // 注意：这里不再自动从队列中移除用户
        // 只有匹配成功或手动取消时才移除
        // 这样如果第一次没匹配到，用户依然在队列中等待他人匹配
      } catch (error) {
        console.error('匹配算法错误:', error);
      }
    }, accelerate ? 500 : 1000); // 加速匹配更快开始

    res.json({
      message: '匹配已开始',
      estimatedWaitTime,
      accelerated: !!accelerate,
      pointsConsumed
    });
  } catch (error) {
    if (error.message === '积分不足') {
      return res.status(400).json({ error: '积分不足，无法加速匹配' });
    }
    next(error);
  }
});

// 加速匹配（单独端点）
router.post('/accelerate', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 检查是否正在匹配中
    const matchUserKey = `match:user:${userId}`;
    const isMatching = await redisUtils.get(matchUserKey);
    
    if (!isMatching) {
      return res.status(400).json({ error: '没有正在进行的匹配' });
    }
    
    // 获取用户插队次数
    const queueJumpKey = `match:queue_jump:${userId}`;
    const queueJumpCount = await redisUtils.get(queueJumpKey) || 0;
    
    // 计算本次插队消耗的积分：2 * 2^(插队次数)
    const pointsRequired = POINTS_COSTS.MATCH_QUEUE_JUMP * Math.pow(2, queueJumpCount);
    
    // 消耗积分
    await consumePoints(userId, pointsRequired, `匹配插队加速（第${queueJumpCount + 1}次）`);
    
    // 更新插队次数
    await redisUtils.set(queueJumpKey, queueJumpCount + 1, 86400); // 24小时内有效
    
    // 标记匹配为加速
    await redisUtils.set(matchUserKey, {
      ...isMatching,
      accelerate: true,
      queueJumpPriority: queueJumpCount + 1,
    }, 300);
    
    // 立即执行匹配算法
    const [settings] = await query(
      `SELECT * FROM match_settings WHERE user_id = ?`,
      [userId]
    );
    
    let matchSettings = {
      min_age: 18,
      max_age: 80,
      enable_age_range: true,
      preferred_gender: 'both',
      preferred_location: null,
      distance_range: 50,
      matching_mode: 'random',
      is_anonymous: 'all',
      use_anonymous: false
    };
    
    if (settings && settings.length > 0) {
      matchSettings = settings[0];
    }
    
    setTimeout(async () => {
      try {
        await performMatch(userId, matchSettings, true);
      } catch (error) {
        console.error('加速匹配算法错误:', error);
      }
    }, 500);
    
    res.json({
      message: '匹配加速成功',
      pointsConsumed: pointsRequired
    });
  } catch (error) {
    if (error.message === '积分不足') {
      return res.status(400).json({ error: '积分不足，无法加速匹配' });
    }
    next(error);
  }
});

// 取消匹配
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const matchUserKey = `match:user:${userId}`;
    const matchResultKey = `match:result:${userId}`;
    const matchQueueKey = 'match:queue';

    // 获取当前状态，用于日志记录
    const isMatching = await redisUtils.get(matchUserKey);
    const hasResult = await redisUtils.get(matchResultKey);
    
    // 如果没有任何匹配状态，直接返回成功（幂等性）
    if (!isMatching && !hasResult) {
      return res.json({ message: '匹配已取消' });
    }
    
    // 从匹配队列中移除用户
    const queueData = await redisUtils.get(matchQueueKey) || [];
    const updatedQueue = queueData.filter((item) => {
      const id = Number(typeof item === 'object' && item !== null ? item.userId : item);
      return id !== Number(userId);
    });
    
    // 只有在队列发生变化时才写回 Redis
    if (queueData.length !== updatedQueue.length) {
      await redisUtils.set(matchQueueKey, updatedQueue, 300);
    }
    
    // 清除用户的匹配状态
    await redisUtils.del(matchUserKey);
    
    // 清除匹配结果
    await redisUtils.del(matchResultKey);
    
    console.log(`✓ 用户${userId}已取消匹配/清除匹配状态`);
    
    res.json({ message: '匹配已取消' });
  } catch (error) {
    next(error);
  }
});

// 获取匹配结果（轮询）
router.get('/result', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const matchKey = `match:result:${userId}`;
    const matchResult = await redisUtils.get(matchKey);

    // 如果还没匹配成功，且用户还在匹配状态中，刷新其在线匹配 TTL
    if (!matchResult || !matchResult.matched) {
      const matchUserKey = `match:user:${userId}`;
      const userMatchState = await redisUtils.get(matchUserKey);
      if (userMatchState) {
        // 刷新 TTL，保持匹配状态
        await redisUtils.set(matchUserKey, userMatchState, 300);
        
        // 同时刷新队列 TTL
        const matchQueueKey = 'match:queue';
        const queueData = await redisUtils.get(matchQueueKey);
        if (queueData) {
          await redisUtils.set(matchQueueKey, queueData, 300);
        }

        // 检查是否需要重新触发匹配（每 10 秒尝试重新匹配一次，以防被动匹配失败）
        const now = Date.now();
        const lastPerform = userMatchState.lastPerformMatch || 0;
        if (now - lastPerform > 10000) {
          console.log(`[ResultPoll] 为用户 ${userId} 重新触发匹配算法...`);
          userMatchState.lastPerformMatch = now;
          await redisUtils.set(matchUserKey, userMatchState, 300);
          
          // 异步执行匹配
          performMatch(userId, userMatchState.matchSettings, userMatchState.accelerate).catch(err => {
            console.error('[ResultPoll] PerformMatch Error:', err);
          });
        }
      }
    }

    if (matchResult) {
      // 兼容旧代码的 matchedUserId 和新代码的 matchedUser.id
      const matchedUserId = matchResult.matchedUserId || matchResult.matchedUser?.id;
      
      if (matchResult.matched && matchedUserId) {
        const [users] = await query(
          'SELECT id, username, nickname, avatar, gender, location, bio FROM users WHERE id = ?',
          [matchedUserId]
        );

        if (users && users.length > 0) {
          res.json({
            matched: true,
            user: users[0],
            score: matchResult.score,
            isAnonymous: matchResult.isAnonymous || false,
            status: matchResult.status || 'pending',
            otherStatus: matchResult.otherStatus || 'pending',
            matchStats: matchResult.matchStats || null,
            roomId: matchResult.roomId || null
          });
        } else {
          res.json({ matched: false });
        }
      } else {
        res.json({
          matched: false,
          reason: matchResult.reason || null
        });
      }
    } else {
      res.json({ matched: false });
    }
  } catch (error) {
    next(error);
  }
});

// 同意匹配
router.post('/accept', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const matchKey = `match:result:${userId}`;
    const matchResult = await redisUtils.get(matchKey);
    
    if (!matchResult || !matchResult.matched) {
      return res.status(400).json({ error: '没有正在进行的匹配结果' });
    }
    
    matchResult.status = 'accepted';
    const otherUserId = matchResult.matchedUser?.id;
    const otherMatchKey = `match:result:${otherUserId}`;
    const otherMatchResult = await redisUtils.get(otherMatchKey);
    
    if (otherMatchResult) {
      otherMatchResult.otherStatus = 'accepted';
      
      // 如果双方都同意了，通知对方（通过轮询或可选的 Socket）
      if (otherMatchResult.status === 'accepted') {
        console.log(`[AcceptMatch] 双方已同意匹配: ${userId} <-> ${otherUserId}, Room: ${matchResult.roomId}`);
        
        // 记录到历史记录（如果双方都同意了）
        try {
          await query(
            `INSERT INTO match_history (user_id, matched_user_id, score, is_anonymous, room_id, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW()), (?, ?, ?, ?, ?, NOW())`,
            [userId, otherUserId, matchResult.score, matchResult.isAnonymous || false, matchResult.roomId,
             otherUserId, userId, matchResult.score, matchResult.isAnonymous || false, matchResult.roomId]
          );
        } catch (dbErr) {
          console.error('[AcceptMatch] 写入匹配历史失败:', dbErr);
        }
      }
      
      await redisUtils.set(otherMatchKey, otherMatchResult, 300);
      matchResult.otherStatus = otherMatchResult.status;
    }
    
    await redisUtils.set(matchKey, matchResult, 300);
    
    res.json({ 
      message: '已同意', 
      status: matchResult.status,
      otherStatus: matchResult.otherStatus,
      roomId: matchResult.roomId || null,
      bothAccepted: matchResult.status === 'accepted' && matchResult.otherStatus === 'accepted' 
    });
  } catch (error) {
    next(error);
  }
});

// 拒绝匹配
router.post('/reject', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const matchKey = `match:result:${userId}`;
    const matchResult = await redisUtils.get(matchKey);
    
    if (!matchResult || !matchResult.matched) {
      return res.status(400).json({ error: '没有正在进行的匹配结果' });
    }
    
    const otherUserId = matchResult.matchedUser?.id;
    const otherMatchKey = `match:result:${otherUserId}`;
    
    // 清理队列和状态
    const matchQueueKey = 'match:queue';
    const queueData = await redisUtils.get(matchQueueKey) || [];
    const updatedQueue = queueData.filter((item) => {
      const id = Number(typeof item === 'object' && item !== null ? item.userId : item);
      return id !== Number(userId) && id !== Number(otherUserId);
    });
    await redisUtils.set(matchQueueKey, updatedQueue, 300);

    await redisUtils.del(`match:user:${userId}`);
    await redisUtils.del(`match:user:${otherUserId}`);
    
    const rejectResult = { matched: false, reason: 'REJECTED' };
    await redisUtils.set(matchKey, rejectResult, 60);
    await redisUtils.set(otherMatchKey, rejectResult, 60);
    
    res.json({ message: '已拒绝匹配' });
  } catch (error) {
    next(error);
  }
});

// 获取匹配队列人数
router.get('/queue-count', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [settings] = await query(
      `SELECT * FROM match_settings WHERE user_id = ?`,
      [userId]
    );

    let currentMatchSettings = {
      min_age: 18,
      max_age: 80,
      enable_age_range: true,
      preferred_gender: 'both',
      preferred_location: null,
      distance_range: 50,
      matching_mode: 'random',
      is_anonymous: 'all',
      use_anonymous: false
    };

    if (settings && settings.length > 0) {
      currentMatchSettings = settings[0];
    }

    const matchQueueKey = 'match:queue';
    const queueData = await redisUtils.get(matchQueueKey);
    
    let sameParamsCount = 0;
    let isCurrentUserMatching = false;

    if (queueData && Array.isArray(queueData)) {
      for (const item of queueData) {
        const id = typeof item === 'object' && item !== null ? item.userId : item;
        if (!id) {
          continue;
        }
        if (id === userId) {
          isCurrentUserMatching = true;
          continue;
        }

        const otherMatch = await redisUtils.get(`match:user:${id}`);
        if (!otherMatch || !otherMatch.matchSettings) {
          continue;
        }

        const s = otherMatch.matchSettings;

        if (
          s.matching_mode === currentMatchSettings.matching_mode &&
          (s.preferred_gender || 'both') === (currentMatchSettings.preferred_gender || 'both') &&
          (s.preferred_location || null) === (currentMatchSettings.preferred_location || null) &&
          !!s.enable_age_range === !!currentMatchSettings.enable_age_range &&
          (s.min_age || 18) === (currentMatchSettings.min_age || 18) &&
          (s.max_age || 80) === (currentMatchSettings.max_age || 80)
        ) {
          sameParamsCount += 1;
        }
      }
    }

    const queueCount = sameParamsCount + (isCurrentUserMatching ? 1 : 0);
    
    res.json({ 
      queueCount,
      message: queueCount > 0 ? `当前有 ${queueCount} 人使用相同匹配设置` : '当前无人使用相同匹配设置'
    });
  } catch (error) {
    next(error);
  }
});

// 获取匹配历史
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [matches] = await query(
      `SELECT m.*, 
              u.id as matched_user_id, u.username, u.nickname, u.avatar, u.online_status
       FROM match_history m
       JOIN users u ON m.matched_user_id = u.id
       WHERE m.user_id = ?
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), offset]
    );

    res.json({ matches, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

// 删除单条匹配历史
router.delete('/history/:id', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const historyId = req.params.id;

    const [result] = await query(
      'DELETE FROM match_history WHERE id = ? AND user_id = ?',
      [historyId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到该历史记录' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    next(error);
  }
});

// 清空匹配历史
router.delete('/history', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    await query(
      'DELETE FROM match_history WHERE user_id = ?',
      [userId]
    );

    res.json({ message: '历史记录已清空' });
  } catch (error) {
    next(error);
  }
});

// 获取在线用户列表（用于主动匹配）
router.get('/online', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    // 排除自己和黑名单用户
    const [blacklist] = await query(
      'SELECT blocked_id FROM user_blacklist WHERE blocker_id = ?',
      [userId]
    );
    const blockedIds = blacklist && Array.isArray(blacklist) ? blacklist.map(b => b.blocked_id) : [];

    const limitNumber = Math.max(1, Math.min(parseInt(limit), 200));

    try {
      let sql = `
        SELECT id, username, nickname, avatar, gender, location, bio
        FROM users
        WHERE status = 'active'
          AND online_status IN ('online', 'away', 'busy')
          AND id != ?
      `;
      const params = [userId];

      if (blockedIds.length > 0) {
        sql += ` AND id NOT IN (${blockedIds.map(() => '?').join(',')})`;
        params.push(...blockedIds);
      }

      sql += ' ORDER BY last_login_at DESC LIMIT ?';
      params.push(limitNumber);

      const [users] = await query(sql, params);
      return res.json({ users: users || [] });
    } catch (dbError) {
      if (dbError?.code !== 'ER_BAD_FIELD_ERROR') {
        throw dbError;
      }
    }

    try {
      const onlineUsersKey = 'users:online';
      const onlineUserIds = await redisUtils.get(onlineUsersKey) || [];

      const filteredUserIds = onlineUserIds
        .filter(id => id !== userId && !blockedIds.includes(id))
        .slice(0, limitNumber);

      if (filteredUserIds.length === 0) {
        return res.json({ users: [] });
      }

      const placeholders = filteredUserIds.map(() => '?').join(',');
      const [users] = await query(
        `SELECT id, username, nickname, avatar, gender, location, bio
         FROM users 
         WHERE id IN (${placeholders}) AND status = 'active'`,
        filteredUserIds
      );

      res.json({ users: users || [] });
    } catch {
      res.json({ users: [] });
    }
  } catch (error) {
    next(error);
  }
});

// 执行匹配算法
async function performMatch(rawUserId, matchSettings, accelerate = false) {
  const userId = Number(rawUserId);
  console.log(`[PerformMatch] 开始为用户 ${userId} 执行匹配算法...`);

  // 1. 检查是否已经匹配成功
  const existingResult = await redisUtils.get(`match:result:${userId}`);
  if (existingResult && existingResult.matched) {
    console.log(`[PerformMatch] 用户 ${userId} 已经匹配成功，跳过逻辑`);
    return;
  }

  // 获取用户信息
  const [userInfo] = await query(
    'SELECT id, username, nickname, avatar, gender, location, status, interest_tags FROM users WHERE id = ?',
    [userId]
  );
  
  if (!userInfo || userInfo.length === 0) {
    console.log(`[PerformMatch] 找不到用户 ${userId}`);
    return;
  }
  
  const user = userInfo[0];
  if (user.status !== 'active') {
    console.log(`[PerformMatch] 用户 ${userId} 状态非活跃: ${user.status}`);
    return;
  }
  
  // 排除黑名单、自己
  const [blacklist] = await query(
    'SELECT blocked_id FROM user_blacklist WHERE blocker_id = ?',
    [userId]
  );
  const blockedIds = (blacklist || []).map(b => Number(b.blocked_id));
  blockedIds.push(userId);

  const matchModule = 'match';

  // 获取所有正在匹配的用户ID
  const matchingUserIds = [];
  const staleUserIds = [];
  const matchQueueKey = 'match:queue';
  const queueData = await redisUtils.get(matchQueueKey) || [];
  
  console.log(`[PerformMatch] 正在为用户 ${userId} 查找匹配...`);
  console.log(`[PerformMatch] 当前队列原始数据:`, JSON.stringify(queueData));

  let userInQueue = false;
  for (const item of queueData) {
    const id = Number(typeof item === 'object' && item !== null ? item.userId : item);
    if (isNaN(id)) continue;
    
    if (id === userId) {
      userInQueue = true;
      continue;
    }

    // 验证用户是否还在匹配状态
    const isStillMatching = await redisUtils.get(`match:user:${id}`);
    if (!isStillMatching) {
      staleUserIds.push(id);
      continue;
    }
    
    // 检查黑名单
    if (blockedIds.includes(id)) {
      continue;
    }

    matchingUserIds.push(id);
  }

  if (!userInQueue) {
    console.warn(`[PerformMatch] 警告：用户 ${userId} 不在匹配队列中，尝试重新加入...`);
    const latestQueue = await redisUtils.get(matchQueueKey) || [];
    if (!latestQueue.map(i => Number(typeof i === 'object' ? i.userId : i)).includes(userId)) {
      latestQueue.push(userId);
      await redisUtils.set(matchQueueKey, latestQueue, 300);
    }
  }

  // 清理失效用户
  if (staleUserIds.length > 0) {
    const cleanedQueue = queueData.filter(item => {
      const id = Number(typeof item === 'object' && item !== null ? item.userId : item);
      return !staleUserIds.includes(id);
    });
    await redisUtils.set(matchQueueKey, cleanedQueue, 300);
    console.log(`[PerformMatch] 已从队列中清理失效用户: ${staleUserIds.join(', ')}`);
  }

  console.log(`[PerformMatch] 潜在候选人列表 (matchingUserIds):`, matchingUserIds);

  // 如果没有其他用户在匹配，保持等待状态
  if (matchingUserIds.length === 0) {
    console.log(`[PerformMatch] 用户 ${userId} 匹配中：队列中没有其他合适用户`);
    return;
  }

  // 再次检查是否已经匹配成功
  const midCheck = await redisUtils.get(`match:result:${userId}`);
  if (midCheck && midCheck.matched) return;

  // 构建查询候选人的 SQL
  let candidates = [];
  const limit = accelerate ? 50 : 20;
  
  if (matchSettings.matching_mode === 'random') {
    // 随机匹配：速度最优先，直接从队列中选人
    const [randomCandidates] = await query(`
      SELECT id, username, nickname, avatar, gender, birthday, location, interest_tags 
      FROM users 
      WHERE id IN (${matchingUserIds.map(() => '?').join(',')}) 
      AND status = 'active'
      ORDER BY RAND()
      LIMIT ${limit}
    `, matchingUserIds);
    candidates = randomCandidates;
    console.log(`[PerformMatch] 随机模式获取候选人: ${candidates?.length || 0}个`);
  } else {
    // 其他匹配模式：执行过滤逻辑
    let sql = `
      SELECT id, username, nickname, avatar, gender, birthday, location, interest_tags 
      FROM users 
      WHERE id IN (${matchingUserIds.map(() => '?').join(',')}) 
      AND status = 'active'
    `;
    let params = [...matchingUserIds];

    let genderPreference = matchSettings.preferred_gender;
    if (genderPreference && genderPreference !== 'both') {
      sql += ' AND gender = ?';
      params.push(genderPreference);
    }

    if (matchSettings.preferred_location) {
      const locationParts = matchSettings.preferred_location.split(' ').filter(p => p.trim());
      locationParts.forEach(part => {
        sql += ' AND location LIKE ?';
        params.push(`%${part}%`);
      });
    }

    if (matchSettings.enable_age_range) {
      sql += `
        AND (
          birthday IS NULL OR 
          (TIMESTAMPDIFF(YEAR, birthday, CURDATE()) BETWEEN ? AND ?)
        )
      `;
      params.push(matchSettings.min_age, matchSettings.max_age);
    }

    // 根据模式排序或过滤
    if (matchSettings.matching_mode === 'nearby' && user.location) {
      // 简单地区匹配优化
      sql += ' ORDER BY (location LIKE ?) DESC';
      params.push(`%${user.location.split(' ')[0]}%`);
    } else if (matchSettings.matching_mode === 'interest' && user.interest_tags) {
      // 兴趣匹配优化
      const myTags = typeof user.interest_tags === 'string' ? JSON.parse(user.interest_tags) : user.interest_tags;
      if (Array.isArray(myTags) && myTags.length > 0) {
        // 使用简单的 LIKE 组合来模拟兴趣重合度排序
        const tagConditions = myTags.map(() => 'interest_tags LIKE ?').join(' + ');
        sql += ` ORDER BY (${tagConditions}) DESC`;
        myTags.forEach(tag => params.push(`%${tag}%`));
      }
    }

    sql += ` LIMIT ${limit}`;

    const [filteredCandidates] = await query(sql, params);
    candidates = filteredCandidates;
    console.log(`[PerformMatch] ${matchSettings.matching_mode}模式获取候选人: ${candidates?.length || 0}个`);

    // 如果没找到，尝试放宽限制
    if (!candidates || candidates.length === 0) {
      console.log(`[PerformMatch] 用户${userId}在${matchSettings.matching_mode}模式下没有匹配到，尝试放宽限制...`);
      
      // 1. 如果有性别要求，先尝试放宽性别
      if (genderPreference && genderPreference !== 'both') {
        const [relaxedGenderCandidates] = await query(`
          SELECT id, username, nickname, avatar, gender, birthday, location, interest_tags 
          FROM users 
          WHERE id IN (${matchingUserIds.map(() => '?').join(',')}) 
          AND status = 'active'
          AND (birthday IS NULL OR (TIMESTAMPDIFF(YEAR, birthday, CURDATE()) BETWEEN ? AND ?))
          LIMIT ${limit}
        `, [...matchingUserIds, matchSettings.min_age, matchSettings.max_age]);
        candidates = relaxedGenderCandidates;
        if (candidates.length > 0) console.log(`[PerformMatch] 放宽性别限制后获取候选人: ${candidates.length}个`);
      }

      // 2. 如果还是没有，彻底放宽到随机匹配（仅限队列中的活跃用户）
      if (!candidates || candidates.length === 0) {
        console.log(`[PerformMatch] 彻底放宽限制为随机匹配...`);
        const [randomFallbackCandidates] = await query(`
          SELECT id, username, nickname, avatar, gender, birthday, location, interest_tags 
          FROM users 
          WHERE id IN (${matchingUserIds.map(() => '?').join(',')}) 
          AND status = 'active'
          ORDER BY RAND()
          LIMIT ${limit}
        `, matchingUserIds);
        candidates = randomFallbackCandidates;
        if (candidates.length > 0) console.log(`[PerformMatch] 彻底放宽后获取候选人: ${candidates.length}个`);
      }
    }
  }

  // 统一匿名过滤逻辑：所有模式都必须通过匿名偏好检查
  if (candidates && candidates.length > 0) {
    const filteredByAnon = [];
    console.log(`[PerformMatch] 开始匿名过滤，初始候选人: ${candidates.length}个`);
    
    for (const candidate of candidates) {
      const candidateMatchState = await redisUtils.get(`match:user:${candidate.id}`);
      const cSettings = candidateMatchState?.matchSettings;
      
      if (!cSettings) {
        console.log(`[PerformMatch] 候选人 ${candidate.id} 缺少匹配设置，跳过`);
        continue;
      }

      const myAnonPref = matchSettings.is_anonymous || 'all';
      const otherAnonPref = cSettings.is_anonymous || 'all';
      const myUseAnon = !!matchSettings.use_anonymous;
      const otherUseAnon = !!cSettings.use_anonymous;

      // 检查我的偏好是否满足对方的状态
      if (myAnonPref === 'only' && !otherUseAnon) {
        console.log(`[PerformMatch] 候选人 ${candidate.id} 被过滤: 我的偏好是"只要匿名"，但对方非匿名`);
        continue;
      }
      if (myAnonPref === 'none' && otherUseAnon) {
        console.log(`[PerformMatch] 候选人 ${candidate.id} 被过滤: 我的偏好是"不要匿名"，但对方是匿名`);
        continue;
      }
      
      // 检查对方的偏好是否满足我的状态
      if (otherAnonPref === 'only' && !myUseAnon) {
        console.log(`[PerformMatch] 候选人 ${candidate.id} 被过滤: 对方偏好是"只要匿名"，但我非匿名`);
        continue;
      }
      if (otherAnonPref === 'none' && myUseAnon) {
        console.log(`[PerformMatch] 候选人 ${candidate.id} 被过滤: 对方偏好是"不要匿名"，但我开启了匿名`);
        continue;
      }

      filteredByAnon.push(candidate);
    }
    
    candidates = filteredByAnon;
    console.log(`[PerformMatch] 匿名过滤完成，剩余候选人: ${candidates.length}个`);
  }

  if (!candidates || candidates.length === 0) {
    console.log(`[PerformMatch] 用户 ${userId} 最终没有找到合适的候选人`);
    // 不要轻易设置失败，除非真的确定无法匹配且没有被别人匹配
    const finalCheck = await redisUtils.get(`match:result:${userId}`);
    if (!finalCheck || !finalCheck.matched) {
      // 只有在特定情况下才设置超时或无候选人，这里我们选择不设置，让前端继续轮询
      // await redisUtils.set(`match:result:${userId}`, { matched: false, reason: 'NO_CANDIDATES' }, 30);
    }
    return;
  }

  // 再次检查是否已经匹配成功
  const preMatchCheck = await redisUtils.get(`match:result:${userId}`);
  if (preMatchCheck && preMatchCheck.matched) return;

  // 执行匹配：计算所有候选人的匹配分数
  let candidatesWithScores = [];
  for (const candidate of candidates) {
    const score = await calculateMatchScore(userId, candidate.id);
    candidatesWithScores.push({
      ...candidate,
      matchScore: score
    });
  }

  // 按分数从高到低排序
  candidatesWithScores.sort((a, b) => b.matchScore - a.matchScore);

  // 选择分数最高的候选人
  const bestCandidate = candidatesWithScores[0];
  const roomId = `room_${uuidv4()}`; // 提前生成房间ID

  // 获取匹配对方的设置，确定是否开启匿名显示
  const matchedUserMatchState = await redisUtils.get(`match:user:${bestCandidate.id}`);
  const matchedUserSettings = matchedUserMatchState?.matchSettings;
  
  // 匿名逻辑：如果任何一方启用了匿名勾选
  const isAnonymousMatch = !!matchSettings.use_anonymous || !!matchedUserSettings?.use_anonymous;

  // 获取两人之前的匹配历史（仅用于显示统计，不在此处插入新记录）
  const [history] = await query(
    `SELECT COUNT(*) as matchCount, MAX(created_at) as lastMatchAt 
     FROM match_history 
     WHERE (user_id = ? AND matched_user_id = ?)`,
    [userId, bestCandidate.id]
  );

  const matchStats = {
    count: (history[0]?.matchCount || 0) + 1,
    lastMatchAt: history[0]?.lastMatchAt || null
  };

  // 原子性操作：再次检查对方是否还在队列中且未被匹配
  const matchedUserResult = await redisUtils.get(`match:result:${bestCandidate.id}`);
  if (matchedUserResult && matchedUserResult.matched) {
    // 对方已经被匹配了，重新执行匹配逻辑
    console.log(`[PerformMatch] 候选人 ${bestCandidate.id} 已被抢先匹配，重试...`);
    return performMatch(userId, matchSettings, accelerate);
  }

  // 准备匹配结果
  const resultForMe = {
    matched: true,
    matchedUser: {
      id: bestCandidate.id,
      username: bestCandidate.username,
      nickname: bestCandidate.nickname,
      avatar: bestCandidate.avatar,
      gender: bestCandidate.gender,
      location: bestCandidate.location
    },
    score: Math.floor(bestCandidate.matchScore),
    status: 'pending',
    otherStatus: 'pending',
    isAnonymous: isAnonymousMatch,
    matchStats,
    roomId
  };

  const resultForThem = {
    matched: true,
    matchedUser: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      gender: user.gender,
      location: user.location
    },
    score: Math.floor(bestCandidate.matchScore),
    status: 'pending',
    otherStatus: 'pending',
    isAnonymous: isAnonymousMatch,
    matchStats,
    roomId
  };

  // 设置匹配结果
  await redisUtils.set(`match:result:${userId}`, resultForMe, 300);
  await redisUtils.set(`match:result:${bestCandidate.id}`, resultForThem, 300);

    // 从队列中移除双方
    const finalQueueData = await redisUtils.get(matchQueueKey) || [];
    const updatedQueue = finalQueueData.filter(item => {
      const id = Number(typeof item === 'object' && item !== null ? item.userId : item);
      return id !== userId && id !== Number(bestCandidate.id);
    });
    await redisUtils.set(matchQueueKey, updatedQueue, 300);

  // 清除用户的匹配状态（match:user:${userId}）
  await redisUtils.del(`match:user:${userId}`);
  await redisUtils.del(`match:user:${bestCandidate.id}`);

  console.log(`[PerformMatch] 成功匹配: ${userId} <-> ${bestCandidate.id}, 分数: ${resultForMe.score}`);

  await logSystem('info', matchModule, '匹配成功', { 
    user1: userId, 
    user2: bestCandidate.id,
    mode: matchSettings.matching_mode,
    score: resultForMe.score
  });
}

export default router;

