import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * 辅助函数：归一化 URI，用于模糊匹配
 * 1. 移除协议头 (http://, https://)
 * 2. 移除末尾斜杠 (/)
 */
const normalizeUri = (uri) => {
  if (!uri) return '';
  return uri.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
};

const parseRedirectUris = (redirectUris) => {
  if (!redirectUris) return [];
  return String(redirectUris)
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
};

const normalizeRedirectPattern = (uri) => {
  const raw = String(uri || '').trim();
  if (!raw) return '';
  if (raw === '*') return '*';
  if (raw.endsWith('*')) return `${normalizeUri(raw.slice(0, -1))}*`;
  return normalizeUri(raw);
};

const isAllowedRedirectUri = (requestedUri, allowedUris) => {
  if (config.oauth?.allowAnyRedirectUri) return true;
  if (!requestedUri) return false;
  const normalizedRequestUri = normalizeUri(requestedUri);
  return allowedUris.some((u) => {
    const pattern = normalizeRedirectPattern(u);
    if (!pattern) return false;
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) return normalizedRequestUri.startsWith(pattern.slice(0, -1));
    return pattern === normalizedRequestUri;
  });
};

/**
 * @route GET /api/oauth/client/:clientId
 */
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { redirect_uri } = req.query;

    const [clients] = await query(
      'SELECT client_id, client_name, redirect_uris, redirect_blacklist FROM oauth_clients WHERE client_id = ?',
      [clientId]
    );

    if (!clients || clients.length === 0) {
      return res.status(404).json({ error: '客户端不存在' });
    }

    const client = clients[0];
    const blacklist = client.redirect_blacklist ? client.redirect_blacklist.split(',') : [];
    const allowedUris = parseRedirectUris(client.redirect_uris);

    // 使用归一化匹配黑名单
    const normalizedRequestUri = normalizeUri(redirect_uri);
    if (redirect_uri && blacklist.some(item => normalizeUri(item) === normalizedRequestUri)) {
      return res.status(400).json({ 
        error: '无效的重定向 URI',
        message: '该地址已被列入黑名单，禁止访问'
      });
    }

    if (redirect_uri && !isAllowedRedirectUri(redirect_uri, allowedUris)) {
      return res.status(400).json({
        error: '无效的重定向 URI',
        message: '该地址未在白名单中'
      });
    }

    res.json({
      clientId: client.client_id,
      clientName: client.client_name,
      redirectUri: redirect_uri || allowedUris[0]
    });
  } catch (error) {
    console.error('获取 OAuth 客户端失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * @route POST /api/oauth/authorize
 */
router.post('/authorize', authenticate, async (req, res) => {
  try {
    const { clientId, redirectUri } = req.body;
    const userId = req.user.id;

    if (!clientId || !redirectUri) {
      return res.status(400).json({ error: '无效的授权请求参数' });
    }

    // 校验客户端
    const [clients] = await query(
      'SELECT redirect_uris, redirect_blacklist FROM oauth_clients WHERE client_id = ?',
      [clientId]
    );

    if (!clients || clients.length === 0) {
      return res.status(404).json({ error: '客户端不存在' });
    }

    const client = clients[0];
    const blacklist = client.redirect_blacklist ? client.redirect_blacklist.split(',') : [];
    const allowedUris = parseRedirectUris(client.redirect_uris);
    
    // 使用归一化匹配黑名单
    const normalizedRequestUri = normalizeUri(redirectUri);
    if (redirectUri && blacklist.some(item => normalizeUri(item) === normalizedRequestUri)) {
      return res.status(400).json({ 
        error: '无效的重定向 URI',
        message: '该地址已被列入黑名单，禁止访问'
      });
    }

    if (!isAllowedRedirectUri(redirectUri, allowedUris)) {
      return res.status(400).json({
        error: '无效的重定向 URI',
        message: '该地址未在白名单中'
      });
    }

    // 生成授权码
    const code = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟有效期

    await query(
      'INSERT INTO oauth_codes (code, client_id, user_id, redirect_uri, expires_at) VALUES (?, ?, ?, ?, ?)',
      [code, clientId, userId, redirectUri, expiresAt]
    );

    res.json({ code });
  } catch (error) {
    console.error('生成授权码失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * @route POST /api/oauth/token
 */
router.post('/token', async (req, res) => {
  try {
    const { client_id, client_secret, code, redirect_uri, grant_type } = req.body;

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: '不支持的 grant_type' });
    }

    if (!client_id || !client_secret || !code || !redirect_uri) {
      return res.status(400).json({ error: '无效的授权请求参数' });
    }

    // 校验客户端
    const [clients] = await query(
      'SELECT id FROM oauth_clients WHERE client_id = ? AND client_secret = ?',
      [client_id, client_secret]
    );

    if (!clients || clients.length === 0) {
      return res.status(401).json({ error: '客户端认证失败' });
    }

    // 校验授权码
    const [codes] = await query(
      'SELECT user_id, redirect_uri, expires_at FROM oauth_codes WHERE code = ? AND client_id = ?',
      [code, client_id]
    );

    if (!codes || codes.length === 0) {
      return res.status(400).json({ error: '无效的授权码' });
    }

    const authCode = codes[0];

    if (new Date() > new Date(authCode.expires_at)) {
      return res.status(400).json({ error: '授权码已过期' });
    }

    // 使用归一化进行模糊匹配
    if (normalizeUri(authCode.redirect_uri) !== normalizeUri(redirect_uri)) {
      console.warn(`[OAuth] 重定向 URI 不匹配: 存储值="${authCode.redirect_uri}", 请求值="${redirect_uri}"`);
      return res.status(400).json({ error: '无效的重定向 URI' });
    }

    // 删除已使用的授权码
    await query('DELETE FROM oauth_codes WHERE code = ?', [code]);

    // 生成 Access Token (JWT)
    const accessToken = jwt.sign(
      { userId: authCode.user_id, clientId: client_id, scope: 'userinfo', type: 'oauth' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600
    });
  } catch (error) {
    console.error('交换令牌失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * @route GET /api/oauth/userinfo
 * @desc 使用 Access Token 获取用户信息
 */
router.get('/userinfo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret);

    const [users] = await query(
      'SELECT id, username, email, phone, avatar, nickname, bio FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];
    res.json({
      sub: user.id,
      name: user.nickname || user.username,
      preferred_username: user.username,
      email: user.email,
      phone_number: user.phone,
      picture: user.avatar,
      bio: user.bio
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(401).json({ error: '无效的令牌' });
  }
});

export default router;
