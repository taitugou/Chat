import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { updateTaskProgress } from '../utils/taskManager.js';

const router = express.Router();

// 任务系统

// 获取任务列表
router.get('/tasks', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [tasks] = await query(
      `SELECT 
        id, name, description, points_reward, task_type, 
        target_count, current_count, status, 
        created_at, completed_at
       FROM user_tasks
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ tasks: Array.isArray(tasks) ? tasks : [] });
  } catch (error) {
    next(error);
  }
});

// 完成任务
router.post('/tasks/:taskId/complete', authenticate, async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    // 检查任务是否存在且属于当前用户
    const [tasks] = await query(
      `SELECT * FROM user_tasks WHERE id = ? AND user_id = ?`,
      [taskId, userId]
    );

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const task = tasks[0];

    if (task.status === 'completed') {
      return res.status(400).json({ error: '任务已完成' });
    }

    // 更新任务状态
    await query(
      `UPDATE user_tasks 
       SET status = 'completed', current_count = target_count, completed_at = NOW() 
       WHERE id = ?`,
      [taskId]
    );

    res.json({
      message: '任务完成'
    });
  } catch (error) {
    next(error);
  }
});

// 邀请好友
router.post('/invite/:code', authenticate, async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;

    // 检查邀请码是否有效
    const [invitations] = await query(
      `SELECT * FROM user_invitations WHERE code = ? AND status = 'pending'`,
      [code]
    );

    if (!invitations || invitations.length === 0) {
      return res.status(404).json({ error: '邀请码无效或已过期' });
    }

    const invitation = invitations[0];

    // 检查是否自己邀请自己
    if (invitation.inviter_id === userId) {
      return res.status(400).json({ error: '不能使用自己的邀请码' });
    }

    // 检查是否已经使用过
    const [used] = await query(
      `SELECT * FROM user_invitations WHERE code = ? AND used_by = ?`,
      [code, userId]
    );

    if (used && used.length > 0) {
      return res.status(400).json({ error: '已经使用过该邀请码' });
    }

    // 更新邀请状态
    await query(
      `UPDATE user_invitations 
       SET status = 'accepted', used_by = ?, used_at = NOW() 
       WHERE code = ?`,
      [userId, code]
    );

    // 更新邀请者任务进度
    try {
      await updateTaskProgress(invitation.inviter_id, '邀请好友');
    } catch (error) {
      console.error('更新邀请任务失败:', error);
    }

    res.json({
      message: '邀请成功'
    });
  } catch (error) {
    next(error);
  }
});

// 生成邀请码
router.post('/invite/generate', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 生成唯一邀请码
    const code = generateInviteCode(userId);

    // 检查是否已有邀请码
    const [existing] = await query(
      `SELECT * FROM user_invitations WHERE inviter_id = ? AND status = 'active'`,
      [userId]
    );

    if (existing && existing.length > 0) {
      return res.json({ code: existing[0].code });
    }

    // 创建邀请码
    await query(
      `INSERT INTO user_invitations (inviter_id, code, status, created_at)
       VALUES (?, ?, 'active', NOW())`,
      [userId, code]
    );

    res.json({ code });
  } catch (error) {
    next(error);
  }
});

// 获取我的邀请码
router.get('/invite/code', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [invitations] = await query(
      `SELECT * FROM user_invitations 
       WHERE inviter_id = ? AND status = 'active'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (invitations && invitations.length > 0) {
      return res.json({ code: invitations[0].code });
    }

    res.json({ code: null });
  } catch (error) {
    next(error);
  }
});

// 获取邀请记录
router.get('/invite/records', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [records] = await query(
      `SELECT ui.*, u.username, u.nickname, u.avatar
       FROM user_invitations ui
       JOIN users u ON ui.used_by = u.id
       WHERE ui.inviter_id = ? AND ui.status = 'accepted'
       ORDER BY ui.used_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      [userId]
    );

    const [countResult] = await query(
      `SELECT COUNT(*) as total 
       FROM user_invitations 
       WHERE inviter_id = ? AND status = 'accepted'`,
      [userId]
    );

    res.json({
      records: Array.isArray(records) ? records : [],
      total: countResult[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
});

// 完善资料奖励
router.post('/profile/complete', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 检查用户资料是否完善
    const [users] = await query(
      `SELECT avatar, nickname, bio, location, gender, birthday, interest_tags 
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];

    // 检查是否已经领取过奖励
    const [rewards] = await query(
      `SELECT * FROM user_rewards 
       WHERE user_id = ? AND reward_type = 'complete_profile'`,
      [userId]
    );

    if (rewards && rewards.length > 0) {
      return res.status(400).json({ error: '已经领取过完善资料奖励' });
    }

    // 检查资料完善度
    let completedFields = 0;
    if (user.avatar) completedFields++;
    if (user.nickname && user.nickname.trim()) completedFields++;
    if (user.bio && user.bio.trim()) completedFields++;
    if (user.location && user.location.trim()) completedFields++;
    if (user.gender && user.gender !== 'secret') completedFields++;
    if (user.birthday) completedFields++;
    if (user.interest_tags && user.interest_tags !== '[]') completedFields++;

    if (completedFields < 5) {
      return res.status(400).json({ 
        error: '资料完善度不足',
        completedFields,
        required: 5
      });
    }

    // 记录奖励
    await query(
      `INSERT INTO user_rewards (user_id, reward_type, points, description, created_at)
       VALUES (?, 'complete_profile', ?, ?, NOW())`,
      [userId, 20, '完善资料奖励']
    );

    res.json({
      message: '完善资料奖励已领取'
    });
  } catch (error) {
    next(error);
  }
});

// 生成邀请码
function generateInviteCode(userId) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`.toUpperCase();
}

export default router;
