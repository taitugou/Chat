import https from 'node:https';
import assert from 'node:assert/strict';
import axios from 'axios';
import { io } from 'socket.io-client';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.BASE_URL || 'https://localhost:888';
const PLAYERS = Math.max(2, Number(process.env.PLAYERS || 6));

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  httpsAgent,
  validateStatus: () => true
});

function isTransientNetworkError(error) {
  const code = error?.code || error?.cause?.code;
  if (code && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(code)) return true;
  if (error?.name === 'AggregateError') return true;
  const msg = String(error?.message || '');
  if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT')) return true;
  return false;
}

async function requestWithRetry(makeRequest, attempts = 5) {
  let lastError = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await makeRequest();
    } catch (e) {
      lastError = e;
      if (!isTransientNetworkError(e) || i === attempts) throw e;
      await new Promise((r) => setTimeout(r, 250 * i));
    }
  }
  throw lastError;
}

function tokenClient(token) {
  return axios.create({
    baseURL: `${BASE_URL}/api`,
    timeout: 20000,
    httpsAgent,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true
  });
}

function nowId() {
  const a = Math.random().toString(36).slice(2, 8);
  const b = Date.now().toString(36).slice(-6);
  return `${a}${b}`;
}

async function registerOrLogin({ username, nickname, phone, email, password }) {
  const registerRes = await requestWithRetry(() =>
    http.post('/api/auth/register', { username, nickname, phone, email, password })
  );
  if (registerRes.status === 201 && registerRes.data?.token && registerRes.data?.user?.id) {
    return { token: registerRes.data.token, userId: registerRes.data.user.id, username };
  }
  const loginRes = await requestWithRetry(() =>
    http.post('/api/auth/login', { account: username, password, rememberMe: false })
  );
  assert.equal(loginRes.status, 200);
  return { token: loginRes.data.token, userId: loginRes.data.user.id, username };
}

async function ensureChips(token) {
  const api = tokenClient(token);
  const statusRes = await requestWithRetry(() => api.get('/chips/checkin/status'));
  assert.equal(statusRes.status, 200);
  if (!statusRes.data?.hasCheckedIn) {
    const checkinRes = await requestWithRetry(() => api.post('/chips/checkin'));
    assert.equal(checkinRes.status, 200);
  }
  const chipsRes = await requestWithRetry(() => api.get('/chips'));
  assert.equal(chipsRes.status, 200);
  assert.ok(Number(chipsRes.data?.chips?.balance || 0) >= 200);
  return Number(chipsRes.data.chips.balance);
}

async function getGameTypeIdByCode(token, code) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() => api.get('/games/types'));
  assert.equal(res.status, 200);
  const found = (res.data?.gameTypes || []).find((g) => g.code === code);
  assert.ok(found, `game type not found: ${code}`);
  return found.id;
}

async function createRoom(token, { gameTypeId, name, maxPlayers }) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() => api.post('/rooms', { gameTypeId, name, maxPlayers, permission: 'public' }));
  assert.equal(res.status, 200);
  return res.data.room;
}

async function joinRoom(token, roomCode) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() => api.post('/rooms/join', { roomCode }));
  assert.equal(res.status, 200);
  return res.data.room;
}

async function destroyRoom(token, roomId) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() => api.post(`/rooms/${roomId}/destroy`));
  if (res.status !== 200 && res.status !== 404) {
    process.stdout.write(`destroyRoom: status=${res.status} body=${JSON.stringify(res.data)}\n`);
  }
}

function createSocket(token) {
  return io(BASE_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
    reconnection: false,
    timeout: 12000,
    transportOptions: {
      websocket: { rejectUnauthorized: false }
    }
  });
}

function once(socket, event, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

function watchLatestState(socket) {
  let latest = null;
  const handler = (data) => {
    latest = data?.gameState || data || null;
  };
  socket.on('game:state_update', handler);
  return {
    getLatest: () => latest,
    stop: () => socket.off('game:state_update', handler)
  };
}

async function connectSocket(socket) {
  if (socket.connected) return;
  await Promise.race([
    once(socket, 'connect', 12000),
    once(socket, 'connect_error', 12000).then((e) => Promise.reject(e))
  ]);
}

async function joinRoomSocket(socket, roomId) {
  socket.emit('game:join_room', { roomId });
  await once(socket, 'game:player_joined', 8000).catch(() => null);
  await once(socket, 'game:state_update', 8000).catch(() => null);
}

async function ready(socket, roomId, isReady) {
  const p = once(socket, 'game:player_ready', 8000).catch(() => null);
  socket.emit('game:player_ready', { roomId, isReady });
  await p;
}

async function startGame(socket, roomId) {
  const p = once(socket, 'game:started', 15000);
  socket.emit('game:start', { roomId });
  const started = await p;
  assert.ok(started?.gameId);
  return started;
}

async function main() {
  const suffix = nowId();
  const password = 'Passw0rd123';

  const users = [];
  for (let i = 0; i < PLAYERS; i++) {
    const uid = `${i + 1}_${suffix}`;
    users.push({
      username: `db_u${uid}`,
      nickname: `玩家${i + 1}`,
      phone: `13${String(80 + i)}${String(Math.floor(1000000 + Math.random() * 8999999))}`,
      email: `db_u${uid}@example.com`,
      password
    });
  }

  const accounts = await Promise.all(users.map(registerOrLogin));
  const balancesBefore = new Map();
  for (const a of accounts) {
    balancesBefore.set(a.userId, await ensureChips(a.token));
  }

  const owner = accounts[0];
  const gameTypeId = await getGameTypeIdByCode(owner.token, 'touzi_bao');
  const room = await createRoom(owner.token, { gameTypeId, name: `DBST-${suffix}`, maxPlayers: PLAYERS });

  for (let i = 1; i < accounts.length; i++) {
    await joinRoom(accounts[i].token, room.room_code);
  }

  const sockets = accounts.map((a) => createSocket(a.token));
  for (const s of sockets) await connectSocket(s);
  for (const s of sockets) await joinRoomSocket(s, room.id);
  for (let i = 1; i < sockets.length; i++) await ready(sockets[i], room.id, true);

  const started = await startGame(sockets[0], room.id);
  assert.ok(started?.gameId);

  const betAmount = 10;
  const picks = ['big', 'small'];
  const socketByUserId = new Map(accounts.map((a, idx) => [Number(a.userId), sockets[idx]]));
  const stateWatcher = watchLatestState(sockets[0]);

  let currentPlayer = Number(started?.gameState?.currentPlayer || 0);
  for (let i = 0; i < sockets.length; i++) {
    if (!currentPlayer) {
      const latest = stateWatcher.getLatest();
      currentPlayer = Number(latest?.currentPlayer || 0);
    }
    const actor = socketByUserId.get(currentPlayer) || sockets[i];
    const pick = picks[i % 2];
    actor.emit('game:action', { roomId: room.id, action: 'place_bet', payload: { selection: pick, amount: betAmount } });
    await once(sockets[0], 'game:player_bet', 12000).catch(() => null);
    await once(sockets[0], 'game:state_update', 12000).catch(() => null);
    const latest = stateWatcher.getLatest();
    currentPlayer = Number(latest?.currentPlayer || 0);
  }
  stateWatcher.stop();

  const finishedP = once(sockets[0], 'game:finished', 20000);
  sockets[0].emit('game:action', { roomId: room.id, action: 'roll', payload: {} });
  const finished = await finishedP;
  assert.ok(finished?.winnerId);

  const balancesAfter = new Map();
  for (const a of accounts) {
    const api = tokenClient(a.token);
    const chipsRes = await requestWithRetry(() => api.get('/chips'));
    assert.equal(chipsRes.status, 200);
    balancesAfter.set(a.userId, Number(chipsRes.data?.chips?.balance || 0));
  }

  const net = Array.from(balancesAfter.entries()).reduce((s, [uid, bal]) => {
    return s + (bal - Number(balancesBefore.get(uid) || 0));
  }, 0);

  process.stdout.write(
    `game-stress-dicebao: ok players=${PLAYERS} roomId=${room.id} gameId=${finished.gameId} netDelta=${net}\n`
  );

  await destroyRoom(owner.token, room.id);

  for (const s of sockets) {
    try {
      s.disconnect();
    } catch {}
  }

  for (const a of accounts) {
    const api = tokenClient(a.token);
    await requestWithRetry(() => api.post('/rooms/leave-all')).catch(() => null);
  }
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
