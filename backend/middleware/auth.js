import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../database/connection.js';
import { getUserRoles } from './permission.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    let token;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token) {
      token = req.query.token;
    } else {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);

      const [users] = await query(
        'SELECT id, username, status FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (!users || users.length === 0) {
        return res.status(401).json({ error: '用户不存在' });
      }

      const user = users[0];

      if (user.status !== 'active') {
        return res.status(403).json({ error: '账号已冻结' });
      }

      // 获取用户角色
      const roles = await getUserRoles(user.id);

      req.user = {
        id: parseInt(user.id),
        username: user.username,
        roles: roles.map(r => r.name),
        isAdmin: roles.some(r => r.name === 'admin' || r.name === 'super_admin')
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: '令牌已过期' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: '无效的令牌' });
      }
      throw error;
    }
  } catch (error) {
    console.error('认证中间件错误:', error);
    return res.status(500).json({ error: '认证失败' });
  }
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const userId = parseInt(decoded.userId);
    
    const [users] = await query(
      'SELECT id, username FROM users WHERE id = ?',
      [userId]
    );

    if (users && users.length > 0) {
      const roles = await getUserRoles(userId);
      req.user = { 
        id: userId,
        username: users[0].username,
        roles: roles.map(r => r.name),
        isAdmin: roles.some(r => r.name === 'admin' || r.name === 'super_admin')
      };
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

