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
  const registerRes = await requestWithRetry(() => http.post('/api/auth/register', {
    username,
    nickname,
    phone,
    email,
    password
  }));

  if (registerRes.status === 201 && registerRes.data?.token && registerRes.data?.user?.id) {
    return { token: registerRes.data.token, userId: registerRes.data.user.id, username };
  }

  const loginRes = await requestWithRetry(() => http.post('/api/auth/login', {
    account: username,
    password,
    rememberMe: false
  }));
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

async function createRoom(token, { gameTypeId, name, maxPlayers, settings }) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() => api.post('/rooms', { gameTypeId, name, maxPlayers, permission: 'public', settings }));
  assert.equal(res.status, 200);
  assert.ok(res.data?.room?.id);
  assert.ok(res.data?.room?.room_code);
  return res.data.room;
}

async function joinRoom(token, { roomCode }) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() => api.post('/rooms/join', { roomCode }));
  assert.equal(res.status, 200);
  assert.ok(res.data?.room?.id);
  return res.data.room;
}

async function destroyRoom(token, roomId) {
  const api = tokenClient(token);
  const res = await requestWithRetry(() => api.post(`/rooms/${roomId}/destroy`));
  assert.ok(res.status === 200 || res.status === 404);
}

function createSocket(token) {
  return io(BASE_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
    reconnection: false,
    timeout: 10000,
    transportOptions: {
      websocket: {
        rejectUnauthorized: false
      }
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

function removeCardsFromHand(hand, cardIds) {
  const remove = new Set((cardIds || []).map(String));
  return (hand || []).filter((c) => !remove.has(String(c.id)));
}

function pickSingleToBeat(hand, minValue) {
  const sorted = [...(hand || [])].sort((a, b) => Number(a.value) - Number(b.value));
  for (const c of sorted) {
    if (Number(c.value) > Number(minValue || 0)) return [c.id];
  }
  return null;
}

function pickAnySingle(hand) {
  const sorted = [...(hand || [])].sort((a, b) => Number(a.value) - Number(b.value));
  if (sorted.length === 0) return null;
  return [sorted[0].id];
}

async function connectSocket(socket) {
  if (socket.connected) return;
  await Promise.race([once(socket, 'connect', 10000), once(socket, 'connect_error', 10000).then((e) => Promise.reject(e))]);
}

async function joinRoomSocket(socket, roomId) {
  socket.emit('game:join_room', { roomId });
  await once(socket, 'game:player_joined', 8000).catch(() => null);
  const state = await once(socket, 'game:state_update', 8000).catch(() => null);
  return state;
}

async function smokeVoice(socket, roomId) {
  let lastError = null;
  for (let i = 1; i <= 2; i++) {
    try {
      socket.emit('game:voice:join', { roomId });
      await once(socket, 'game:voice:participants', 8000);
      socket.emit('game:voice:leave', { roomId });
      return;
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 300 * i));
    }
  }
  throw lastError;
}

async function smokeChat(socket, roomId) {
  socket.emit('game:chat', { roomId, message: `e2e-${nowId()}`, messageType: 'text' });
  await once(socket, 'game:chat_message', 8000);
}

async function ready(socket, roomId, isReady) {
  const p = once(socket, 'game:player_ready', 8000).catch(() => null);
  socket.emit('game:player_ready', { roomId, isReady });
  await p;
}

async function startGame(ownerSocket, roomId) {
  const p = once(ownerSocket, 'game:started', 15000);
  ownerSocket.emit('game:start', { roomId });
  const started = await p;
  assert.ok(started?.gameId);
  assert.ok(started?.gameType);
  assert.ok(started?.gameState);
  return started;
}

async function waitFinished(socket, timeoutMs = 20000) {
  const finished = await once(socket, 'game:finished', timeoutMs);
  assert.ok(finished?.gameId);
  assert.ok(finished?.winnerId);
  assert.ok(Array.isArray(finished?.results));
  return finished;
}

async function playTexasOrZhajinhuaQuickFinish({ ownerSocket, p2Socket, started }) {
  const currentPlayer = Number(started.gameState.currentPlayer);
  const actor = currentPlayer === Number(started.ownerId) ? ownerSocket : p2Socket;
  const finishedPromise = waitFinished(ownerSocket);
  actor.emit('game:action', { roomId: started.roomId, action: 'fold', payload: {} });
  const finished = await finishedPromise;
  return finished;
}

async function playGenericQuickFinish({ ownerSocket, p2Socket, started }) {
  const currentPlayer = Number(started.gameState.currentPlayer);
  const actor = currentPlayer === Number(started.ownerId) ? ownerSocket : p2Socket;
  const finishedPromise = waitFinished(ownerSocket);
  actor.emit('game:action', { roomId: started.roomId, action: 'win', payload: {} });
  const finished = await finishedPromise;
  return finished;
}

async function playSurrenderFinish({ ownerSocket, started, emitByUserId, userIds }) {
  const roomId = started.roomId;
  const finishedPromise = waitFinished(ownerSocket, 15000);
  const current = Number(started.gameState?.currentPlayer) || Number(userIds[0]);
  const surrenderId = current || userIds[0];
  emitByUserId(surrenderId, 'surrender', {});
  return await finishedPromise;
}

async function playBlackjackQuickFinish({ ownerSocket, p2Socket, started, emitOwnerAction, emitP2Action }) {
  const roomId = started.roomId;
  const finishedPromise = waitFinished(ownerSocket, 25000);

  let lastState = started.gameState;
  let guard = 0;
  while (guard < 20) {
    const phase = String(lastState?.phase || '');
    if (phase && phase !== 'player_turns') break;
    const current = Number(lastState?.currentPlayer);
    if (!current) break;
    const isOwnerTurn = current === Number(started.ownerId);
    if (isOwnerTurn) {
      if (emitOwnerAction) emitOwnerAction('stand', {});
      else ownerSocket.emit('game:action', { roomId, action: 'stand', payload: {} });
    } else {
      if (emitP2Action) emitP2Action('stand', {});
      else p2Socket.emit('game:action', { roomId, action: 'stand', payload: {} });
    }
    const next = await Promise.race([
      once(ownerSocket, 'game:state_update', 12000).then((x) => ({ type: 'state', payload: x })).catch(() => null),
      once(ownerSocket, 'game:finished', 12000).then((x) => ({ type: 'finished', payload: x })).catch(() => null)
    ]);
    if (next?.type === 'state' && next.payload?.gameState) {
      lastState = next.payload.gameState;
    }
    if (next?.type === 'finished') {
      return next.payload;
    }
    guard += 1;
  }

  const finished = await finishedPromise;
  return finished;
}

async function playNiuniuQuickFinish({ ownerSocket, p2Socket, started, emitOwnerAction, emitP2Action }) {
  const roomId = started.roomId;
  const finishedPromise = waitFinished(ownerSocket, 15000);
  if (emitOwnerAction) emitOwnerAction('reveal', {});
  else ownerSocket.emit('game:action', { roomId, action: 'reveal', payload: {} });
  if (emitP2Action) emitP2Action('reveal', {});
  else p2Socket.emit('game:action', { roomId, action: 'reveal', payload: {} });
  const finished = await finishedPromise;
  return finished;
}

async function playDiceBaoQuickFinish({ ownerSocket, p2Socket, started, emitOwnerAction, emitP2Action }) {
  const roomId = started.roomId;
  const finishedPromise = waitFinished(ownerSocket, 15000);
  let state = started.gameState;
  for (let i = 0; i < 2; i++) {
    const current = Number(state?.currentPlayer);
    const isOwnerTurn = current === Number(started.ownerId);
    const selection = isOwnerTurn ? 'big' : 'small';
    if (isOwnerTurn) {
      if (emitOwnerAction) emitOwnerAction('place_bet', { selection, amount: 10 });
      else ownerSocket.emit('game:action', { roomId, action: 'place_bet', payload: { selection, amount: 10 } });
    } else {
      if (emitP2Action) emitP2Action('place_bet', { selection, amount: 10 });
      else p2Socket.emit('game:action', { roomId, action: 'place_bet', payload: { selection, amount: 10 } });
    }
    const next = await once(ownerSocket, 'game:state_update', 12000);
    state = next.gameState;
  }
  if (emitOwnerAction) emitOwnerAction('roll', {});
  else ownerSocket.emit('game:action', { roomId, action: 'roll', payload: {} });
  const finished = await finishedPromise;
  return finished;
}

async function playGomokuOwnerWin({ ownerSocket, p2Socket, started }) {
  const roomId = started.roomId;
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
  const finishedPromise = waitFinished(ownerSocket, 25000);
  for (let i = 0; i < moves.length; i++) {
    const [s, x, y] = moves[i];
    const statePromise = once(ownerSocket, 'game:state_update', 8000).catch(() => null);
    s.emit('game:action', { roomId, action: 'move', payload: { x, y } });
    await statePromise;
  }
  const finished = await finishedPromise;
  return finished;
}

async function runOneGame({ players, gameCode, minPlayers, runVoiceChat }) {
  const owner = players[0];
  const apiOwner = tokenClient(owner.token);

  const gameTypeId = await getGameTypeIdByCode(owner.token, gameCode);
  const safeName = `E2E-${String(gameCode).replace(/_/g, '').slice(0, 16)}`;
  const gameOptions = {};
  if (gameCode === 'shengji') gameOptions.handSize = 5;
  if (['sichuan_mahjong', 'guangdong_mahjong', 'guobiao_mahjong', 'ren_mahjong'].includes(gameCode)) gameOptions.maxTurns = 10;
  const roomSettings = Object.keys(gameOptions).length > 0 ? { gameOptions } : undefined;
  const room = await createRoom(owner.token, { gameTypeId, name: safeName, maxPlayers: minPlayers, settings: roomSettings });

  const sockets = [];
  const socketsByUserId = new Map();
  for (const p of players) {
    const s = createSocket(p.token);
    s.__userId = Number(p.userId);
    sockets.push(s);
    socketsByUserId.set(Number(p.userId), s);
    await connectSocket(s);
  }

  const handsByUserId = new Map();
  for (const s of sockets) {
    s.on('game:hand', (payload) => {
      const uid = s.__userId;
      const hand = payload?.hand;
      if (Array.isArray(hand)) handsByUserId.set(Number(uid), hand);
    });
  }

  const lastActions = new Map();
  const emitByUserId = (uid, action, payload) => {
    lastActions.set(String(uid), { gameCode, action, payload });
    const s = socketsByUserId.get(Number(uid));
    if (!s) throw new Error(`missing socket for user ${uid}`);
    s.emit('game:action', { roomId: room.id, action, payload });
  };

  for (const s of sockets) {
    s.on('game:error', (e) => {
      const uid = s.__userId;
      const last = lastActions.get(String(uid));
      throw new Error(`game:error: ${JSON.stringify(e)} user=${uid} last=${JSON.stringify(last)}`);
    });
  }

  await joinRoomSocket(sockets[0], room.id);
  for (const p of players.slice(1)) {
    await joinRoom(p.token, { roomCode: room.room_code });
    const s = socketsByUserId.get(Number(p.userId));
    await joinRoomSocket(s, room.id);
  }

  for (let attempt = 1; attempt <= 6; attempt++) {
    const r = await requestWithRetry(() => apiOwner.get(`/rooms/${room.id}`));
    if (r.status === 200 && Array.isArray(r.data?.room?.players) && r.data.room.players.length >= minPlayers) {
      break;
    }
    if (attempt === 6) {
      throw new Error(`room not ready: code=${gameCode} roomId=${room.id} players=${r.data?.room?.players?.length || 0}`);
    }
    await new Promise((res) => setTimeout(res, 250 * attempt));
  }

  if (runVoiceChat) {
    await smokeVoice(sockets[0], room.id);
    await smokeChat(sockets[0], room.id);
  }

  const started = await startGame(sockets[0], room.id);
  for (const s of sockets.slice(1)) {
    await once(s, 'game:started', 15000).catch(() => null);
  }
  started.roomId = room.id;
  started.ownerId = owner.userId;

  let finished = null;
  const userIds = players.map((p) => Number(p.userId));

  if (gameCode === 'wuziqi') {
    finished = await playGomokuOwnerWin({ ownerSocket: sockets[0], p2Socket: sockets[1], started });
  } else if (gameCode === 'texas_holdem' || gameCode === 'zhajinhua') {
    finished = await playTexasOrZhajinhuaQuickFinish({ ownerSocket: sockets[0], p2Socket: sockets[1], started });
  } else if (gameCode === 'blackjack') {
    const emitOwner = (action, payload) => emitByUserId(owner.userId, action, payload);
    const emitP2 = (action, payload) => emitByUserId(players[1].userId, action, payload);
    finished = await playBlackjackQuickFinish({ ownerSocket: sockets[0], p2Socket: sockets[1], started, emitOwnerAction: emitOwner, emitP2Action: emitP2 });
  } else if (gameCode === 'niuniu') {
    const emitOwner = (action, payload) => emitByUserId(owner.userId, action, payload);
    const emitP2 = (action, payload) => emitByUserId(players[1].userId, action, payload);
    finished = await playNiuniuQuickFinish({ ownerSocket: sockets[0], p2Socket: sockets[1], started, emitOwnerAction: emitOwner, emitP2Action: emitP2 });
  } else if (gameCode === 'touzi_bao') {
    const emitOwner = (action, payload) => emitByUserId(owner.userId, action, payload);
    const emitP2 = (action, payload) => emitByUserId(players[1].userId, action, payload);
    finished = await playDiceBaoQuickFinish({ ownerSocket: sockets[0], p2Socket: sockets[1], started, emitOwnerAction: emitOwner, emitP2Action: emitP2 });
  } else if (gameCode === 'doudizhu') {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const ok = userIds.every((uid) => Array.isArray(handsByUserId.get(Number(uid))));
      if (ok) break;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
    emitByUserId(userIds[0], 'bid', { points: 1 });
    await once(sockets[0], 'game:state_update', 12000).catch(() => null);
    emitByUserId(userIds[1], 'bid', { points: 0 });
    await once(sockets[0], 'game:state_update', 12000).catch(() => null);
    emitByUserId(userIds[2], 'bid', { points: 0 });
    await once(sockets[0], 'game:state_update', 12000).catch(() => null);
    const finishedPromise = waitFinished(sockets[0], 70000);
    let lastState = started.gameState;
    for (let turn = 0; turn < 600; turn++) {
      const current = Number(lastState?.currentPlayer);
      const lastPlay = lastState?.lastPlay?.play;
      const lastPlayerId = Number(lastState?.lastPlay?.playerId);
      const canPlayAny = !lastPlay || Number.isNaN(lastPlayerId) || lastPlayerId === current;
      if (canPlayAny && !handsByUserId.has(current)) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      const hand = handsByUserId.get(current) || [];
      let playIds = null;
      if (canPlayAny) playIds = pickAnySingle(hand);
      else if (lastPlay?.type === 'single') playIds = pickSingleToBeat(hand, lastPlay.main);
      if (playIds) {
        emitByUserId(current, 'play', { cardIds: playIds });
        handsByUserId.set(current, removeCardsFromHand(hand, playIds));
      } else {
        if (canPlayAny) {
          emitByUserId(current, 'surrender', {});
        } else {
          emitByUserId(current, 'pass', {});
        }
      }

      const next = await Promise.race([
        once(sockets[0], 'game:state_update', 12000).then((x) => ({ type: 'state', payload: x })).catch(() => null),
        once(sockets[0], 'game:finished', 12000).then((x) => ({ type: 'finished', payload: x })).catch(() => null)
      ]);
      if (next?.type === 'finished') {
        finished = next.payload;
        break;
      }
      if (next?.type === 'state') {
        lastState = next.payload?.gameState || lastState;
      }
    }
    if (!finished) {
      const current = Number(lastState?.currentPlayer) || userIds[0];
      emitByUserId(current, 'surrender', {});
      finished = await finishedPromise;
    }
  } else if (gameCode === 'erbaban') {
    const finishedPromise = waitFinished(sockets[0], 15000);
    let current = Number(started.gameState?.currentPlayer || userIds[0]);
    for (let i = 0; i < minPlayers; i++) {
      emitByUserId(current, 'roll', {});
      const next = await once(sockets[0], 'game:state_update', 12000).catch(() => null);
      current = Number(next?.gameState?.currentPlayer || current);
    }
    finished = await finishedPromise;
  } else if (['xiangqi', 'international_chess', 'junqi'].includes(gameCode)) {
    if (gameCode === 'xiangqi') {
      emitByUserId(userIds[0], 'move', { from: { x: 0, y: 9 }, to: { x: 0, y: 8 } });
    } else if (gameCode === 'international_chess') {
      emitByUserId(userIds[0], 'move', { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } });
    } else {
      emitByUserId(userIds[0], 'move', { from: { x: 2, y: 10 }, to: { x: 2, y: 9 } });
    }
    await once(sockets[0], 'game:state_update', 12000).catch(() => null);
    finished = await playSurrenderFinish({ ownerSocket: sockets[0], started, emitByUserId, userIds });
  } else if (gameCode === 'weiqi') {
    emitByUserId(userIds[0], 'place', { x: 3, y: 3 });
    await once(sockets[0], 'game:state_update', 12000).catch(() => null);
    finished = await playSurrenderFinish({ ownerSocket: sockets[0], started, emitByUserId, userIds });
  } else if (gameCode === 'paodekuai') {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const ok = userIds.every((uid) => Array.isArray(handsByUserId.get(Number(uid))));
      if (ok) break;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
    const finishedPromise = waitFinished(sockets[0], 60000);
    let lastState = started.gameState;
    for (let turn = 0; turn < 400; turn++) {
      const current = Number(lastState?.currentPlayer);
      const lastPlay = lastState?.lastPlay?.play;
      const lastPlayerId = Number(lastState?.lastPlay?.playerId);
      const canPlayAny = !lastPlay || Number.isNaN(lastPlayerId) || lastPlayerId === current;
      if (canPlayAny && !handsByUserId.has(current)) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      const hand = handsByUserId.get(current) || [];
      let playIds = null;
      if (canPlayAny) playIds = pickAnySingle(hand);
      else if (lastPlay?.type === 'single') playIds = pickSingleToBeat(hand, lastPlay.main);
      if (playIds) {
        emitByUserId(current, 'play', { cardIds: playIds });
        handsByUserId.set(current, removeCardsFromHand(hand, playIds));
      } else {
        if (canPlayAny) {
          emitByUserId(current, 'surrender', {});
        } else {
          emitByUserId(current, 'pass', {});
        }
      }

      const next = await Promise.race([
        once(sockets[0], 'game:state_update', 12000).then((x) => ({ type: 'state', payload: x })).catch(() => null),
        once(sockets[0], 'game:finished', 12000).then((x) => ({ type: 'finished', payload: x })).catch(() => null)
      ]);
      if (next?.type === 'finished') {
        finished = next.payload;
        break;
      }
      if (next?.type === 'state') {
        lastState = next.payload?.gameState || lastState;
      }
    }
    if (!finished) {
      const current = Number(lastState?.currentPlayer) || userIds[0];
      emitByUserId(current, 'surrender', {});
      finished = await finishedPromise;
    }
  } else if (gameCode === 'shengji') {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const ok = userIds.every((uid) => Array.isArray(handsByUserId.get(Number(uid))));
      if (ok) break;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
    const finishedPromise = waitFinished(sockets[0], 60000);
    const suitType = (card, trumpSuit, trumpRank) => {
      if (String(card.rank) === String(trumpRank)) return 'TRUMP';
      if (String(card.suit) === String(trumpSuit)) return 'TRUMP';
      return String(card.suit);
    };
    const pickCardId = (hand, state) => {
      const trumpSuit = state?.trumpSuit;
      const trumpRank = state?.trumpRank;
      const trick = Array.isArray(state?.trick) ? state.trick : [];
      if (hand.length === 0) return null;
      if (trick.length === 0) return hand[0].id;
      const leadCard = trick[0]?.card;
      const leadType = suitType(leadCard, trumpSuit, trumpRank);
      if (leadType === 'TRUMP') {
        const trumpCards = hand.filter((c) => suitType(c, trumpSuit, trumpRank) === 'TRUMP');
        return (trumpCards[0] || hand[0]).id;
      }
      const leadSuitCards = hand.filter((c) => suitType(c, trumpSuit, trumpRank) !== 'TRUMP' && String(c.suit) === String(leadType));
      return (leadSuitCards[0] || hand[0]).id;
    };

    let lastState = started.gameState;
    let current = Number(lastState?.currentPlayer || userIds[0]);
    for (let turn = 0; turn < 200; turn++) {
      const hand = handsByUserId.get(current) || [];
      const id = pickCardId(hand, lastState);
      if (!id) break;
      emitByUserId(current, 'play', { cardId: id });
      handsByUserId.set(current, removeCardsFromHand(hand, [id]));
      const next = await Promise.race([
        once(sockets[0], 'game:state_update', 12000).then((x) => ({ type: 'state', payload: x })).catch(() => null),
        once(sockets[0], 'game:finished', 12000).then((x) => ({ type: 'finished', payload: x })).catch(() => null)
      ]);
      if (next?.type === 'finished') {
        finished = next.payload;
        break;
      }
      if (next?.type === 'state') {
        lastState = next.payload?.gameState || lastState;
        current = Number(lastState?.currentPlayer || current);
      }
    }
    if (!finished) finished = await finishedPromise;
  } else if (['sichuan_mahjong', 'guangdong_mahjong', 'guobiao_mahjong', 'ren_mahjong'].includes(gameCode)) {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const ok = userIds.every((uid) => Array.isArray(handsByUserId.get(Number(uid))));
      if (ok) break;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
    const finishedPromise = waitFinished(sockets[0], 60000);
    let lastState = started.gameState;
    for (let turn = 0; turn < 80; turn++) {
      const current = Number(lastState?.currentPlayer);
      const hand = handsByUserId.get(current) || [];
      const tileId = hand[0]?.id;
      if (!tileId) {
        emitByUserId(current || userIds[0], 'settle', {});
      } else {
        emitByUserId(current, 'discard', { tileId });
        handsByUserId.set(current, removeCardsFromHand(hand, [tileId]));
      }
      const next = await Promise.race([
        once(sockets[0], 'game:state_update', 12000).then((x) => ({ type: 'state', payload: x })).catch(() => null),
        once(sockets[0], 'game:finished', 12000).then((x) => ({ type: 'finished', payload: x })).catch(() => null)
      ]);
      if (next?.type === 'finished') {
        finished = next.payload;
        break;
      }
      if (next?.type === 'state') {
        lastState = next.payload?.gameState || lastState;
      }
    }
    if (!finished) {
      emitByUserId(userIds[0], 'settle', {});
      finished = await finishedPromise;
    }
  } else {
    finished = await playGenericQuickFinish({ ownerSocket: sockets[0], p2Socket: sockets[1], started });
  }

  assert.ok(finished?.winnerId);

  const chipsAfterOwner = (await apiOwner.get('/chips')).data?.chips?.balance;
  assert.ok(Number.isFinite(Number(chipsAfterOwner)));

  await destroyRoom(owner.token, room.id);

  for (const s of sockets) {
    s.emit('game:leave_room', { roomId: room.id });
    s.disconnect();
  }

  return { roomId: room.id, winnerId: finished.winnerId };
}

async function main() {
  const suffix = nowId();
  const password = 'Passw0rd123';
  const users = [
    { username: `e2o_${suffix}`, nickname: `房主${suffix.slice(-4)}`, phone: `138${String(Math.floor(10000000 + Math.random() * 89999999))}`, email: `e2e_o_${suffix}@example.com`, password },
    { username: `e2p_${suffix}`, nickname: `玩家${suffix.slice(-4)}`, phone: `139${String(Math.floor(10000000 + Math.random() * 89999999))}`, email: `e2e_p2_${suffix}@example.com`, password },
    { username: `e2q_${suffix}`, nickname: `玩家${suffix.slice(-4)}`, phone: `137${String(Math.floor(10000000 + Math.random() * 89999999))}`, email: `e2e_p3_${suffix}@example.com`, password },
    { username: `e2r_${suffix}`, nickname: `玩家${suffix.slice(-4)}`, phone: `136${String(Math.floor(10000000 + Math.random() * 89999999))}`, email: `e2e_p4_${suffix}@example.com`, password }
  ];

  const players = [];
  for (const u of users) players.push(await registerOrLogin(u));
  for (const p of players) await ensureChips(p.token);

  const api = tokenClient(players[0].token);
  const typesRes = await requestWithRetry(() => api.get('/games/types'));
  assert.equal(typesRes.status, 200);
  const typeMap = new Map((typesRes.data?.gameTypes || []).map((g) => [g.code, Number(g.min_players || g.minPlayers || 2)]));

  const gameCodes = [
    'texas_holdem', 'zhajinhua', 'doudizhu', 'shengji', 'paodekuai', 'blackjack',
    'sichuan_mahjong', 'guangdong_mahjong', 'guobiao_mahjong', 'ren_mahjong',
    'xiangqi', 'weiqi', 'wuziqi', 'international_chess', 'junqi',
    'niuniu', 'erbaban', 'touzi_bao'
  ];

  const results = [];
  for (let i = 0; i < gameCodes.length; i++) {
    const gameCode = gameCodes[i];
    const minPlayers = typeMap.get(gameCode) || 2;
    process.stdout.write(`e2e: running ${gameCode} players=${minPlayers}\n`);
    results.push(await runOneGame({ players: players.slice(0, minPlayers), gameCode, minPlayers, runVoiceChat: i === 0 }));
  }

  process.stdout.write(`game-e2e: ok ${JSON.stringify(results)}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
