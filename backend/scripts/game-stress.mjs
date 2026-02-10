import https from 'node:https';
import assert from 'node:assert/strict';
import axios from 'axios';
import { io } from 'socket.io-client';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.BASE_URL || 'https://localhost:888';
const PAIRS = Math.max(1, Number(process.env.PAIRS || 5));

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

async function waitFinished(socket, timeoutMs = 25000) {
  const finished = await once(socket, 'game:finished', timeoutMs);
  assert.ok(finished?.gameId);
  assert.ok(finished?.winnerId);
  return finished;
}

async function playGomokuOwnerWin({ ownerSocket, p2Socket, roomId }) {
  const moves = [
    [ownerSocket, 7, 7],
    [p2Socket, 7, 8],
    [ownerSocket, 8, 7],
    [p2Socket, 8, 8],
    [ownerSocket, 9, 7],
    [p2Socket, 9, 8],
    [ownerSocket, 10, 7],
    [p2Socket, 10, 8],
    [ownerSocket, 11, 7]
  ];

  const finishedPromise = waitFinished(ownerSocket, 30000);
  for (const [s, x, y] of moves) {
    s.emit('game:action', { roomId, action: 'move', payload: { x, y } });
    await once(ownerSocket, 'game:state_update', 12000).catch(() => null);
  }
  return await finishedPromise;
}

async function runPair(index) {
  const suffix = nowId();
  const password = 'Passw0rd123';
  const ownerU = {
    username: `st_o${index}_${suffix}`,
    nickname: `房主${index}`,
    phone: `138${String(Math.floor(10000000 + Math.random() * 89999999))}`,
    email: `st_o${index}_${suffix}@example.com`,
    password
  };
  const p2U = {
    username: `st_p${index}_${suffix}`,
    nickname: `玩家${index}`,
    phone: `139${String(Math.floor(10000000 + Math.random() * 89999999))}`,
    email: `st_p${index}_${suffix}@example.com`,
    password
  };

  const owner = await registerOrLogin(ownerU);
  const p2 = await registerOrLogin(p2U);
  await ensureChips(owner.token);
  await ensureChips(p2.token);

  const gameTypeId = await getGameTypeIdByCode(owner.token, 'wuziqi');
  const room = await createRoom(owner.token, { gameTypeId, name: `ST-${index}-${suffix}`, maxPlayers: 2 });
  await joinRoom(p2.token, room.room_code);

  const ownerSocket = createSocket(owner.token);
  const p2Socket = createSocket(p2.token);
  await connectSocket(ownerSocket);
  await connectSocket(p2Socket);

  const lastActions = { owner: null, p2: null };
  ownerSocket.on('game:error', (e) => {
    lastActions.owner = e;
  });
  p2Socket.on('game:error', (e) => {
    lastActions.p2 = e;
  });

  await joinRoomSocket(ownerSocket, room.id);
  await joinRoomSocket(p2Socket, room.id);
  await ready(p2Socket, room.id, true);
  await startGame(ownerSocket, room.id);

  const finished = await playGomokuOwnerWin({ ownerSocket, p2Socket, roomId: room.id });
  assert.ok(finished?.winnerId);
  assert.equal(lastActions.owner, null);
  assert.equal(lastActions.p2, null);

  ownerSocket.emit('game:leave_room', { roomId: room.id });
  p2Socket.emit('game:leave_room', { roomId: room.id });
  ownerSocket.disconnect();
  p2Socket.disconnect();

  await destroyRoom(owner.token, room.id);
  return { index, roomId: room.id, winnerId: finished.winnerId };
}

async function main() {
  const tasks = [];
  for (let i = 0; i < PAIRS; i++) tasks.push(runPair(i + 1));
  const results = await Promise.all(tasks);
  process.stdout.write(`game-stress: ok pairs=${PAIRS} results=${JSON.stringify(results)}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
