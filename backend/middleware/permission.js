import { query } from '../database/connection.js';

export async function checkPermission(userId, requiredPermission) {
  try {
    const [userRoles] = await query(
      `SELECT r.name, r.permissions 
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId]
    );

    if (!userRoles || userRoles.length === 0) {
      return false;
    }

    for (const role of userRoles) {
      if (role.name === 'super_admin') return true;
      const permissions = role.permissions;
      if (permissions && Array.isArray(permissions)) {
        if (permissions.includes('*')) {
          return true;
        }
        if (permissions.includes(requiredPermission)) {
          return true;
        }
        if (requiredPermission.includes(':')) {
          const [resource, action] = requiredPermission.split(':');
          if (permissions.includes(`${resource}:*`)) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error('权限检查失败:', error);
    return false;
  }
}

export async function isSuperAdmin(userId) {
  try {
    const [roles] = await query(
      `SELECT r.name 
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND r.name = 'super_admin' AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId]
    );
    return roles && roles.length > 0;
  } catch (error) {
    console.error('检查超级管理员失败:', error);
    return false;
  }
}

export function requirePermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: '未登录' });
      }

      const hasPermission = await checkPermission(req.user.id, requiredPermission);
      if (!hasPermission) {
        return res.status(403).json({ error: '权限不足' });
      }

      next();
    } catch (error) {
      console.error('权限中间件错误:', error);
      res.status(500).json({ error: '权限验证失败' });
    }
  };
}

export function requireRole(roleName) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: '未登录' });
      }

      const [userRoles] = await query(
        `SELECT r.name 
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ? AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
        [req.user.id]
      );

      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ error: '无角色' });
      }

      const roleNames = userRoles.map(r => r.name);
      if (!roleNames.includes(roleName) && !roleNames.includes('super_admin')) {
        return res.status(403).json({ error: '角色权限不足' });
      }

      next();
    } catch (error) {
      console.error('角色中间件错误:', error);
      res.status(500).json({ error: '角色验证失败' });
    }
  };
}

export async function getUserRoles(userId) {
  try {
    const [roles] = await query(
      `SELECT r.id, r.name, r.display_name, r.description, r.permissions, ur.assigned_at, ur.expires_at
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       ORDER BY ur.assigned_at DESC`,
      [userId]
    );
    return roles || [];
  } catch (error) {
    console.error('获取用户角色失败:', error);
    return [];
  }
}

export async function assignRole(userId, roleId, assignedBy, expiresAt = null) {
  try {
    await query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
      [userId, roleId, assignedBy, expiresAt]
    );
    return true;
  } catch (error) {
    console.error('分配角色失败:', error);
    throw error;
  }
}

export async function removeRole(userId, roleId) {
  try {
    await query(
      `DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`,
      [userId, roleId]
    );
    return true;
  } catch (error) {
    console.error('移除角色失败:', error);
    throw error;
  }
}
