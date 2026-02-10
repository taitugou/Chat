import { MahjongScorer } from './scorer.js';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tileKey(tile) {
  return `${tile.suit}${tile.rank}`;
}

function buildTiles() {
  const tiles = [];
  let idSeq = 0;
  const suits = ['m', 'p', 's'];
  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let i = 0; i < 4; i++) tiles.push({ id: `t${idSeq++}`, suit, rank });
    }
  }
  for (let rank = 1; rank <= 7; rank++) {
    for (let i = 0; i < 4; i++) tiles.push({ id: `t${idSeq++}`, suit: 'z', rank });
  }
  return shuffle(tiles);
}

function countsFromHand(hand) {
  const map = new Map();
  for (const t of hand) {
    const k = tileKey(t);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

function removeN(map, key, n) {
  const v = map.get(key) || 0;
  if (v < n) return false;
  if (v === n) map.delete(key);
  else map.set(key, v - n);
  return true;
}

function nextKey(map) {
  const keys = [...map.keys()];
  keys.sort();
  return keys[0] || null;
}

function isMeldable(map) {
  if (map.size === 0) return true;
  const k = nextKey(map);
  const suit = k[0];
  const rank = Number(k.slice(1));

  if (removeN(map, k, 3)) {
    if (isMeldable(map)) return true;
    map.set(k, (map.get(k) || 0) + 3);
  }

  if (suit !== 'z') {
    const k2 = `${suit}${rank + 1}`;
    const k3 = `${suit}${rank + 2}`;
    if (removeN(map, k, 1) && removeN(map, k2, 1) && removeN(map, k3, 1)) {
      if (isMeldable(map)) return true;
      map.set(k, (map.get(k) || 0) + 1);
      map.set(k2, (map.get(k2) || 0) + 1);
      map.set(k3, (map.get(k3) || 0) + 1);
    } else {
      if (!map.has(k)) map.set(k, 0);
      map.set(k, (map.get(k) || 0) + 1);
      if (map.get(k) === 0) map.delete(k);
      if (map.has(k2) && map.get(k2) === 0) map.delete(k2);
      if (map.has(k3) && map.get(k3) === 0) map.delete(k3);
    }
  }

  return false;
}

function canHu(hand) {
  if (!Array.isArray(hand) || hand.length % 3 !== 2) return false;
  const base = countsFromHand(hand);
  for (const [k, v] of base.entries()) {
    if (v < 2) continue;
    const map = new Map(base);
    removeN(map, k, 2);
    if (isMeldable(map)) return true;
  }
  return false;
}

function scoreHand(hand) {
  const counts = countsFromHand(hand);
  let pairs = 0;
  let triples = 0;
  let sum = 0;
  for (const t of hand || []) {
    const base = Number(t.rank) + (t.suit === 'z' ? 20 : 0);
    sum += base;
  }
  for (const v of counts.values()) {
    if (v >= 2) pairs += Math.floor(v / 2);
    if (v >= 3) triples += Math.floor(v / 3);
  }
  return triples * 200 + pairs * 100 + sum;
}

function isSequence(a, b, c) {
  if (!a || !b || !c) return false;
  if (a.suit !== b.suit || b.suit !== c.suit) return false;
  if (a.suit === 'z') return false;
  const r = [Number(a.rank), Number(b.rank), Number(c.rank)].sort((x, y) => x - y);
  return r[0] + 1 === r[1] && r[1] + 1 === r[2];
}

export class MahjongGame {
  constructor(playerIds, gameCode, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.gameCode = gameCode;
    this.baseBet = Number(options.baseBet || 10);
    this.maxTurns = Number.isFinite(Number(options.maxTurns)) ? Number(options.maxTurns) : 60;
    this.tiles = [];
    this.hands = {};
    this.discards = {};
    this.melds = {};
    this.lastDraw = null;
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;

    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.gameOver = false;
    this.lastDiscard = null;
    this.turnCount = 0;
    this.initializeGame();
  }

  initializeGame() {
    this.tiles = buildTiles();
    this.hands = {};
    this.discards = {};
    this.melds = {};
    this.lastDraw = null;
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;
    this.scorer = new MahjongScorer(this.gameCode.includes('sichuan') ? 'sichuan' : 'standard');

    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.gameOver = false;
    this.lastDiscard = null;
    this.turnCount = 0;

    for (const pid of this.playerIds) {
      this.hands[pid] = [];
      this.discards[pid] = [];
      this.melds[pid] = [];
      this.playerBets[pid] = this.baseBet;
      this.playerTotalSpent[pid] = this.baseBet;
      this.playerStatus[pid] = 'active';
      this.pot += this.baseBet;
    }

    for (let r = 0; r < 13; r++) {
      for (const pid of this.playerIds) {
        this.hands[pid].push(this.tiles.pop());
      }
    }

    this.hands[this.playerIds[0]].push(this.tiles.pop());
    for (const pid of this.playerIds) {
      this.hands[pid].sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
    }
  }

  getCurrentPlayerId() {
    return this.playerIds[this.currentPlayerIndex];
  }

  validateTurn(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.phase !== 'playing') throw new Error('当前阶段不允许该操作');
    if (String(playerId) !== String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
    if (this.playerStatus[playerId] !== 'active') throw new Error('玩家状态不允许操作');
  }

  undoLastAutoDrawIfNeeded() {
    if (!this.lastDiscard || !this.lastDraw) return;
    if (String(this.lastDraw.playerId) !== String(this.getCurrentPlayerId())) return;
    if (String(this.lastDraw.fromDiscardId) !== String(this.lastDiscard.tile.id)) return;
    const hand = this.hands[this.lastDraw.playerId] || [];
    const idx = hand.findIndex((t) => String(t.id) === String(this.lastDraw.tile.id));
    if (idx >= 0) {
      const [tile] = hand.splice(idx, 1);
      this.tiles.push(tile);
    }
    this.lastDraw = null;
  }

  discard(playerId, tileId) {
    this.validateTurn(playerId);
    this.lastDraw = null;
    const hand = this.hands[playerId] || [];
    const idx = hand.findIndex((t) => t.id === tileId);
    if (idx < 0) throw new Error('弃牌不在手牌中');
    const [tile] = hand.splice(idx, 1);
    this.lastDiscard = { playerId, tile: { suit: tile.suit, rank: tile.rank, id: tile.id } };
    this.discards[playerId].push({ suit: tile.suit, rank: tile.rank, id: tile.id });
    this.turnCount += 1;

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    const nextPid = this.getCurrentPlayerId();
    if (this.tiles.length > 0) {
      const drawn = this.tiles.pop();
      this.hands[nextPid].push(drawn);
      this.hands[nextPid].sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
      this.lastDraw = { playerId: nextPid, tile: drawn, fromDiscardId: this.lastDiscard.tile.id };
    } else {
      return this.endGame(playerId, 'draw');
    }
    if (this.turnCount >= this.maxTurns) {
      return this.settle('max_turns');
    }
    return null;
  }

  hu(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    const hand = this.hands[playerId] || [];
    const meldCount = (this.melds[playerId] || []).length;
    if (!canHu(hand)) throw new Error('当前不满足自摸胡牌条件');
    if (meldCount > 4) throw new Error('牌局状态异常');
    
    // 计算番数
    const result = this.scorer.calculate(hand, this.melds[playerId] || [], this.lastDraw?.tile, true);
    this.pot += result.score * 10; // 假设番数对应底注倍数

    return this.endGame(playerId, 'tsumo', result);
  }

  ron(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (!this.lastDiscard) throw new Error('当前无可胡的弃牌');
    if (String(playerId) === String(this.lastDiscard.playerId)) throw new Error('不能对自己弃牌胡');
    this.undoLastAutoDrawIfNeeded();
    const tile = this.lastDiscard.tile;
    const hand = (this.hands[playerId] || []).concat([{ id: tile.id, suit: tile.suit, rank: tile.rank }]);
    const meldCount = (this.melds[playerId] || []).length;
    if (!canHu(hand)) throw new Error('当前不满足点炮胡牌条件');
    if (meldCount > 4) throw new Error('牌局状态异常');

    // 计算番数
    const result = this.scorer.calculate(hand, this.melds[playerId] || [], tile, false);
    this.pot += result.score * 10;

    return this.endGame(playerId, 'ron', result);
  }

  peng(playerId, useTileIds) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (!this.lastDiscard) throw new Error('当前无可碰的弃牌');
    if (String(playerId) === String(this.lastDiscard.playerId)) throw new Error('不能对自己弃牌碰');
    this.undoLastAutoDrawIfNeeded();
    const ids = Array.isArray(useTileIds) ? useTileIds : [];
    if (ids.length !== 2) throw new Error('碰牌需要两张手牌');
    const hand = this.hands[playerId] || [];
    const tiles = ids.map((id) => hand.find((t) => String(t.id) === String(id)));
    if (tiles.some((t) => !t)) throw new Error('碰牌手牌不合法');
    const d = this.lastDiscard.tile;
    if (!tiles.every((t) => t.suit === d.suit && Number(t.rank) === Number(d.rank))) throw new Error('碰牌必须同张');

    this.hands[playerId] = hand.filter((t) => !ids.some((id) => String(id) === String(t.id)));
    this.melds[playerId].push({ type: 'peng', tiles: [{ suit: d.suit, rank: d.rank }, { suit: d.suit, rank: d.rank }, { suit: d.suit, rank: d.rank }], fromPlayerId: this.lastDiscard.playerId });
    this.lastDiscard = null;
    this.lastDraw = null;
    this.currentPlayerIndex = this.playerIds.findIndex((x) => String(x) === String(playerId));
    return null;
  }

  chi(playerId, useTileIds) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (!this.lastDiscard) throw new Error('当前无可吃的弃牌');
    if (String(playerId) === String(this.lastDiscard.playerId)) throw new Error('不能对自己弃牌吃');
    this.undoLastAutoDrawIfNeeded();
    const nextPid = this.getCurrentPlayerId();
    if (String(playerId) !== String(nextPid)) throw new Error('只能下家吃牌');
    const ids = Array.isArray(useTileIds) ? useTileIds : [];
    if (ids.length !== 2) throw new Error('吃牌需要两张手牌');
    const hand = this.hands[playerId] || [];
    const tiles = ids.map((id) => hand.find((t) => String(t.id) === String(id)));
    if (tiles.some((t) => !t)) throw new Error('吃牌手牌不合法');
    const d = this.lastDiscard.tile;
    const seq = [{ suit: d.suit, rank: d.rank }, { suit: tiles[0].suit, rank: tiles[0].rank }, { suit: tiles[1].suit, rank: tiles[1].rank }];
    if (!isSequence(seq[0], seq[1], seq[2])) throw new Error('吃牌必须组成顺子');

    this.hands[playerId] = hand.filter((t) => !ids.some((id) => String(id) === String(t.id)));
    const ranks = [Number(d.rank), Number(tiles[0].rank), Number(tiles[1].rank)].sort((a, b) => a - b);
    this.melds[playerId].push({ type: 'chi', tiles: ranks.map((r) => ({ suit: d.suit, rank: r })), fromPlayerId: this.lastDiscard.playerId });
    this.lastDiscard = null;
    this.lastDraw = null;
    this.currentPlayerIndex = this.playerIds.findIndex((x) => String(x) === String(playerId));
    return null;
  }

  gangFromDiscard(playerId, useTileIds) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (!this.lastDiscard) throw new Error('当前无可杠的弃牌');
    if (String(playerId) === String(this.lastDiscard.playerId)) throw new Error('不能对自己弃牌杠');
    this.undoLastAutoDrawIfNeeded();
    const ids = Array.isArray(useTileIds) ? useTileIds : [];
    if (ids.length !== 3) throw new Error('明杠需要三张手牌');
    const hand = this.hands[playerId] || [];
    const tiles = ids.map((id) => hand.find((t) => String(t.id) === String(id)));
    if (tiles.some((t) => !t)) throw new Error('杠牌手牌不合法');
    const d = this.lastDiscard.tile;
    if (!tiles.every((t) => t.suit === d.suit && Number(t.rank) === Number(d.rank))) throw new Error('杠牌必须同张');

    this.hands[playerId] = hand.filter((t) => !ids.some((id) => String(id) === String(t.id)));
    this.melds[playerId].push({ type: 'gang', tiles: [{ suit: d.suit, rank: d.rank }, { suit: d.suit, rank: d.rank }, { suit: d.suit, rank: d.rank }, { suit: d.suit, rank: d.rank }], fromPlayerId: this.lastDiscard.playerId });
    this.lastDiscard = null;
    this.lastDraw = null;
    this.currentPlayerIndex = this.playerIds.findIndex((x) => String(x) === String(playerId));
    const pid = this.getCurrentPlayerId();
    if (this.tiles.length === 0) return this.endGame(playerId, 'draw');
    const drawn = this.tiles.pop();
    this.hands[pid].push(drawn);
    this.hands[pid].sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
    return null;
  }

  settle(reason) {
    if (this.gameOver) throw new Error('游戏已结束');
    let winnerId = this.playerIds[0];
    let best = -Infinity;
    for (const pid of this.playerIds) {
      const v = scoreHand(this.hands[pid] || []) + (this.melds[pid] || []).length * 500;
      if (v > best) {
        best = v;
        winnerId = pid;
      }
    }
    return this.endGame(winnerId, reason || 'settle');
  }

  surrender(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (!this.playerIds.some((pid) => String(pid) === String(playerId))) throw new Error('玩家不在对局中');
    const winnerId = this.playerIds.find((pid) => String(pid) !== String(playerId)) || playerId;
    return this.endGame(winnerId, 'surrender');
  }

  endGame(winnerId, reason, scoreResult) {
    this.gameOver = true;
    this.phase = 'settled';
    const results = this.playerIds.map((pid) => ({
      userId: pid,
      chipsChange: String(pid) === String(winnerId) ? this.pot : 0,
      totalSpent: this.playerTotalSpent[pid] || 0,
      position: String(pid) === String(winnerId) ? 1 : 2,
      status: String(pid) === String(winnerId) ? 'win' : 'lose',
      handType: scoreResult ? scoreResult.details.map(d => `${d.name}(${d.fan}番)`).join(' ') : ''
    }));
    return { winnerId, totalPot: this.pot, pot: this.pot, type: `${this.gameCode}_${reason || 'finish'}`, results };
  }

  handleAction(playerId, action, payload) {
    if (action === 'discard') return this.discard(playerId, payload?.tileId);
    if (action === 'hu') return this.hu(playerId);
    if (action === 'ron') return this.ron(playerId);
    if (action === 'peng') return this.peng(playerId, payload?.useTileIds);
    if (action === 'chi') return this.chi(playerId, payload?.useTileIds);
    if (action === 'gang') return this.gangFromDiscard(playerId, payload?.useTileIds);
    if (action === 'settle') return this.settle('manual_settle');
    if (action === 'surrender') return this.surrender(playerId);
    throw new Error('未知操作');
  }

  getGameState() {
    const handsCount = {};
    for (const pid of this.playerIds) handsCount[pid] = (this.hands[pid] || []).length;
    return {
      gameCode: this.gameCode,
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      currentPlayer: this.getCurrentPlayerId(),
      wallCount: this.tiles.length,
      lastDiscard: this.lastDiscard,
      turnCount: this.turnCount,
      maxTurns: this.maxTurns,
      handsCount,
      meldsCount: Object.fromEntries(this.playerIds.map((pid) => [pid, (this.melds[pid] || []).length])),
      discardsCount: Object.fromEntries(this.playerIds.map((pid) => [pid, (this.discards[pid] || []).length])),
      gameOver: this.gameOver
    };
  }
}
