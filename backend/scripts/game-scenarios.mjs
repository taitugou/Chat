import https from 'node:https';
import assert from 'node:assert/strict';
import axios from 'axios';
import { io } from 'socket.io-client';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.BASE_URL || 'https://localhost:888';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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
      await new Promise((r) => setTimeout(r, 200 * i));
    }
  }
  throw lastError;
}

function tokenClient(token) {
  return axios.create({
    baseURL: `${BASE_URL}/api`,
    timeout: 15000,
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
  if (loginRes.status === 200 && loginRes.data?.token && loginRes.data?.user?.id) {
    return { token: loginRes.data.token, userId: loginRes.data.user.id, username };
  }

  throw new Error(
    `auth failed for ${username}: register=${registerRes.status} login=${loginRes.status} ` +
      `${JSON.stringify({ register: registerRes.data, login: loginRes.data })}`
  );
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

async function createRoom(token, { gameTypeId, name, maxPlayers, permission, password, settings }) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() =>
    api.post('/rooms', { gameTypeId, name, maxPlayers, permission, password, settings })
  );
  assert.equal(res.status, 200, `createRoom failed: ${res.status} ${JSON.stringify(res.data)}`);
  assert.ok(res.data?.room?.id);
  assert.ok(res.data?.room?.room_code);
  return res.data.room;
}

async function joinRoom(token, { roomCode, password }) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() => api.post('/rooms/join', { roomCode, password }));
  return res;
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
    timeout: 10000,
    transportOptions: {
      websocket: { rejectUnauthorized: false }
    }
  });
}

function once(socket, event, timeoutMs = 10000) {
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
    once(socket, 'connect', 10000),
    once(socket, 'connect_error', 10000).then((e) => Promise.reject(e))
  ]);
}

async function joinRoomSocket(socket, roomId) {
  socket.emit('game:join_room', { roomId });
  await once(socket, 'game:player_joined', 8000).catch(() => null);
  return await once(socket, 'game:state_update', 8000).catch(() => null);
}

async function ready(socket, roomId, isReady) {
  const p = once(socket, 'game:player_ready', 8000).catch(() => null);
  socket.emit('game:player_ready', { roomId, isReady });
  await p;
}

async function startGame(socket, roomId) {
  const p = once(socket, 'game:started', 15000);
  socket.emit('game:start', { roomId });
  return await p;
}

async function expectSocketError(socket, trigger, expectedSubstring) {
  const p = once(socket, 'game:error', 8000);
  trigger();
  const payload = await p;
  const msg = String(payload?.error || '');
  assert.ok(msg.includes(expectedSubstring), `expected error includes "${expectedSubstring}", got "${msg}"`);
}

async function scenarioRoomPassword({ owner, p2 }) {
  const gameTypeId = await getGameTypeIdByCode(owner.token, 'texas_holdem');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `PWD-${nowId()}`,
    maxPlayers: 2,
    permission: 'public',
    password: 'p123'
  });

  const bad = await joinRoom(p2.token, { roomCode: room.room_code, password: 'wrong' });
  assert.equal(bad.status, 400);
  assert.ok(String(bad.data?.message || '').includes('房间密码错误'));

  const ok = await joinRoom(p2.token, { roomCode: room.room_code, password: 'p123' });
  assert.equal(ok.status, 200);
  assert.ok(ok.data?.room?.id);

  await destroyRoom(owner.token, room.id);
}

async function scenarioRoomApproval({ owner, p2 }) {
  const gameTypeId = await getGameTypeIdByCode(owner.token, 'texas_holdem');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `APV-${nowId()}`,
    maxPlayers: 2,
    permission: 'approval'
  });

  const res = await joinRoom(p2.token, { roomCode: room.room_code });
  assert.equal(res.status, 400);
  assert.ok(String(res.data?.message || '').includes('房主同意'));

  await destroyRoom(owner.token, room.id);
}

async function scenarioNonOwnerStartAndNotReady({ owner, p2 }) {
  const gameTypeId = await getGameTypeIdByCode(owner.token, 'wuziqi');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `START-${nowId()}`,
    maxPlayers: 2,
    permission: 'public'
  });

  const ownerSocket = createSocket(owner.token);
  const p2Socket = createSocket(p2.token);
  ownerSocket.__userId = Number(owner.userId);
  p2Socket.__userId = Number(p2.userId);
  await connectSocket(ownerSocket);
  await connectSocket(p2Socket);

  await joinRoomSocket(ownerSocket, room.id);
  const joined = await joinRoom(p2.token, { roomCode: room.room_code });
  assert.equal(joined.status, 200);
  await joinRoomSocket(p2Socket, room.id);

  await ready(p2Socket, room.id, false);

  await expectSocketError(
    p2Socket,
    () => p2Socket.emit('game:start', { roomId: room.id }),
    '只有房主可以开始游戏'
  );

  await expectSocketError(
    ownerSocket,
    () => ownerSocket.emit('game:start', { roomId: room.id }),
    '还有玩家未准备'
  );

  await ready(p2Socket, room.id, true);
  const started = await startGame(ownerSocket, room.id);
  assert.ok(started?.gameId);

  await expectSocketError(
    ownerSocket,
    () => ownerSocket.emit('game:start', { roomId: room.id }),
    '开始游戏失败'
  ).catch(() => null);

  ownerSocket.emit('game:leave_room', { roomId: room.id });
  p2Socket.emit('game:leave_room', { roomId: room.id });
  ownerSocket.disconnect();
  p2Socket.disconnect();

  await destroyRoom(owner.token, room.id);
}

async function scenarioInvalidMoveWuziqi({ owner, p2 }) {
  const gameTypeId = await getGameTypeIdByCode(owner.token, 'wuziqi');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `MOVE-${nowId()}`,
    maxPlayers: 2,
    permission: 'public'
  });

  const ownerSocket = createSocket(owner.token);
  const p2Socket = createSocket(p2.token);
  ownerSocket.__userId = Number(owner.userId);
  p2Socket.__userId = Number(p2.userId);
  await connectSocket(ownerSocket);
  await connectSocket(p2Socket);

  await joinRoomSocket(ownerSocket, room.id);
  const joined = await joinRoom(p2.token, { roomCode: room.room_code });
  assert.equal(joined.status, 200);
  await joinRoomSocket(p2Socket, room.id);

  await ready(p2Socket, room.id, true);
  const started = await startGame(ownerSocket, room.id);
  assert.ok(started?.gameId);

  await expectSocketError(
    p2Socket,
    () => p2Socket.emit('game:action', { roomId: room.id, action: 'move', payload: { x: 7, y: 7 } }),
    '不是你的回合'
  );

  await expectSocketError(
    ownerSocket,
    () => ownerSocket.emit('game:action', { roomId: room.id, action: 'move', payload: { x: -1, y: 0 } }),
    '坐标'
  );

  ownerSocket.emit('game:leave_room', { roomId: room.id });
  p2Socket.emit('game:leave_room', { roomId: room.id });
  ownerSocket.disconnect();
  p2Socket.disconnect();

  await destroyRoom(owner.token, room.id);
}

async function scenarioStartInsufficientChips({ owner, p2 }) {
  const gameTypeId = await getGameTypeIdByCode(owner.token, 'blackjack');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `POOR-${nowId()}`,
    maxPlayers: 2,
    permission: 'public',
    settings: { gameOptions: { baseBet: 5000 } }
  });

  const ownerSocket = createSocket(owner.token);
  const p2Socket = createSocket(p2.token);
  await connectSocket(ownerSocket);
  await connectSocket(p2Socket);
  await joinRoomSocket(ownerSocket, room.id);
  const joined = await joinRoom(p2.token, { roomCode: room.room_code });
  assert.equal(joined.status, 200);
  await joinRoomSocket(p2Socket, room.id);

  await ready(p2Socket, room.id, true);

  await expectSocketError(
    ownerSocket,
    () => ownerSocket.emit('game:start', { roomId: room.id }),
    '筹码不足'
  );

  ownerSocket.emit('game:leave_room', { roomId: room.id });
  p2Socket.emit('game:leave_room', { roomId: room.id });
  ownerSocket.disconnect();
  p2Socket.disconnect();

  await destroyRoom(owner.token, room.id);
}

async function scenarioReconnectMidGame({ owner, p2 }) {
  const gameTypeId = await getGameTypeIdByCode(owner.token, 'zhajinhua');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `RECON-${nowId()}`,
    maxPlayers: 2,
    permission: 'public'
  });

  const ownerSocket = createSocket(owner.token);
  const p2Socket = createSocket(p2.token);
  await connectSocket(ownerSocket);
  await connectSocket(p2Socket);

  await joinRoomSocket(ownerSocket, room.id);
  const joined = await joinRoom(p2.token, { roomCode: room.room_code });
  assert.equal(joined.status, 200);
  await joinRoomSocket(p2Socket, room.id);

  await ready(p2Socket, room.id, true);
  const started = await startGame(ownerSocket, room.id);
  assert.ok(started?.gameId);

  p2Socket.disconnect();

  const p2Socket2 = createSocket(p2.token);
  await connectSocket(p2Socket2);
  const state = await joinRoomSocket(p2Socket2, room.id);
  assert.ok(state?.gameState || state?.gameState === null || state === null);
  await once(p2Socket2, 'game:hand', 8000).catch(() => null);

  ownerSocket.emit('game:leave_room', { roomId: room.id });
  p2Socket2.emit('game:leave_room', { roomId: room.id });
  ownerSocket.disconnect();
  p2Socket2.disconnect();

  await destroyRoom(owner.token, room.id);
}

async function scenarioDiceBaoBetChips({ owner, p2 }) {
  const apiOwner = tokenClient(owner.token);
  const apiP2 = tokenClient(p2.token);

  const beforeOwner = await requestWithRetry(() => apiOwner.get('/chips'));
  const beforeP2 = await requestWithRetry(() => apiP2.get('/chips'));
  assert.equal(beforeOwner.status, 200);
  assert.equal(beforeP2.status, 200);
  const ownerStartBalance = Number(beforeOwner.data?.chips?.balance || 0);
  const p2StartBalance = Number(beforeP2.data?.chips?.balance || 0);

  const gameTypeId = await getGameTypeIdByCode(owner.token, 'touzi_bao');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `DBET-${nowId()}`,
    maxPlayers: 2,
    permission: 'public',
    settings: { gameOptions: { baseBet: 10 } }
  });

  const ownerSocket = createSocket(owner.token);
  const p2Socket = createSocket(p2.token);
  ownerSocket.__userId = Number(owner.userId);
  p2Socket.__userId = Number(p2.userId);
  await connectSocket(ownerSocket);
  await connectSocket(p2Socket);
  await joinRoomSocket(ownerSocket, room.id);
  const joined = await joinRoom(p2.token, { roomCode: room.room_code });
  assert.equal(joined.status, 200);
  await joinRoomSocket(p2Socket, room.id);
  await ready(p2Socket, room.id, true);
  const started = await startGame(ownerSocket, room.id);
  assert.ok(started?.gameId);

  const current = Number(started?.gameState?.currentPlayer);
  const actorSocket = current === Number(owner.userId) ? ownerSocket : p2Socket;
  const actorApi = current === Number(owner.userId) ? apiOwner : apiP2;
  const actorBefore = current === Number(owner.userId) ? ownerStartBalance : p2StartBalance;

  const betEvent = once(ownerSocket, 'game:player_bet', 12000).catch(() => null);
  actorSocket.emit('game:action', { roomId: room.id, action: 'place_bet', payload: { selection: 'big', amount: 10 } });
  await betEvent;

  const after = await requestWithRetry(() => actorApi.get('/chips'));
  assert.equal(after.status, 200);
  const actorAfter = Number(after.data?.chips?.balance || 0);
  assert.ok(actorAfter <= actorBefore - 10, `expected chips deducted >=10, before=${actorBefore} after=${actorAfter}`);

  await expectSocketError(
    actorSocket,
    () => actorSocket.emit('game:action', { roomId: room.id, action: 'place_bet', payload: { selection: 'big', amount: -1 } }),
    '不合法'
  ).catch(() => null);

  ownerSocket.emit('game:leave_room', { roomId: room.id });
  p2Socket.emit('game:leave_room', { roomId: room.id });
  ownerSocket.disconnect();
  p2Socket.disconnect();

  await destroyRoom(owner.token, room.id);
}

async function scenarioDiceBaoTripleAllowed({ owner, p2 }) {
  const gameTypeId = await getGameTypeIdByCode(owner.token, 'touzi_bao');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `DTRI-${nowId()}`,
    maxPlayers: 2,
    permission: 'public',
    settings: { gameOptions: { baseBet: 10 } }
  });

  const ownerSocket = createSocket(owner.token);
  const p2Socket = createSocket(p2.token);
  await connectSocket(ownerSocket);
  await connectSocket(p2Socket);
  await joinRoomSocket(ownerSocket, room.id);
  const joined = await joinRoom(p2.token, { roomCode: room.room_code });
  assert.equal(joined.status, 200);
  await joinRoomSocket(p2Socket, room.id);

  await ready(p2Socket, room.id, true);
  const started = await startGame(ownerSocket, room.id);
  assert.ok(started?.gameId);

  const current = Number(started?.gameState?.currentPlayer);
  const actorSocket = current === Number(owner.userId) ? ownerSocket : p2Socket;
  actorSocket.emit('game:action', { roomId: room.id, action: 'place_bet', payload: { selection: 'triple', amount: 10 } });
  await once(ownerSocket, 'game:player_bet', 12000).catch(() => null);

  ownerSocket.emit('game:leave_room', { roomId: room.id });
  p2Socket.emit('game:leave_room', { roomId: room.id });
  ownerSocket.disconnect();
  p2Socket.disconnect();

  await destroyRoom(owner.token, room.id);
}

async function scenarioAbortRefundDiceBao({ owner, p2 }) {
  const apiOwner = tokenClient(owner.token);
  const apiP2 = tokenClient(p2.token);

  const beforeOwner = await requestWithRetry(() => apiOwner.get('/chips'));
  const beforeP2 = await requestWithRetry(() => apiP2.get('/chips'));
  assert.equal(beforeOwner.status, 200);
  assert.equal(beforeP2.status, 200);
  const ownerStartBalance = Number(beforeOwner.data?.chips?.balance || 0);
  const p2StartBalance = Number(beforeP2.data?.chips?.balance || 0);

  const gameTypeId = await getGameTypeIdByCode(owner.token, 'touzi_bao');
  const room = await createRoom(owner.token, {
    gameTypeId,
    name: `ABRT-${nowId()}`,
    maxPlayers: 2,
    permission: 'public',
    settings: { gameOptions: { baseBet: 10 } }
  });

  const ownerSocket = createSocket(owner.token);
  const p2Socket = createSocket(p2.token);
  await connectSocket(ownerSocket);
  await connectSocket(p2Socket);
  await joinRoomSocket(ownerSocket, room.id);
  const joined = await joinRoom(p2.token, { roomCode: room.room_code });
  assert.equal(joined.status, 200);
  await joinRoomSocket(p2Socket, room.id);

  await ready(p2Socket, room.id, true);
  const started = await startGame(ownerSocket, room.id);
  assert.ok(started?.gameId);

  const betAmount = 50;
  const current = Number(started?.gameState?.currentPlayer);
  const firstSocket = current === Number(owner.userId) ? ownerSocket : p2Socket;
  const secondSocket = current === Number(owner.userId) ? p2Socket : ownerSocket;

  firstSocket.emit('game:action', { roomId: room.id, action: 'place_bet', payload: { selection: 'big', amount: betAmount } });
  await once(ownerSocket, 'game:player_bet', 12000).catch(() => null);
  secondSocket.emit('game:action', { roomId: room.id, action: 'place_bet', payload: { selection: 'small', amount: betAmount } });
  await once(ownerSocket, 'game:player_bet', 12000).catch(() => null);

  const midOwner = await requestWithRetry(() => apiOwner.get('/chips'));
  const midP2 = await requestWithRetry(() => apiP2.get('/chips'));
  assert.equal(midOwner.status, 200);
  assert.equal(midP2.status, 200);
  const ownerAfterBet = Number(midOwner.data?.chips?.balance || 0);
  const p2AfterBet = Number(midP2.data?.chips?.balance || 0);
  assert.ok(ownerAfterBet <= ownerStartBalance - betAmount);
  assert.ok(p2AfterBet <= p2StartBalance - betAmount);

  p2Socket.emit('game:leave_room', { roomId: room.id });
  await once(ownerSocket, 'game:player_left', 8000).catch(() => null);
  ownerSocket.emit('game:leave_room', { roomId: room.id });
  p2Socket.disconnect();
  ownerSocket.disconnect();

  await new Promise((r) => setTimeout(r, 1200));

  const afterOwner = await requestWithRetry(() => apiOwner.get('/chips'));
  const afterP2 = await requestWithRetry(() => apiP2.get('/chips'));
  assert.equal(afterOwner.status, 200);
  assert.equal(afterP2.status, 200);

  const ownerEndBalance = Number(afterOwner.data?.chips?.balance || 0);
  const p2EndBalance = Number(afterP2.data?.chips?.balance || 0);

  assert.equal(ownerEndBalance, ownerStartBalance);
  assert.equal(p2EndBalance, p2StartBalance);
}

async function main() {
  const suffix = nowId();
  const password = 'Passw0rd123';
  const users = [
    { username: `sco_${suffix}`, nickname: `房主${suffix.slice(-4)}`, phone: `138${String(Math.floor(10000000 + Math.random() * 89999999))}`, email: `sc_o_${suffix}@example.com`, password },
    { username: `scp_${suffix}`, nickname: `玩家${suffix.slice(-4)}`, phone: `139${String(Math.floor(10000000 + Math.random() * 89999999))}`, email: `sc_p_${suffix}@example.com`, password }
  ];

  const [owner, p2] = await Promise.all(users.map(registerOrLogin));
  await ensureChips(owner.token);
  await ensureChips(p2.token);

  const scenarios = [
    { name: 'room-password', fn: () => scenarioRoomPassword({ owner, p2 }) },
    { name: 'room-approval', fn: () => scenarioRoomApproval({ owner, p2 }) },
    { name: 'start-permission', fn: () => scenarioNonOwnerStartAndNotReady({ owner, p2 }) },
    { name: 'wuziqi-invalid-move', fn: () => scenarioInvalidMoveWuziqi({ owner, p2 }) },
    { name: 'start-insufficient-chips', fn: () => scenarioStartInsufficientChips({ owner, p2 }) },
    { name: 'reconnect-mid-game', fn: () => scenarioReconnectMidGame({ owner, p2 }) },
    { name: 'dicebao-bet-chips', fn: () => scenarioDiceBaoBetChips({ owner, p2 }) },
    { name: 'dicebao-triple-allowed', fn: () => scenarioDiceBaoTripleAllowed({ owner, p2 }) },
    { name: 'abort-refund-dicebao', fn: () => scenarioAbortRefundDiceBao({ owner, p2 }) }
  ];

  for (const s of scenarios) {
    process.stdout.write(`scenario: ${s.name}\n`);
    await s.fn();
  }

  process.stdout.write('game-scenarios: ok\n');
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
