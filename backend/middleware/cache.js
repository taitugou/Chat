import { getRedisClient } from '../database/redis.js';

export const cacheMiddleware = (duration) => {
  return async (req, res, next) => {
    // 只缓存 GET 请求
    if (req.method !== 'GET') {
      return next();
    }

    // 话题广场、设置等公共且不常变动的数据可以缓存
    // 这里我们为未登录用户提供缓存，或者通用的缓存
    const key = `api-cache:${req.originalUrl || req.url}`;

    try {
      let redis;
      try {
        redis = getRedisClient();
      } catch (e) {
        return next(); // Redis 未就绪则跳过
      }

      const cachedResponse = await redis.get(key);
      if (cachedResponse) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache', 'HIT');
        return res.send(cachedResponse);
      }

      // 劫持 res.send 来存储缓存
      const originalSend = res.send.bind(res);
      res.send = (body) => {
        if (res.statusCode === 200) {
          // 只有 200 响应才缓存
          redis.setex(key, duration, typeof body === 'string' ? body : JSON.stringify(body));
        }
        res.setHeader('X-Cache', 'MISS');
        return originalSend(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};
