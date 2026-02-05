import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../database/connection.js';

export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.substring(7);
    
    if (!token) {
      return next(new Error('未提供认证令牌'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // 检查用户状态
      const [users] = await query(
        'SELECT id, username, status FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (!users || users.length === 0) {
        return next(new Error('用户不存在'));
      }

      const user = users[0];
      
      if (user.status !== 'active') {
        return next(new Error('账号已冻结'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      socket.data.userId = user.id;
      socket.data.username = user.username;
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new Error('令牌已过期'));
      }
      if (error.name === 'JsonWebTokenError') {
        return next(new Error('无效的令牌'));
      }
      throw error;
    }
  } catch (error) {
    console.error('Socket认证错误:', error);
    next(new Error('认证失败'));
  }
}

