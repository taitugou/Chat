import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireRole, getUserRoles, assignRole, removeRole, isSuperAdmin } from '../middleware/permission.js';
import { query, transaction } from '../database/connection.js';
import bcrypt from 'bcryptjs';
import { logOperation, logSecurityAudit, getOperationLogs, getSystemLogs, getSecurityAudits } from '../utils/logger.js';
import { processMentions, cleanupMentions } from '../utils/mentionHelper.js';

import { getActiveUserIds } from '../utils/activeTracker.js';

const router = express.Router();

async function checkAdmin(req, res, next) {
  try {
    const hasPermission = await requirePermission('admin:*')(req, res, () => {});
    if (hasPermission === false) {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

router.use(authenticate);

router.get('/users', requirePermission('user:read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const offset = (page - 1) * limit;

    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = 'SELECT id, username, nickname, email, phone, status, is_visible, created_at, last_login_at FROM users WHERE 1=1';
    const params = [];

    if (!showInvisible) {
      sql += ' AND is_visible = 1';
    }

    if (search) {
      sql += ' AND (username LIKE ? OR nickname LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [users] = await query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];

    if (!showInvisible) {
      countSql += ' AND is_visible = 1';
    }

    if (search) {
      countSql += ' AND (username LIKE ? OR nickname LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (status !== 'all') {
      countSql += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await query(countSql, countParams);
    const total = countResult[0]?.total || 0;

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'list_users',
      module: 'user',
      description: `查看用户列表，页码:${page}`,
      request_method: req.method,
      request_url: req.originalUrl,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败', details: error.message });
  }
});

router.get('/users/:id', requirePermission('user:read'), async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await query(
      `SELECT id, username, nickname, email, phone, status, created_at, last_login_at, points
       FROM users WHERE id = ?`,
      [id]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const [stats] = await query(
      `SELECT 
        (SELECT COUNT(*) FROM posts WHERE user_id = ? AND status = 'active') as post_count,
        (SELECT COUNT(*) FROM user_friends WHERE user_id = ? OR friend_id = ?) as friend_count,
        (SELECT COUNT(*) FROM messages WHERE sender_id = ?) as message_count`,
      [id, id, id, id]
    );

    const roles = await getUserRoles(id);

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'view_user',
      module: 'user',
      description: `查看用户详情，用户ID:${id}`,
      request_method: req.method,
      request_url: req.originalUrl,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ user: users[0], stats: stats[0] || {}, roles });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.status(500).json({ error: '获取用户详情失败', details: error.message });
  }
});

router.get('/users/:id/friends', requirePermission('user:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const [friends] = await query(
      `SELECT uf.*, u.username, u.nickname, u.avatar 
       FROM user_friends uf
       JOIN users u ON (uf.friend_id = u.id AND uf.user_id = ?) OR (uf.user_id = u.id AND uf.friend_id = ?)
       WHERE uf.user_id = ? OR uf.friend_id = ?
       ORDER BY uf.created_at DESC`,
      [id, id, id, id]
    );
    res.json({ friends });
  } catch (error) {
    res.status(500).json({ error: '获取好友列表失败' });
  }
});

router.get('/users/:id/matches', requirePermission('user:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const [matches] = await query(
      `SELECT mh.*, u1.username as user1_username, u2.username as user2_username
       FROM match_history mh
       JOIN users u1 ON mh.user_id = u1.id
       JOIN users u2 ON mh.matched_user_id = u2.id
       WHERE mh.user_id = ? OR mh.matched_user_id = ?
       ORDER BY mh.created_at DESC`,
      [id, id]
    );
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ error: '获取匹配记录失败' });
  }
});

router.get('/users/:id/login-logs', requirePermission('log:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const [logs] = await query(
      `SELECT * FROM login_history 
       WHERE user_id = ? 
       ORDER BY login_time DESC LIMIT 100`,
      [id]
    );
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: '获取登录日志失败' });
  }
});

router.put('/users/:id', requirePermission('user:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, email, phone, level, points } = req.body;

    const updateFields = [];
    const params = [];

    if (nickname !== undefined) {
      updateFields.push('nickname = ?');
      params.push(nickname);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    if (level !== undefined) {
      updateFields.push('level = ?');
      params.push(level);
    }
    if (points !== undefined) {
      updateFields.push('points = ?');
      params.push(points);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    params.push(id);
    await query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, params);

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'update_user',
      module: 'user',
      description: `更新用户资料，用户ID:${id}`,
      request_method: req.method,
      request_url: req.originalUrl,
      request_params: req.body,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '用户资料更新成功' });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({ error: '更新用户失败', details: error.message });
  }
});

router.put('/users/:id/status', requirePermission('user:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'frozen', 'deleted', 'banned'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    await query('UPDATE users SET status = ? WHERE id = ?', [status, id]);

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'update_user_status',
      module: 'user',
      description: `更新用户状态，用户ID:${id}，状态:${status}`,
      request_method: req.method,
      request_url: req.originalUrl,
      request_params: { status },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    await logSecurityAudit({
      audit_type: 'user_status_change',
      user_id: req.user.id,
      username: req.user.username,
      action: 'change_status',
      resource_type: 'user',
      resource_id: id,
      details: { new_status: status },
      risk_level: status === 'banned' ? 'high' : 'medium',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '用户状态更新成功' });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    res.status(500).json({ error: '更新用户状态失败', details: error.message });
  }
});

router.put('/users/:id/reset-password', requirePermission('user:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password = '123456' } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, id]);

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'reset_password',
      module: 'user',
      description: `重置用户密码，用户ID:${id}`,
      request_method: req.method,
      request_url: req.originalUrl,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    await logSecurityAudit({
      audit_type: 'password_reset',
      user_id: req.user.id,
      username: req.user.username,
      action: 'reset_password',
      resource_type: 'user',
      resource_id: id,
      risk_level: 'high',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({ error: '重置密码失败', details: error.message });
  }
});

router.put('/users/:id/reset-avatar', requirePermission('user:update'), async (req, res) => {
  try {
    const { id } = req.params;

    // 获取用户信息以获取昵称的首字母
    const [users] = await query('SELECT nickname FROM users WHERE id = ?', [id]);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: '未找到该用户' });
    }

    const nickname = users[0].nickname;
    const initialChar = nickname && nickname.length > 0 ? nickname.charAt(0).toUpperCase() : 'U';
    const avatarUrl = `/api/user/avatar/default/${initialChar}`;

    await query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, id]);

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'reset_avatar',
      module: 'user',
      description: `重置用户头像，用户ID:${id}`,
      request_method: req.method,
      request_url: req.originalUrl,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '头像重置成功', avatar: avatarUrl });
  } catch (error) {
    console.error('重置头像失败:', error);
    res.status(500).json({ error: '重置头像失败', details: error.message });
  }
});

router.delete('/users/:id', requirePermission('user:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) {
        return res.status(403).json({ error: '只有超级管理员可以彻底删除用户' });
      }
      await query('DELETE FROM users WHERE id = ?', [id]);
    } else {
      await query('UPDATE users SET is_visible = 0, status = "deleted" WHERE id = ?', [id]);
    }

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: permanent === 'true' ? 'permanent_delete_user' : 'soft_delete_user',
      module: 'user',
      description: `${permanent === 'true' ? '彻底' : '软'}删除用户，ID:${id}`,
      status: 'success'
    });

    res.json({ message: `用户已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

router.get('/users/:id/roles', requirePermission('user:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const roles = await getUserRoles(id);
    res.json({ roles });
  } catch (error) {
    console.error('获取用户角色失败:', error);
    res.status(500).json({ error: '获取用户角色失败', details: error.message });
  }
});

router.post('/users/:id/roles', requirePermission('user:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id, expires_at } = req.body;

    await assignRole(id, role_id, req.user.id, expires_at);

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'assign_role',
      module: 'user',
      description: `分配角色，用户ID:${id}，角色ID:${role_id}`,
      request_method: req.method,
      request_url: req.originalUrl,
      request_params: req.body,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '角色分配成功' });
  } catch (error) {
    console.error('分配角色失败:', error);
    res.status(500).json({ error: '分配角色失败', details: error.message });
  }
});

router.delete('/users/:id/roles/:roleId', requirePermission('user:update'), async (req, res) => {
  try {
    const { id, roleId } = req.params;

    await removeRole(id, roleId);

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'remove_role',
      module: 'user',
      description: `移除角色，用户ID:${id}，角色ID:${roleId}`,
      request_method: req.method,
      request_url: req.originalUrl,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '角色移除成功' });
  } catch (error) {
    console.error('移除角色失败:', error);
    res.status(500).json({ error: '移除角色失败', details: error.message });
  }
});

router.get('/roles', requirePermission('role:read'), async (req, res) => {
  try {
    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = 'SELECT id, name, display_name, description, permissions, is_system, is_visible, created_at, updated_at FROM roles';
    if (!showInvisible) {
      sql += ' WHERE is_visible = 1';
    }
    sql += ' ORDER BY id ASC';

    const [roles] = await query(sql);

    res.json({ roles });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    res.status(500).json({ error: '获取角色列表失败', details: error.message });
  }
});

router.post('/roles', requirePermission('role:create'), async (req, res) => {
  try {
    const { name, display_name, description, permissions } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ error: '角色名称和显示名称不能为空' });
    }

    const [result] = await query(
      `INSERT INTO roles (name, display_name, description, permissions)
       VALUES (?, ?, ?, ?)`,
      [name, display_name, description, JSON.stringify(permissions || [])]
    );

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'create_role',
      module: 'role',
      description: `创建角色，角色名称:${name}`,
      request_method: req.method,
      request_url: req.originalUrl,
      request_params: req.body,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '角色创建成功', role_id: result.insertId });
  } catch (error) {
    console.error('创建角色失败:', error);
    res.status(500).json({ error: '创建角色失败', details: error.message });
  }
});

router.put('/roles/:id', requirePermission('role:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, description, permissions } = req.body;

    const [role] = await query('SELECT is_system FROM roles WHERE id = ?', [id]);
    if (!role || role.length === 0) {
      return res.status(404).json({ error: '角色不存在' });
    }

    if (role[0].is_system) {
      return res.status(403).json({ error: '系统内置角色不能修改' });
    }

    await query(
      `UPDATE roles SET display_name = ?, description = ?, permissions = ? WHERE id = ?`,
      [display_name, description, JSON.stringify(permissions || []), id]
    );

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'update_role',
      module: 'role',
      description: `更新角色，角色ID:${id}`,
      request_method: req.method,
      request_url: req.originalUrl,
      request_params: req.body,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '角色更新成功' });
  } catch (error) {
    console.error('更新角色失败:', error);
    res.status(500).json({ error: '更新角色失败', details: error.message });
  }
});

router.delete('/roles/:id', requirePermission('role:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    const [role] = await query('SELECT is_system FROM roles WHERE id = ?', [id]);
    if (!role || role.length === 0) {
      return res.status(404).json({ error: '角色不存在' });
    }

    if (role[0].is_system) {
      return res.status(403).json({ error: '系统内置角色不能删除' });
    }

    if (permanent === 'true') {
      if (!isSuper) {
        return res.status(403).json({ error: '只有超级管理员可以彻底删除角色' });
      }
      await query('DELETE FROM roles WHERE id = ?', [id]);
    } else {
      await query('UPDATE roles SET is_visible = 0 WHERE id = ?', [id]);
    }

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: permanent === 'true' ? 'permanent_delete_role' : 'soft_delete_role',
      module: 'role',
      description: `${permanent === 'true' ? '彻底' : '软'}删除角色，角色ID:${id}`,
      request_method: req.method,
      request_url: req.originalUrl,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: `角色已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    console.error('删除角色失败:', error);
    res.status(500).json({ error: '删除角色失败', details: error.message });
  }
});

router.get('/configs', requirePermission('config:read'), async (req, res) => {
  try {
    const { category } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = 'SELECT id, config_key, config_value, config_type, description, is_public, category, is_visible, updated_at FROM system_configs WHERE 1=1';
    const params = [];

    if (!showInvisible) {
      sql += ' AND is_visible = 1';
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY category, config_key';

    const [configs] = await query(sql, params);

    res.json({ configs });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    res.status(500).json({ error: '获取系统配置失败', details: error.message });
  }
});

router.delete('/configs/:id', requirePermission('config:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) return res.status(403).json({ error: '只有超级管理员可以彻底删除配置' });
      await query('DELETE FROM system_configs WHERE id = ?', [id]);
    } else {
      await query('UPDATE system_configs SET is_visible = 0 WHERE id = ?', [id]);
    }

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: permanent === 'true' ? 'permanent_delete_config' : 'soft_delete_config',
      module: 'config',
      description: `${permanent === 'true' ? '彻底' : '软'}删除系统配置，ID:${id}`,
      status: 'success'
    });

    res.json({ message: `配置已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    res.status(500).json({ error: '删除配置失败' });
  }
});

router.put('/configs/:key', requirePermission('config:update'), async (req, res) => {
  try {
    const { key } = req.params;
    const { config_value, is_visible } = req.body;

    const updates = ['updated_at = NOW()'];
    const params = [config_value];

    let sql = 'UPDATE system_configs SET config_value = ?';
    
    if (is_visible !== undefined) {
      sql += ', is_visible = ?';
      params.push(is_visible);
    }

    sql += ', updated_at = NOW() WHERE config_key = ?';
    params.push(key);

    await query(sql, params);

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'update_config',
      module: 'config',
      description: `更新系统配置，配置键:${key}`,
      request_method: req.method,
      request_url: req.originalUrl,
      request_params: req.body,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ message: '配置更新成功' });
  } catch (error) {
    console.error('更新配置失败:', error);
    res.status(500).json({ error: '更新配置失败', details: error.message });
  }
});

router.get('/logs/operation', requirePermission('log:read'), async (req, res) => {
  try {
    const isSuper = await isSuperAdmin(req.user.id);
    const filters = {
      user_id: req.query.user_id,
      action: req.query.action,
      module: req.query.module,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      page: req.query.page,
      limit: req.query.limit,
      show_invisible: isSuper && req.query.show_invisible === 'true'
    };

    const result = await getOperationLogs(filters);
    res.json(result);
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ error: '获取操作日志失败', details: error.message });
  }
});

router.get('/logs/system', requirePermission('log:read'), async (req, res) => {
  try {
    const isSuper = await isSuperAdmin(req.user.id);
    const filters = {
      level: req.query.level,
      module: req.query.module,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      page: req.query.page,
      limit: req.query.limit,
      show_invisible: isSuper && req.query.show_invisible === 'true'
    };

    const result = await getSystemLogs(filters);
    res.json(result);
  } catch (error) {
    console.error('获取系统日志失败:', error);
    res.status(500).json({ error: '获取系统日志失败', details: error.message });
  }
});

router.get('/logs/security', requirePermission('log:read'), async (req, res) => {
  try {
    const isSuper = await isSuperAdmin(req.user.id);
    const filters = {
      audit_type: req.query.audit_type,
      user_id: req.query.user_id,
      risk_level: req.query.risk_level,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      page: req.query.page,
      limit: req.query.limit,
      show_invisible: isSuper && req.query.show_invisible === 'true'
    };

    const result = await getSecurityAudits(filters);
    res.json(result);
  } catch (error) {
    console.error('获取安全审计失败:', error);
    res.status(500).json({ error: '获取安全审计失败', details: error.message });
  }
});

router.delete('/logs/:type/:id', requirePermission('log:delete'), async (req, res) => {
  try {
    const { type, id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    const tableMap = {
      operation: 'operation_logs',
      system: 'system_logs',
      security: 'security_audits'
    };

    const tableName = tableMap[type];
    if (!tableName) return res.status(400).json({ error: '无效的日志类型' });

    if (permanent === 'true') {
      if (!isSuper) return res.status(403).json({ error: '只有超级管理员可以彻底删除日志' });
      await query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    } else {
      await query(`UPDATE ${tableName} SET is_visible = 0 WHERE id = ?`, [id]);
    }

    res.json({ message: `日志已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    res.status(500).json({ error: '删除日志失败' });
  }
});

router.get('/stats', requirePermission('stats:read'), async (req, res) => {
  try {
    const [stats] = await query(
      `SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()) as today_users,
        (SELECT COUNT(*) FROM posts WHERE status = 'active') as total_posts,
        (SELECT COUNT(*) FROM posts WHERE DATE(created_at) = CURDATE() AND status = 'active') as today_posts,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(*) FROM messages WHERE DATE(created_at) = CURDATE()) as today_messages,
        (SELECT COUNT(*) FROM match_history) as total_matches,
        (SELECT COUNT(*) FROM match_history WHERE DATE(created_at) = CURDATE()) as today_matches,
        (SELECT COUNT(*) FROM post_likes) as total_likes,
        (SELECT COUNT(*) FROM post_comments) as total_comments,
        (SELECT COUNT(*) FROM user_friends) as total_friends,
        (SELECT SUM(points) FROM users) as total_points`
    );

    res.json({ stats: stats[0] || {} });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ error: '获取统计失败', details: error.message });
  }
});

router.get('/stats/user-growth', requirePermission('stats:read'), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const [growthData] = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [parseInt(days)]
    );

    res.json(growthData);
  } catch (error) {
    console.error('获取用户增长数据失败:', error);
    res.status(500).json({ error: '获取用户增长数据失败', details: error.message });
  }
});

router.get('/stats/content-production', requirePermission('stats:read'), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const [contentData] = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as posts,
        (SELECT COUNT(*) FROM post_comments WHERE DATE(created_at) = DATE(posts.created_at)) as comments,
        (SELECT COUNT(*) FROM post_likes WHERE DATE(created_at) = DATE(posts.created_at)) as likes
       FROM posts
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [parseInt(days)]
    );

    res.json(contentData);
  } catch (error) {
    console.error('获取内容生产数据失败:', error);
    res.status(500).json({ error: '获取内容生产数据失败', details: error.message });
  }
});

router.get('/sponsorships', requirePermission('sponsorship:read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = `SELECT s.id, s.user_id, u.username, u.nickname, s.amount,
                      s.payment_method, s.status, s.remark, s.transaction_id,
                      s.admin_id, s.is_visible, s.created_at, s.updated_at
               FROM sponsorships s
               JOIN users u ON s.user_id = u.id
               WHERE 1=1`;
    const params = [];

    if (!showInvisible) {
      sql += ' AND s.is_visible = 1';
    }

    if (search) {
      sql += ' AND (u.username LIKE ? OR u.nickname LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [sponsorships] = await query(sql, params);

    res.json({ sponsorships: Array.isArray(sponsorships) ? sponsorships : [] });
  } catch (error) {
    console.error('获取赞助列表失败:', error);
    res.status(500).json({ error: '获取赞助列表失败', details: error.message });
  }
});

router.post('/sponsorships', requirePermission('sponsorship:write'), async (req, res) => {
  try {
    const { username, amount, payment_method, status, remark } = req.body;

    if (!username || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ error: '用户名和金额不能为空' });
    }

    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: '金额不合法' });
    }

    const [users] = await query(
      `SELECT id FROM users WHERE username = ? LIMIT 1`,
      [username]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const userId = users[0].id;
    const adminId = req.user.id;

    const [result] = await query(
      `INSERT INTO sponsorships (user_id, amount, payment_method, status, remark, admin_id, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [userId, numericAmount, payment_method || null, status || 'completed', remark || null, adminId]
    );

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'create_sponsorship',
      module: 'sponsorship',
      description: `添加赞助记录，用户ID:${userId}，金额:${numericAmount}`,
      request_method: req.method,
      request_url: req.originalUrl,
      request_params: req.body,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    await logSecurityAudit({
      audit_type: 'sponsorship_create',
      user_id: req.user.id,
      username: req.user.username,
      action: 'create',
      resource_type: 'sponsorship',
      resource_id: result.insertId,
      details: { user_id: userId, amount: numericAmount, status: status || 'completed' },
      risk_level: 'medium',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      sponsorship_id: result.insertId,
      message: '添加成功'
    });

    // 处理提及
    if (remark) {
      processMentions({
        content: remark,
        sponsorshipId: result.insertId,
        userId: adminId
      }).catch(err => console.error('处理提及失败:', err));
    }
  } catch (error) {
    console.error('添加赞助记录失败:', error);
    res.status(500).json({ error: '添加赞助记录失败', details: error.message });
  }
});

router.put('/sponsorships/:id', requirePermission('sponsorship:write'), async (req, res) => {
  try {
    const sponsorshipId = req.params.id;
    const { amount, payment_method, status, remark, is_visible } = req.body;

    const numericAmount = amount !== undefined && amount !== null && amount !== ''
      ? parseFloat(amount)
      : null;

    if (numericAmount !== null && (Number.isNaN(numericAmount) || numericAmount <= 0)) {
      return res.status(400).json({ error: '金额不合法' });
    }

    const updates = [];
    const params = [];

    if (numericAmount !== null) {
      updates.push('amount = ?');
      params.push(numericAmount);
    }
    if (payment_method !== undefined) {
      updates.push('payment_method = ?');
      params.push(payment_method || null);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (remark !== undefined) {
      updates.push('remark = ?');
      params.push(remark || null);
    }
    if (is_visible !== undefined) {
      updates.push('is_visible = ?');
      params.push(is_visible);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(sponsorshipId);

    const [result] = await query(
      `UPDATE sponsorships SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '赞助记录不存在' });
    }

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: 'update_sponsorship',
      module: 'sponsorship',
      description: `更新赞助记录，ID:${sponsorshipId}`,
      request_method: req.method,
      request_url: req.originalUrl,
      request_params: req.body,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: '更新成功'
    });

    // 处理提及
    if (remark) {
      processMentions({
        content: remark,
        sponsorshipId,
        userId: req.user.id
      }).catch(err => console.error('处理提及失败:', err));
    }
  } catch (error) {
    console.error('更新赞助记录失败:', error);
    res.status(500).json({ error: '更新赞助记录失败', details: error.message });
  }
});

router.delete('/sponsorships/:id', requirePermission('sponsorship:write'), async (req, res) => {
  try {
    const sponsorshipId = req.params.id;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) {
        return res.status(403).json({ error: '只有超级管理员可以彻底删除赞助记录' });
      }
      await query('DELETE FROM sponsorships WHERE id = ?', [sponsorshipId]);
    } else {
      await query('UPDATE sponsorships SET is_visible = 0 WHERE id = ?', [sponsorshipId]);
    }

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: permanent === 'true' ? 'permanent_delete_sponsorship' : 'soft_delete_sponsorship',
      module: 'sponsorship',
      description: `${permanent === 'true' ? '彻底' : '软'}删除赞助记录，ID:${sponsorshipId}`,
      status: 'success'
    });

    res.json({
      success: true,
      message: `赞助记录已${permanent === 'true' ? '彻底' : '软'}删除`
    });

    // 清理提及
    if (permanent === 'true') {
      cleanupMentions({ sponsorshipId }).catch(err => console.error('清理提及失败:', err));
    }
  } catch (error) {
    console.error('删除赞助记录失败:', error);
    res.status(500).json({ error: '删除赞助记录失败', details: error.message });
  }
});

// --- 迁移自 admin.js 的业务管理路由 ---

// 通知管理
router.get('/notifications', requirePermission('notification:read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = `
      SELECT n.*, u.username, u.nickname 
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (!showInvisible) {
      sql += ' AND n.is_visible = 1';
    }

    if (search) {
      sql += ' AND (n.title LIKE ? OR n.content LIKE ? OR u.username LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [notifications] = await query(sql, params);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: '获取通知列表失败' });
  }
});

router.delete('/notifications/:id', requirePermission('notification:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) return res.status(403).json({ error: '只有超级管理员可以彻底删除通知' });
      await query('DELETE FROM notifications WHERE id = ?', [id]);
    } else {
      await query('UPDATE notifications SET is_visible = 0 WHERE id = ?', [id]);
    }

    res.json({ message: `通知已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    res.status(500).json({ error: '删除通知失败' });
  }
});

router.get('/notifications/deleted', requirePermission('notification:read'), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset = (page - 1) * limit;
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    const type = req.query.type ? String(req.query.type) : null;

    const whereConditions = ['n.is_deleted = TRUE'];
    const params = [];

    if (userId) {
      whereConditions.push('n.user_id = ?');
      params.push(userId);
    }

    if (type) {
      whereConditions.push('n.type = ?');
      params.push(type);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const [rows] = await query(
      `SELECT n.*, u.username, u.nickname 
       FROM notifications n
       LEFT JOIN users u ON n.user_id = u.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [totalResult] = await query(
      `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
      params
    );

    res.json({
      notifications: rows,
      pagination: {
        page,
        limit,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取已删除通知失败' });
  }
});

// 批量发送系统通知
router.post('/notifications/system/batch', requirePermission('notification:write'), async (req, res) => {
  try {
    const { userIds, title, content, type = 'system' } = req.body;
    if (!userIds || !userIds.length || !content) {
      return res.status(400).json({ error: '用户列表和内容不能为空' });
    }

    const values = userIds.map(id => [id, title, content, type, 0]);
    await query(
      'INSERT INTO notifications (user_id, title, content, type, is_read) VALUES ?',
      [values]
    );

    res.json({ success: true, message: `成功向 ${userIds.length} 个用户发送通知` });
  } catch (error) {
    res.status(500).json({ error: '批量发送通知失败' });
  }
});

// 帖子管理
router.get('/posts', requirePermission('post:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = `
      SELECT p.*, u.username, u.nickname, u.avatar
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (!showInvisible) {
      sql += ' AND p.is_visible = 1';
    }

    if (status !== 'all') {
      sql += ' AND p.status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (p.content LIKE ? OR u.nickname LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [posts] = await query(sql, params);
    res.json({ posts, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: '获取帖子列表失败' });
  }
});

router.get('/posts/:id', requirePermission('post:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const isSuper = await isSuperAdmin(req.user.id);

    const [posts] = await query(
      `SELECT p.*, u.username, u.nickname, u.avatar
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ? ${!isSuper ? 'AND p.is_visible = 1' : ''}`,
      [id]
    );

    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在或不可见' });
    }

    const [comments] = await query(
      `SELECT c.*, u.username, u.nickname, u.avatar
       FROM post_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ? ${!isSuper ? 'AND c.is_visible = 1' : ''}
       ORDER BY c.created_at DESC`,
      [id]
    );

    res.json({ post: posts[0], comments });
  } catch (error) {
    res.status(500).json({ error: '获取帖子详情失败' });
  }
});

router.delete('/posts/:id', requirePermission('post:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) {
        return res.status(403).json({ error: '只有超级管理员可以彻底删除帖子' });
      }
      await query('DELETE FROM posts WHERE id = ?', [id]);
    } else {
      await query('UPDATE posts SET is_visible = 0, status = "deleted" WHERE id = ?', [id]);
    }
    
    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: permanent === 'true' ? 'permanent_delete_post' : 'soft_delete_post',
      module: 'post',
      description: `管理员${permanent === 'true' ? '彻底' : '软'}删除帖子，ID:${id}`,
      status: 'success'
    });

    res.json({ message: `帖子已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    res.status(500).json({ error: '删除帖子失败' });
  }
});

router.delete('/comments/:id', requirePermission('post:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) {
        return res.status(403).json({ error: '只有超级管理员可以彻底删除评论' });
      }
      await query('DELETE FROM post_comments WHERE id = ?', [id]);
    } else {
      await query('UPDATE post_comments SET is_visible = 0 WHERE id = ?', [id]);
    }
    
    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: permanent === 'true' ? 'permanent_delete_comment' : 'soft_delete_comment',
      module: 'post',
      description: `管理员${permanent === 'true' ? '彻底' : '软'}删除评论，ID:${id}`,
      status: 'success'
    });

    res.json({ message: `评论已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    res.status(500).json({ error: '删除评论失败' });
  }
});

// 话题管理
router.get('/topics', requirePermission('topic:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = `
      SELECT t.*, u.username, u.nickname
      FROM topics t
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (!showInvisible) {
      sql += ' AND t.is_visible = 1';
    }

    if (search) {
      sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [topics] = await query(sql, params);
    res.json({ topics });
  } catch (error) {
    res.status(500).json({ error: '获取话题列表失败' });
  }
});

router.get('/topics/:id', requirePermission('topic:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const isSuper = await isSuperAdmin(req.user.id);

    const [topics] = await query(
      `SELECT t.*, u.username, u.nickname, u.avatar
       FROM topics t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ? ${!isSuper ? 'AND t.is_visible = 1' : ''}`,
      [id]
    );

    if (!topics || topics.length === 0) {
      return res.status(404).json({ error: '话题不存在或不可见' });
    }

    const [posts] = await query(
      `SELECT p.*, u.username, u.nickname
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.topic_id = ? ${!isSuper ? 'AND p.is_visible = 1' : ''}
       ORDER BY p.created_at DESC`,
      [id]
    );

    res.json({ topic: topics[0], posts });
  } catch (error) {
    res.status(500).json({ error: '获取话题详情失败' });
  }
});

router.delete('/topics/:id', requirePermission('topic:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) {
        return res.status(403).json({ error: '只有超级管理员可以彻底删除话题' });
      }
      await query('DELETE FROM topics WHERE id = ?', [id]);
    } else {
      await query('UPDATE topics SET is_visible = 0, status = "deleted" WHERE id = ?', [id]);
    }

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: permanent === 'true' ? 'permanent_delete_topic' : 'soft_delete_topic',
      module: 'topic',
      description: `管理员${permanent === 'true' ? '彻底' : '软'}删除话题，ID:${id}`,
      status: 'success'
    });

    res.json({ message: `话题已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    res.status(500).json({ error: '删除话题失败' });
  }
});

// 群聊管理
router.get('/groups', requirePermission('group:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = `
      SELECT g.*, u.username as creator_username, u.nickname as creator_nickname
      FROM chat_groups g
      JOIN users u ON g.creator_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (!showInvisible) {
      sql += ' AND g.is_visible = 1';
    }

    if (search) {
      sql += ' AND (g.name LIKE ? OR g.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [groups] = await query(sql, params);
    res.json({ groups });
  } catch (error) {
    console.error('获取群聊列表失败:', error);
    res.status(500).json({ error: '获取群聊列表失败' });
  }
});

router.delete('/groups/:id', requirePermission('group:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) {
        return res.status(403).json({ error: '只有超级管理员可以彻底删除群聊' });
      }
      await transaction(async (connection) => {
        await connection.query('DELETE FROM chat_group_members WHERE group_id = ?', [id]);
        await connection.query('DELETE FROM chat_groups WHERE id = ?', [id]);
      });
    } else {
      await query('UPDATE chat_groups SET is_visible = 0 WHERE id = ?', [id]);
    }

    await logOperation({
      user_id: req.user.id,
      username: req.user.username,
      action: permanent === 'true' ? 'permanent_delete_group' : 'soft_delete_group',
      module: 'group',
      description: `管理员${permanent === 'true' ? '彻底' : '软'}删除群聊，ID:${id}`,
      status: 'success'
    });

    res.json({ message: `群聊已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    console.error('删除群聊失败:', error);
    res.status(500).json({ error: '删除群聊失败' });
  }
});

// 监控路由
router.get('/monitoring/online-users', requirePermission('system:monitor'), async (req, res) => {
  try {
    const activeIds = typeof getActiveUserIds === 'function' ? getActiveUserIds() : [];
    if (!activeIds.length) {
      return res.json({ total: 0, details: [] });
    }
    const placeholders = activeIds.map(() => '?').join(',');
    const [users] = await query(
      `SELECT id, username, nickname, avatar, last_login_at
       FROM users 
       WHERE id IN (${placeholders})
       ORDER BY last_login_at DESC
       LIMIT 50`,
      activeIds
    );
    res.json({
      total: users.length,
      details: users.map(u => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        last_active: u.last_login_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: '获取在线用户统计失败' });
  }
});

// 聊天记录管理
router.get('/messages', requirePermission('message:read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', user_id, receiver_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = `
      SELECT m.*, u1.username as sender_username, u2.username as receiver_username
      FROM messages m
      JOIN users u1 ON m.sender_id = u1.id
      LEFT JOIN users u2 ON m.receiver_id = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (!showInvisible) {
      sql += ' AND m.is_visible = 1';
    }

    if (user_id && receiver_id) {
      sql += ' AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))';
      params.push(user_id, receiver_id, receiver_id, user_id);
    } else if (user_id) {
      sql += ' AND (m.sender_id = ? OR m.receiver_id = ?)';
      params.push(user_id, user_id);
    }

    if (search) {
      sql += ' AND (m.content LIKE ? OR u1.username LIKE ? OR u2.username LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [messages] = await query(sql, params);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: '获取消息列表失败' });
  }
});

router.delete('/messages/:id', requirePermission('message:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) return res.status(403).json({ error: '只有超级管理员可以彻底删除消息' });
      await query('DELETE FROM messages WHERE id = ?', [id]);
    } else {
      await query('UPDATE messages SET is_visible = 0 WHERE id = ?', [id]);
    }

    res.json({ message: `消息已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    res.status(500).json({ error: '删除消息失败' });
  }
});

// 游戏房间管理
router.get('/games/rooms', requirePermission('game:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isSuper = await isSuperAdmin(req.user.id);
    const showInvisible = isSuper && req.query.show_invisible === 'true';

    let sql = 'SELECT * FROM game_rooms WHERE 1=1';
    const params = [];

    if (!showInvisible) {
      sql += ' AND is_visible = 1';
    }

    if (search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rooms] = await query(sql, params);
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ error: '获取游戏房间列表失败' });
  }
});

router.delete('/games/rooms/:id', requirePermission('game:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const isSuper = await isSuperAdmin(req.user.id);

    if (permanent === 'true') {
      if (!isSuper) return res.status(403).json({ error: '只有超级管理员可以彻底删除游戏房间' });
      await query('DELETE FROM game_rooms WHERE id = ?', [id]);
    } else {
      await query('UPDATE game_rooms SET is_visible = 0 WHERE id = ?', [id]);
    }

    res.json({ message: `游戏房间已${permanent === 'true' ? '彻底' : '软'}删除` });
  } catch (error) {
    res.status(500).json({ error: '删除游戏房间失败' });
  }
});

export default router;
