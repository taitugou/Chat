
import { Deck } from './texasHoldem.js';

function normalizeValues(hand) {
  const values = hand.map((c) => Number(c.value));
  values.sort((a, b) => b - a);
  return values;
}

function normalizeSuits(hand) {
  return hand.map((c) => String(c.suit));
}

function allSame(arr) {
  return arr.length > 0 && arr.every((x) => x === arr[0]);
}

function allDifferent(arr) {
  const s = new Set(arr);
  return s.size === arr.length;
}

function lexCompare(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = Number(a[i] || 0);
    const bv = Number(b[i] || 0);
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

export class ZhajinhuaGame {
  constructor(playerIds, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.deck = new Deck();
    this.hands = {};
    this.playerStatus = {};
    this.playerBets = {};
    this.playerSeen = {};
    this.gameOver = false;
    this.pot = 0;
    this.baseBet = Number(options.baseBet || 10);
    this.ante = Number(options.ante || this.baseBet);
    this.maxRaiseMultiplier = Number(options.maxRaiseMultiplier || 4);
    this.compareCostMultiplier = Number(options.compareCostMultiplier || 2);
    this.enable235 = options.enable235 !== false;
    this.a23Rule = options.a23Rule || 'low';
    this.currentPlayerIndex = 0;
    this.initializeGame();
  }

  initializeGame() {
    this.deck.reset();
    this.gameOver = false;
    this.pot = 0;
    this.playerStatus = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerSeen = {};

    for (const pid of this.playerIds) {
      this.hands[pid] = this.deck.dealMultiple(3);
      this.playerStatus[pid] = 'active';
      this.playerBets[pid] = 0;
      this.playerTotalSpent[pid] = this.ante;
      this.playerSeen[pid] = false;

      this.playerBets[pid] += this.ante;
      this.pot += this.ante;
    }

    this.currentPlayerIndex = 0;
  }

  getCurrentPlayerId() {
    return this.playerIds[this.currentPlayerIndex];
  }

  getActivePlayerIds() {
    return this.playerIds.filter((id) => this.playerStatus[id] === 'active');
  }

  validateTurn(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (Number(playerId) !== Number(this.getCurrentPlayerId())) throw new Error('不是你的回合');
    if (this.playerStatus[playerId] !== 'active') throw new Error('玩家已出局');
  }

  isSeen(playerId) {
    return !!this.playerSeen[playerId];
  }

  getUnitBet(playerId) {
    return this.isSeen(playerId) ? this.baseBet * 2 : this.baseBet;
  }

  see(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.playerStatus[playerId] !== 'active') throw new Error('玩家已出局');
    this.playerSeen[playerId] = true;
    return null;
  }

  call(playerId) {
    this.validateTurn(playerId);
    const amount = this.getUnitBet(playerId);
    this.pot += amount;
    this.playerBets[playerId] = Number(this.playerBets[playerId] || 0) + amount;
    this.playerTotalSpent[playerId] = (this.playerTotalSpent[playerId] || 0) + amount;
    return this.nextTurn();
  }

  raise(playerId, newBaseBet) {
    this.validateTurn(playerId);
    const n = Number(newBaseBet);
    if (!Number.isFinite(n) || n <= 0) throw new Error('加注金额不合法');
    if (n <= this.baseBet) throw new Error('加注必须大于当前注额');
    if (n > this.baseBet * this.maxRaiseMultiplier) throw new Error('加注超出上限');
    this.baseBet = n;
    const amount = this.getUnitBet(playerId);
    this.pot += amount;
    this.playerBets[playerId] = Number(this.playerBets[playerId] || 0) + amount;
    this.playerTotalSpent[playerId] = (this.playerTotalSpent[playerId] || 0) + amount;
    return this.nextTurn();
  }

  fold(playerId) {
    this.validateTurn(playerId);
    this.playerStatus[playerId] = 'folded';
    return this.nextTurn();
  }

  compare(playerId, targetId) {
    this.validateTurn(playerId);
    const activeIds = this.getActivePlayerIds();
    if (activeIds.length < 2) throw new Error('人数不足，无法比牌');
    if (this.playerStatus[targetId] !== 'active') throw new Error('对方已出局');
    if (Number(targetId) === Number(playerId)) throw new Error('不能与自己比牌');

    const cost = this.getUnitBet(playerId) * this.compareCostMultiplier;
    this.pot += cost;
    this.playerBets[playerId] = Number(this.playerBets[playerId] || 0) + cost;
    this.playerTotalSpent[playerId] = (this.playerTotalSpent[playerId] || 0) + cost;

    const winnerId = this.compareHands(playerId, targetId);
    const loserId = Number(winnerId) === Number(playerId) ? targetId : playerId;
    this.playerStatus[loserId] = 'lost';

    return this.nextTurn();
  }

  nextTurn() {
    const activePlayers = this.getActivePlayerIds();
    if (activePlayers.length === 1) return this.endGame(activePlayers[0], 'last');

    let nextIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    while (this.playerStatus[this.playerIds[nextIndex]] !== 'active') {
      nextIndex = (nextIndex + 1) % this.playerIds.length;
    }
    this.currentPlayerIndex = nextIndex;
    return null;
  }

  isA23(values) {
    const v = [...values].sort((a, b) => b - a);
    return v[0] === 14 && v[1] === 3 && v[2] === 2;
  }

  getStraightHigh(values) {
    const v = [...values].sort((a, b) => b - a);
    if (this.isA23(v)) {
      if (this.a23Rule === 'second') return 13.5;
      return 3;
    }
    return v[0];
  }

  isStraight(values) {
    const v = [...values].sort((a, b) => b - a);
    if (this.isA23(v)) return true;
    return v[0] - v[1] === 1 && v[1] - v[2] === 1;
  }

  getHandProfile(hand) {
    const values = normalizeValues(hand);
    const suits = normalizeSuits(hand);
    const isFlush = allSame(suits);
    const isStraight = this.isStraight(values);

    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    const countValues = Object.values(counts).sort((a, b) => b - a);

    const isLeopard = countValues[0] === 3;
    const isPair = countValues[0] === 2;

    const is235 =
      values[0] === 5 &&
      values[1] === 3 &&
      values[2] === 2 &&
      allDifferent(suits) &&
      !isFlush &&
      !isStraight &&
      !isPair &&
      !isLeopard;

    if (isLeopard) {
      return { typeRank: 6, typeName: '豹子', tiebreaker: [values[0]], is235: false };
    }
    if (isFlush && isStraight) {
      return { typeRank: 5, typeName: '同花顺', tiebreaker: [this.getStraightHigh(values)], is235: false };
    }
    if (isFlush) {
      return { typeRank: 4, typeName: '金花', tiebreaker: values, is235: false };
    }
    if (isStraight) {
      return { typeRank: 3, typeName: '顺子', tiebreaker: [this.getStraightHigh(values)], is235: false };
    }
    if (isPair) {
      const pairValue = Number(Object.keys(counts).find((k) => counts[k] === 2));
      const kicker = values.find((x) => x !== pairValue);
      return { typeRank: 2, typeName: '对子', tiebreaker: [pairValue, kicker], is235: false };
    }
    return { typeRank: 1, typeName: '单张', tiebreaker: values, is235 };
  }

  compareHands(aId, bId) {
    const a = this.getHandProfile(this.hands[aId]);
    const b = this.getHandProfile(this.hands[bId]);

    if (this.enable235) {
      if (a.typeRank === 6 && b.typeRank === 1 && b.is235) return bId;
      if (b.typeRank === 6 && a.typeRank === 1 && a.is235) return aId;
    }

    if (a.typeRank !== b.typeRank) return a.typeRank > b.typeRank ? aId : bId;
    const cmp = lexCompare(a.tiebreaker, b.tiebreaker);
    if (cmp === 0) return aId;
    return cmp > 0 ? aId : bId;
  }

  endShowdown(aId, bId) {
    const winnerId = this.compareHands(aId, bId);
    return this.endGame(winnerId, 'showdown');
  }

  endGame(winnerId, reason) {
    this.gameOver = true;
    const results = this.playerIds.map((pid) => {
      const isWinner = Number(pid) === Number(winnerId);
      const profile = this.getHandProfile(this.hands[pid]);
      return {
        userId: pid,
        chipsChange: isWinner ? this.pot : 0,
        totalSpent: this.playerTotalSpent[pid] || 0,
        position: isWinner ? 1 : 2,
        hand: this.hands[pid],
        handType: profile.typeName,
        status: this.playerStatus[pid],
      };
    });

    return {
      winnerId,
      totalPot: this.pot,
      pot: this.pot,
      type: reason || 'zhajinhua_win',
      results,
    };
  }

  getGameState() {
    const activePlayers = this.getActivePlayerIds();
    return {
      pot: this.pot,
      currentBet: this.baseBet,
      playerBets: this.playerBets,
      playerStatus: this.playerStatus,
      playerSeen: this.playerSeen,
      currentPlayer: this.getCurrentPlayerId(),
      gameOver: this.gameOver,
      activePlayers: activePlayers.length,
      allowCompare: activePlayers.length >= 2,
    };
  }
}
