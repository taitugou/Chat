import Redis from 'ioredis';
import { config } from '../config.js';

let redisClient = null;

export async function initRedis() {
  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
    });

    redisClient.on('error', (err) => {
      console.error('Redis客户端错误:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis连接成功');
    });

    return redisClient;
  } catch (error) {
    console.error('Redis连接失败:', error);
    throw error;
  }
}

export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis客户端未初始化，请先调用 initRedis()');
  }
  return redisClient;
}

export function createRedisClient() {
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
  });
}

// Redis工具函数
export const redisUtils = {
  async get(key) {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },

  async set(key, value, expireSeconds = null) {
    const client = getRedisClient();
    const stringValue = JSON.stringify(value);
    if (expireSeconds) {
      await client.setex(key, expireSeconds, stringValue);
    } else {
      await client.set(key, stringValue);
    }
  },

  async del(key) {
    const client = getRedisClient();
    await client.del(key);
  },

  async exists(key) {
    const client = getRedisClient();
    return await client.exists(key);
  },

  async expire(key, seconds) {
    const client = getRedisClient();
    await client.expire(key, seconds);
  },
};
