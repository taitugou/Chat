import axios from 'axios';
import https from 'https';

const baseURL = process.env.OAUTH_BASE_URL || 'https://localhost:888';
const clientId = process.env.OAUTH_CLIENT_ID || 'test_client';
const clientSecret = process.env.OAUTH_CLIENT_SECRET || 'test_secret';
const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback';

const account = process.env.OAUTH_TEST_ACCOUNT || '';
const password = process.env.OAUTH_TEST_PASSWORD || '';

const isLocalHttps =
  /^https:\/\//i.test(baseURL) &&
  /(localhost|127\.0\.0\.1|\[::1\])/i.test(baseURL);

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  ...(isLocalHttps ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } : {})
});

function fail(message, details) {
  if (details) {
    console.error(message, details);
  } else {
    console.error(message);
  }
  process.exit(1);
}

async function getUserToken() {
  if (account && password) {
    const res = await api.post('/api/auth/login', { account, password, rememberMe: false });
    return res.data.token;
  }
  const res = await api.post('/api/auth/guest-login');
  return res.data.token;
}

async function main() {
  console.log(`[oauth-e2e] baseURL=${baseURL}`);

  const userToken = await getUserToken();
  if (!userToken) fail('[oauth-e2e] 未能获取用户 Token');

  const clientRes = await api.get(`/api/oauth/client/${encodeURIComponent(clientId)}`, {
    params: { redirect_uri: redirectUri }
  });
  if (!clientRes.data?.clientId) fail('[oauth-e2e] 获取客户端信息失败', clientRes.data);

  const codeRes = await api.post(
    '/api/oauth/authorize',
    { clientId, redirectUri },
    { headers: { Authorization: `Bearer ${userToken}` } }
  );

  const code = codeRes.data?.code;
  if (!code) fail('[oauth-e2e] 未获取到授权码', codeRes.data);

  const tokenRes = await api.post('/api/oauth/token', {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const accessToken = tokenRes.data?.access_token;
  if (!accessToken) fail('[oauth-e2e] 未获取到 access_token', tokenRes.data);

  const userInfoRes = await api.get('/api/oauth/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const sub = userInfoRes.data?.sub;
  const username = userInfoRes.data?.preferred_username;
  if (!sub || !username) fail('[oauth-e2e] userinfo 响应缺少字段', userInfoRes.data);

  console.log('[oauth-e2e] OK', { sub, preferred_username: username });
}

main().catch((err) => {
  const status = err.response?.status;
  const data = err.response?.data;
  fail('[oauth-e2e] FAILED', { status, data, message: err.message });
});
