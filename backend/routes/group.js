import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { processMentions, cleanupMentions } from '../utils/mentionHelper.js';

const router = express.Router();

// 创建群聊
router.post('/create', authenticate, async (req, res, next) => {
  try {
    const { name, description, avatar } = req.body;
    const creatorId = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '群聊名称不能为空' });
    }

    // 创建群聊
    const [groupResult] = await query(
      `INSERT INTO chat_groups (name, avatar, description, creator_id) 
       VALUES (?, ?, ?, ?)`,
      [name.trim(), avatar || null, description || null, creatorId]
    );

    const groupId = groupResult.insertId;

    // 处理描述中的提及
    if (description) {
      await processMentions({
        content: description,
        groupId: groupId,
        userId: creatorId
      });
    }

    // 添加创建者为群聊成员
    await query(
      `INSERT INTO chat_group_members (group_id, user_id, role) 
       VALUES (?, ?, 'owner')`,
      [groupId, creatorId]
    );

    res.json({ 
      message: '群聊创建成功', 
      group: { 
        id: groupId, 
        name: name.trim(), 
        avatar, 
        description, 
        creator_id: creatorId 
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取群聊列表
router.get('/list', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [groups] = await query(
      `SELECT g.id, g.name, g.avatar, g.description, g.creator_id, g.created_at,
       (SELECT COUNT(*) FROM chat_group_members WHERE group_id = g.id) as member_count
       FROM chat_groups g
       JOIN chat_group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ? AND g.is_visible = 1
       ORDER BY g.created_at DESC`,
      [userId]
    );

    res.json({ groups });
  } catch (error) {
    next(error);
  }
});

// 获取群聊详情
router.get('/:groupId', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // 检查用户是否在群聊中
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }

    const [group] = await query(
      `SELECT g.id, g.name, g.avatar, g.description, g.creator_id, g.created_at,
       (SELECT COUNT(*) FROM chat_group_members WHERE group_id = g.id) as member_count
       FROM chat_groups g WHERE g.id = ? AND g.is_visible = 1`,
      [groupId]
    );

    // 获取群聊成员
    const [members] = await query(
      `SELECT u.id, u.username, u.nickname, u.avatar, gm.role, gm.nickname as group_nickname
       FROM chat_group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?
       ORDER BY 
         CASE gm.role 
           WHEN 'owner' THEN 0 
           WHEN 'admin' THEN 1 
           ELSE 2 
         END, u.nickname ASC`,
      [groupId]
    );

    res.json({ group: group[0], members });
  } catch (error) {
    next(error);
  }
});

// 添加群聊成员
router.post('/:groupId/members', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { userIds } = req.body;
    const userId = req.user.id;

    // 检查用户是否是群聊管理员或所有者
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }

    const role = membership[0].role;
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: '你没有权限添加成员' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: '请选择要添加的成员' });
    }

    // 添加成员
    for (const memberId of userIds) {
      try {
        await query(
          `INSERT IGNORE INTO chat_group_members (group_id, user_id, role) 
           VALUES (?, ?, 'member')`,
          [groupId, memberId]
        );
      } catch (error) {
        // 忽略重复添加的错误
        continue;
      }
    }

    res.json({ message: '成员添加成功' });
  } catch (error) {
    next(error);
  }
});

// 删除群聊成员
router.delete('/:groupId/members/:userId', authenticate, async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;
    const currentUserId = req.user.id;

    // 检查当前用户是否是群聊管理员或所有者
    const [currentMembership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (!currentMembership || currentMembership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }

    const currentRole = currentMembership[0].role;
    if (currentRole !== 'owner' && currentRole !== 'admin') {
      return res.status(403).json({ error: '你没有权限删除成员' });
    }

    // 检查被删除用户的角色
    const [targetMembership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );

    if (!targetMembership || targetMembership.length === 0) {
      return res.status(404).json({ error: '该用户不是群聊成员' });
    }

    const targetRole = targetMembership[0].role;

    // 不能删除所有者
    if (targetRole === 'owner') {
      return res.status(403).json({ error: '不能删除群聊所有者' });
    }

    // 普通管理员不能删除其他管理员
    if (currentRole === 'admin' && targetRole === 'admin') {
      return res.status(403).json({ error: '你没有权限删除其他管理员' });
    }

    await query(
      `DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );

    res.json({ message: '成员已删除' });
  } catch (error) {
    next(error);
  }
});

// 退出群聊
router.post('/:groupId/leave', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // 检查用户是否是群聊所有者
    const [group] = await query(
      `SELECT creator_id FROM chat_groups WHERE id = ?`,
      [groupId]
    );

    if (group && group.length > 0 && group[0].creator_id === userId) {
      return res.status(400).json({ error: '群聊所有者不能退出群聊，可选择解散群聊' });
    }

    await query(
      `DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );

    res.json({ message: '已退出群聊' });
  } catch (error) {
    next(error);
  }
});

// 解散群聊
router.delete('/:groupId', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // 检查用户是否是群聊所有者
    const [group] = await query(
      `SELECT creator_id FROM chat_groups WHERE id = ?`,
      [groupId]
    );

    if (!group || group.length === 0) {
      return res.status(404).json({ error: '群聊不存在' });
    }

    if (group[0].creator_id !== userId) {
      return res.status(403).json({ error: '只有群聊所有者可以解散群聊' });
    }

    // 软删除群聊 (设置为不可见)
    await query(
      `UPDATE chat_groups SET is_visible = 0 WHERE id = ?`,
      [groupId]
    );

    // 清理提及
    await cleanupMentions({ groupId });

    res.json({ message: '群聊已解散' });
  } catch (error) {
    next(error);
  }
});

// 更新群聊资料
router.put('/:groupId', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, description, avatar } = req.body;
    const userId = req.user.id;

    // 检查用户角色
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }

    const role = membership[0].role;
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: '只有群聊管理员或所有者可以更新资料' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: '群聊名称不能为空' });
      }
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }

    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的内容' });
    }

    values.push(groupId);
    await query(
      `UPDATE chat_groups SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // 处理描述中的提及
    if (description !== undefined) {
      await processMentions({
        content: description,
        groupId: groupId,
        userId: userId
      });
    }

    res.json({ message: '群聊资料更新成功' });
  } catch (error) {
    next(error);
  }
});

// 群聊公告相关路由

// 发布群公告
router.post('/:groupId/announcements', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: '公告标题不能为空' });
    }
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: '公告内容不能为空' });
    }
    
    // 检查用户是否是群聊管理员或所有者
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }
    
    const role = membership[0].role;
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: '只有群聊管理员或所有者可以发布公告' });
    }
    
    // 发布公告
    const [result] = await query(
      `INSERT INTO group_announcements (group_id, title, content, created_by) 
       VALUES (?, ?, ?, ?)`,
      [groupId, title.trim(), content.trim(), userId]
    );

    const announcementId = result.insertId;

    // 处理公告内容中的提及
    await processMentions({
      content: content.trim(),
      announcementId: announcementId,
      userId: userId
    });
    
    // 更新其他公告为非活跃状态（只保留最新的活跃公告）
    await query(
      `UPDATE group_announcements 
       SET is_active = false 
       WHERE group_id = ? AND id != ?`,
      [groupId, announcementId]
    );
    
    res.json({ 
      message: '公告发布成功',
      announcement: {
        id: result.insertId,
        title: title.trim(),
        content: content.trim(),
        created_by: userId,
        created_at: new Date(),
        is_active: true
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取群公告列表
router.get('/:groupId/announcements', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    // 检查用户是否是群聊成员
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }
    
    const [announcements] = await query(
      `SELECT ga.id, ga.title, ga.content, ga.is_active, ga.created_at, 
              u.nickname as creator_nickname, u.avatar as creator_avatar
       FROM group_announcements ga
       JOIN users u ON ga.created_by = u.id
       WHERE ga.group_id = ?
       ORDER BY ga.is_active DESC, ga.created_at DESC`,
      [groupId]
    );
    
    res.json({ announcements });
  } catch (error) {
    next(error);
  }
});

// 获取群公告详情
router.get('/:groupId/announcements/:announcementId', authenticate, async (req, res, next) => {
  try {
    const { groupId, announcementId } = req.params;
    const userId = req.user.id;
    
    // 检查用户是否是群聊成员
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }
    
    const [announcements] = await query(
      `SELECT ga.id, ga.title, ga.content, ga.is_active, ga.created_at, 
              u.nickname as creator_nickname, u.avatar as creator_avatar
       FROM group_announcements ga
       JOIN users u ON ga.created_by = u.id
       WHERE ga.group_id = ? AND ga.id = ?`,
      [groupId, announcementId]
    );
    
    if (!announcements || announcements.length === 0) {
      return res.status(404).json({ error: '公告不存在' });
    }
    
    res.json({ announcement: announcements[0] });
  } catch (error) {
    next(error);
  }
});

// 更新群公告
router.put('/:groupId/announcements/:announcementId', authenticate, async (req, res, next) => {
  try {
    const { groupId, announcementId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: '公告标题不能为空' });
    }
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: '公告内容不能为空' });
    }
    
    // 检查用户是否是群聊管理员或所有者
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }
    
    const role = membership[0].role;
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: '只有群聊管理员或所有者可以更新公告' });
    }
    
    // 更新公告
    const [result] = await query(
      `UPDATE group_announcements 
       SET title = ?, content = ? 
       WHERE id = ? AND group_id = ?`,
      [title.trim(), content.trim(), announcementId, groupId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '公告不存在' });
    }

    // 处理公告内容中的提及
    await processMentions({
      content: content.trim(),
      announcementId: announcementId,
      userId: userId
    });
    
    res.json({ message: '公告更新成功' });
  } catch (error) {
    next(error);
  }
});

// 删除群公告
router.delete('/:groupId/announcements/:announcementId', authenticate, async (req, res, next) => {
  try {
    const { groupId, announcementId } = req.params;
    const userId = req.user.id;
    
    // 检查用户是否是群聊管理员或所有者
    const [membership] = await query(
      `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    
    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: '你不是该群聊成员' });
    }
    
    const role = membership[0].role;
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: '只有群聊管理员或所有者可以删除公告' });
    }
    
    // 删除公告
    await query(
      `DELETE FROM group_announcements 
       WHERE id = ? AND group_id = ?`,
      [announcementId, groupId]
    );

    // 清理提及
    await cleanupMentions({ announcementId });
    
    res.json({ message: '公告已删除' });
  } catch (error) {
    next(error);
  }
});

export default router;
