import { Deck } from './texasHoldem.js';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeValue(card) {
  const r = String(card.rank);
  if (r === 'A') return 14;
  if (r === '2') return 15;
  if (r === 'K') return 13;
  if (r === 'Q') return 12;
  if (r === 'J') return 11;
  return Number(r);
}

function groupValues(cards) {
  const map = new Map();
  for (const c of cards) {
    const v = normalizeValue(c);
    map.set(v, (map.get(v) || 0) + 1);
  }
  return map;
}

function isStraight(values) {
  if (values.length < 5) return false;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted[sorted.length - 1] >= 15) return false;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function isConsecutive(values) {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

export function evaluatePaodekuaiPlay(cards) {
  if (!Array.isArray(cards) || cards.length === 0) throw new Error('出牌不能为空');
  const values = cards.map(normalizeValue);
  const counts = groupValues(cards);
  const unique = [...counts.keys()].sort((a, b) => a - b);

  if (unique.length === 1) {
    if (cards.length === 1) return { type: 'single', main: unique[0], length: 1 };
    if (cards.length === 2) return { type: 'pair', main: unique[0], length: 2 };
    if (cards.length === 3) return { type: 'triple', main: unique[0], length: 3 };
    if (cards.length === 4) return { type: 'bomb', main: unique[0], length: 4 };
  }

  if (cards.length === 4 && unique.length === 2) {
    const tripleVal = unique.find((v) => (counts.get(v) || 0) === 3);
    if (tripleVal) return { type: 'triple1', main: tripleVal, length: 4 };
  }

  if (cards.length === 5 && unique.length === 2) {
    const tripleVal = unique.find((v) => (counts.get(v) || 0) === 3);
    if (tripleVal) return { type: 'triple2', main: tripleVal, length: 5 };
  }

  if (counts.size === cards.length && isStraight(values)) {
    const sorted = [...values].sort((a, b) => a - b);
    return { type: 'straight', main: sorted[sorted.length - 1], length: cards.length };
  }

  if (cards.length >= 6 && cards.length % 2 === 0) {
    const pairVals = unique.filter((v) => (counts.get(v) || 0) === 2);
    if (pairVals.length === unique.length && pairVals.length >= 3 && pairVals[pairVals.length - 1] < 15 && isConsecutive(pairVals)) {
      return { type: 'double_straight', main: pairVals[pairVals.length - 1], length: cards.length };
    }
  }

  throw new Error('不支持的牌型');
}

export function canBeatPaodekuai(a, b) {
  if (!b) return true;
  if (a.type === 'bomb' && b.type !== 'bomb') return true;
  if (b.type === 'bomb' && a.type !== 'bomb') return false;
  if (a.type !== b.type) return false;
  if (a.length !== b.length) return false;
  return a.main > b.main;
}

export class PaodekuaiGame {
  constructor(playerIds, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.baseBet = Number(options.baseBet || 10);
    this.deck = new Deck();
    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;
    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.gameOver = false;
    this.lastPlay = null;
    this.passCount = 0;
    this.initializeGame();
  }

  initializeGame() {
    this.deck.reset();
    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;
    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.gameOver = false;
    this.lastPlay = null;
    this.passCount = 0;

    let idSeq = 0;
    const all = shuffle(this.deck.cards.filter((c) => c.suit !== 'JOKER')).map((c) => ({
      ...c,
      id: c.id || `pdk_${idSeq++}`
    }));
    const n = this.playerIds.length;
    for (const pid of this.playerIds) {
      this.hands[pid] = [];
      this.playerBets[pid] = this.baseBet;
      this.playerTotalSpent[pid] = this.baseBet;
      this.playerStatus[pid] = 'active';
      this.pot += this.baseBet;
    }
    for (let i = 0; i < all.length; i++) {
      const pid = this.playerIds[i % n];
      this.hands[pid].push(all[i]);
    }
    for (const pid of this.playerIds) {
      this.hands[pid].sort((a, b) => normalizeValue(a) - normalizeValue(b));
    }
  }

  getCurrentPlayerId() {
    return this.playerIds[this.currentPlayerIndex];
  }

  validateTurn(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (String(playerId) !== String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
    if (this.playerStatus[playerId] !== 'active') throw new Error('玩家状态不允许操作');
  }

  pass(playerId) {
    this.validateTurn(playerId);
    if (!this.lastPlay) throw new Error('当前不能过牌');
    if (String(this.lastPlay.playerId) === String(playerId)) throw new Error('不能对自己过牌');
    this.passCount += 1;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    if (this.passCount >= this.playerIds.length - 1) {
      this.lastPlay = null;
      this.passCount = 0;
    }
    return null;
  }

  play(playerId, cardIds) {
    this.validateTurn(playerId);
    const ids = Array.isArray(cardIds) ? cardIds : [];
    if (ids.length === 0) throw new Error('出牌不能为空');
    const hand = this.hands[playerId] || [];
    const set = new Set(hand.map((c) => c.id));
    for (const id of ids) {
      if (!set.has(id)) throw new Error('出牌不在手牌中');
    }
    const cards = ids.map((id) => hand.find((c) => c.id === id));
    const playInfo = evaluatePaodekuaiPlay(cards);
    const last = this.lastPlay?.play;
    if (last && String(this.lastPlay?.playerId) === String(playerId)) {
      throw new Error('当前不能压自己上家');
    }
    if (!canBeatPaodekuai(playInfo, last)) throw new Error('牌型不够大');
    this.hands[playerId] = hand.filter((c) => !ids.includes(c.id));
    this.lastPlay = { playerId, play: playInfo };
    this.passCount = 0;
    if (this.hands[playerId].length === 0) return this.endGame(playerId, 'out');
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    return null;
  }

  surrender(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (!this.playerIds.some((pid) => String(pid) === String(playerId))) throw new Error('玩家不在对局中');
    const winnerId = this.playerIds.find((pid) => String(pid) !== String(playerId)) || playerId;
    return this.endGame(winnerId, 'surrender');
  }

  endGame(winnerId, reason) {
    this.gameOver = true;
    this.phase = 'settled';
    const results = this.playerIds.map((pid) => ({
      userId: pid,
      chipsChange: String(pid) === String(winnerId) ? this.pot : 0,
      totalSpent: this.playerTotalSpent[pid] || 0,
      position: String(pid) === String(winnerId) ? 1 : 2
    }));
    return { winnerId, totalPot: this.pot, pot: this.pot, type: `paodekuai_${reason || 'finish'}`, results };
  }

  handleAction(playerId, action, payload) {
    if (action === 'play') return this.play(playerId, payload?.cardIds);
    if (action === 'pass') return this.pass(playerId);
    if (action === 'surrender') return this.surrender(playerId);
    throw new Error('未知操作');
  }

  getGameState() {
    const handsCount = {};
    for (const pid of this.playerIds) handsCount[pid] = (this.hands[pid] || []).length;
    return {
      gameCode: 'paodekuai',
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      currentPlayer: this.getCurrentPlayerId(),
      lastPlay: this.lastPlay ? { playerId: this.lastPlay.playerId, play: this.lastPlay.play } : null,
      handsCount,
      gameOver: this.gameOver
    };
  }
}
