export function errorHandler(err, req, res, next) {
  console.error('错误:', err);

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: '无效的认证令牌' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: '认证令牌已过期' });
  }

  // 验证错误
  if (err.isJoi) {
    return res.status(400).json({ 
      error: '验证失败', 
      details: err.details 
    });
  }

  // 数据库错误
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: '数据已存在' });
  }

  // 默认错误
  const status = err.status || err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(status).json({
    success: false,
    message,
    error: message, // 兼容旧版
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

