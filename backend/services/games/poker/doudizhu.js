function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 3]));

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const deck = [];
  let idSeq = 0;
  for (const r of RANKS) {
    for (const s of suits) {
      deck.push({ id: `c${idSeq++}`, suit: s, rank: r, value: RANK_VALUE[r] });
    }
  }
  deck.push({ id: `c${idSeq++}`, suit: 'JOKER', rank: 'SJ', value: 16 });
  deck.push({ id: `c${idSeq++}`, suit: 'JOKER', rank: 'BJ', value: 17 });
  return shuffle(deck);
}

function groupValues(cards) {
  const map = new Map();
  for (const c of cards) {
    map.set(c.value, (map.get(c.value) || 0) + 1);
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
  if (!Array.isArray(values) || values.length === 0) return false;
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

export function evaluateDoudizhuPlay(cards) {
  if (!Array.isArray(cards) || cards.length === 0) throw new Error('出牌不能为空');
  const values = cards.map((c) => Number(c.value));
  const counts = groupValues(cards);
  const unique = [...counts.keys()];
  unique.sort((a, b) => a - b);

  if (cards.length === 2) {
    const has16 = values.includes(16);
    const has17 = values.includes(17);
    if (has16 && has17) return { type: 'rocket', main: 17, length: 2 };
  }

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
    if (pairVals.length === unique.length && pairVals.length >= 3) {
      if (pairVals[pairVals.length - 1] < 15 && isConsecutive(pairVals)) {
        return { type: 'double_straight', main: pairVals[pairVals.length - 1], length: cards.length };
      }
    }
  }

  if (cards.length >= 6 && cards.length % 3 === 0) {
    const tripleVals = unique.filter((v) => (counts.get(v) || 0) === 3);
    if (tripleVals.length === unique.length && tripleVals.length >= 2) {
      if (tripleVals[tripleVals.length - 1] < 15 && isConsecutive(tripleVals)) {
        return { type: 'plane', main: tripleVals[tripleVals.length - 1], length: cards.length };
      }
    }
  }

  if (cards.length >= 8 && cards.length % 4 === 0) {
    const tripleVals = unique.filter((v) => (counts.get(v) || 0) === 3);
    const k = tripleVals.length;
    if (k >= 2 && k * 4 === cards.length && tripleVals[tripleVals.length - 1] < 15 && isConsecutive(tripleVals)) {
      const singleVals = unique.filter((v) => (counts.get(v) || 0) === 1);
      if (singleVals.length === k) return { type: 'plane1', main: tripleVals[tripleVals.length - 1], length: cards.length };
    }
  }

  if (cards.length >= 10 && cards.length % 5 === 0) {
    const tripleVals = unique.filter((v) => (counts.get(v) || 0) === 3);
    const pairVals = unique.filter((v) => (counts.get(v) || 0) === 2);
    const k = tripleVals.length;
    if (k >= 2 && k * 5 === cards.length && pairVals.length === k && tripleVals[tripleVals.length - 1] < 15 && isConsecutive(tripleVals)) {
      return { type: 'plane2', main: tripleVals[tripleVals.length - 1], length: cards.length };
    }
  }

  if (cards.length === 6 && unique.length === 3) {
    const quadVal = unique.find((v) => (counts.get(v) || 0) === 4);
    if (quadVal) return { type: 'four2', main: quadVal, length: 6 };
  }

  if (cards.length === 8) {
    const quadVal = unique.find((v) => (counts.get(v) || 0) === 4);
    const pairVals = unique.filter((v) => (counts.get(v) || 0) === 2);
    if (quadVal && pairVals.length === 2) return { type: 'four22', main: quadVal, length: 8 };
  }

  throw new Error('不支持的牌型');
}

export function canBeatDoudizhu(a, b) {
  if (!b) return true;
  if (a.type === 'rocket') return true;
  if (b.type === 'rocket') return false;
  if (a.type === 'bomb' && b.type !== 'bomb') return true;
  if (b.type === 'bomb' && a.type !== 'bomb') return false;
  if (a.type !== b.type) return false;
  if (a.length !== b.length) return false;
  return a.main > b.main;
}

export class DoudizhuGame {
  constructor(playerIds, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.baseBet = Number(options.baseBet || 10);
    this.deck = [];
    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;
    this.phase = 'bidding';
    this.currentPlayerIndex = 0;
    this.gameOver = false;
    this.bottomCards = [];
    this.landlordId = null;
    this.bids = {};
    this.lastPlay = null;
    this.passCount = 0;
    this.initializeGame();
  }

  initializeGame() {
    this.deck = createDeck();
    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;
    this.phase = 'bidding';
    this.currentPlayerIndex = 0;
    this.gameOver = false;
    this.bottomCards = this.deck.splice(0, 3);
    this.landlordId = null;
    this.bids = {};
    this.lastPlay = null;
    this.passCount = 0;

    for (const pid of this.playerIds) {
      this.hands[pid] = [];
      this.playerBets[pid] = this.baseBet;
      this.playerTotalSpent[pid] = this.baseBet;
      this.playerStatus[pid] = 'active';
      this.pot += this.baseBet;
    }

    for (let i = 0; i < 51; i++) {
      const pid = this.playerIds[i % 3];
      this.hands[pid].push(this.deck[i]);
    }
    this.deck = [];
    for (const pid of this.playerIds) {
      this.hands[pid].sort((a, b) => a.value - b.value);
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

  bid(playerId, points) {
    this.validateTurn(playerId);
    if (this.phase !== 'bidding') throw new Error('当前不在叫分阶段');
    const p = Number(points);
    if (!Number.isInteger(p) || p < 0 || p > 3) throw new Error('叫分不合法');
    if (this.bids[playerId] != null) throw new Error('已叫过分');
    this.bids[playerId] = p;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;

    if (Object.keys(this.bids).length === this.playerIds.length) {
      let landlordId = this.playerIds[0];
      let best = -1;
      for (const pid of this.playerIds) {
        const v = Number(this.bids[pid] || 0);
        if (v > best) {
          best = v;
          landlordId = pid;
        }
      }
      this.landlordId = landlordId;
      this.hands[landlordId] = this.hands[landlordId].concat(this.bottomCards);
      this.hands[landlordId].sort((a, b) => a.value - b.value);
      this.phase = 'playing';
      this.currentPlayerIndex = this.playerIds.findIndex((x) => String(x) === String(landlordId));
    }
    return null;
  }

  pass(playerId) {
    this.validateTurn(playerId);
    if (this.phase !== 'playing') throw new Error('当前不在出牌阶段');
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
    if (this.phase !== 'playing') throw new Error('当前不在出牌阶段');
    const ids = Array.isArray(cardIds) ? cardIds : [];
    if (ids.length === 0) throw new Error('出牌不能为空');
    const hand = this.hands[playerId] || [];
    const set = new Set(hand.map((c) => c.id));
    for (const id of ids) {
      if (!set.has(id)) throw new Error('出牌不在手牌中');
    }
    const cards = ids.map((id) => hand.find((c) => c.id === id));
    const playInfo = evaluateDoudizhuPlay(cards);
    const last = this.lastPlay?.play;
    if (last && String(this.lastPlay?.playerId) === String(playerId)) {
      throw new Error('当前不能压自己上家');
    }
    if (!canBeatDoudizhu(playInfo, last)) throw new Error('牌型不够大');

    this.hands[playerId] = hand.filter((c) => !ids.includes(c.id));
    this.lastPlay = { playerId, play: playInfo, cardCount: ids.length };
    this.passCount = 0;

    if (this.hands[playerId].length === 0) {
      return this.endGame(playerId, 'out');
    }

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
      position: String(pid) === String(winnerId) ? 1 : 2,
      status: String(pid) === String(winnerId) ? 'win' : 'lose'
    }));
    return { winnerId, totalPot: this.pot, pot: this.pot, type: `doudizhu_${reason || 'finish'}`, results };
  }

  handleAction(playerId, action, payload) {
    if (action === 'bid') return this.bid(playerId, payload?.points);
    if (action === 'play') return this.play(playerId, payload?.cardIds);
    if (action === 'pass') return this.pass(playerId);
    if (action === 'surrender') return this.surrender(playerId);
    throw new Error('未知操作');
  }

  getGameState() {
    const handsCount = {};
    for (const pid of this.playerIds) {
      handsCount[pid] = (this.hands[pid] || []).length;
    }
    return {
      gameCode: 'doudizhu',
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      landlordId: this.landlordId,
      currentPlayer: this.getCurrentPlayerId(),
      bids: this.bids,
      lastPlay: this.lastPlay ? { playerId: this.lastPlay.playerId, play: this.lastPlay.play } : null,
      handsCount,
      gameOver: this.gameOver
    };
  }
}
