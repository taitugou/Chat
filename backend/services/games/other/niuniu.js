import { Deck } from '../poker/texasHoldem.js';

function cardPoint(card) {
  const r = String(card.rank);
  if (r === 'A') return 1;
  if (r === 'K' || r === 'Q' || r === 'J') return 10;
  return Number(r);
}

function cardRankValue(card) {
  const r = String(card.rank);
  if (r === 'A') return 14;
  if (r === 'K') return 13;
  if (r === 'Q') return 12;
  if (r === 'J') return 11;
  return Number(r);
}

function bestNiuValue(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) return 0;
  const points = cards.map(cardPoint);
  const total = points.reduce((a, b) => a + b, 0);
  let best = 0;
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      for (let k = j + 1; k < 5; k++) {
        const sum3 = points[i] + points[j] + points[k];
        if (sum3 % 10 !== 0) continue;
        const rest = total - sum3;
        const niu = rest % 10;
        const v = niu === 0 ? 10 : niu;
        if (v > best) best = v;
      }
    }
  }
  return best;
}

function highestCardValue(cards) {
  return Math.max(...cards.map((c) => cardRankValue(c)));
}

function compareHands(aCards, bCards) {
  const av = bestNiuValue(aCards);
  const bv = bestNiuValue(bCards);
  if (av !== bv) return av > bv ? 1 : -1;
  const ah = highestCardValue(aCards);
  const bh = highestCardValue(bCards);
  if (ah !== bh) return ah > bh ? 1 : -1;
  return 0;
}

export class NiuniuGame {
  constructor(playerIds, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.deck = new Deck();
    this.baseBet = Number(options.baseBet || 20);

    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.playerRevealed = {};

    this.bankerId = null;
    this.phase = 'reveal';
    this.gameOver = false;
    this.pot = 0;

    this.initializeGame();
  }

  initializeGame() {
    this.deck.reset();
    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.playerRevealed = {};
    this.phase = 'reveal';
    this.gameOver = false;
    this.pot = 0;

    this.bankerId = this.playerIds[0] ?? null;

    for (const pid of this.playerIds) {
      this.hands[pid] = this.deck.dealMultiple(5);
      const isBanker = String(pid) === String(this.bankerId);
      const bet = isBanker ? this.baseBet * Math.max(1, this.playerIds.length - 1) : this.baseBet;
      this.playerBets[pid] = bet;
      this.playerTotalSpent[pid] = bet;
      this.playerStatus[pid] = 'active';
      this.playerRevealed[pid] = false;
      this.pot += bet;
    }
  }

  reveal(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.phase !== 'reveal') throw new Error('当前阶段不允许该操作');
    if (this.playerStatus[playerId] !== 'active') throw new Error('玩家状态不允许操作');
    this.playerRevealed[playerId] = true;
    if (this.playerIds.every((pid) => this.playerRevealed[pid])) {
      return this.settle();
    }
    return null;
  }

  settle() {
    if (this.gameOver) return null;
    this.phase = 'settled';
    this.gameOver = true;

    const bankerId = this.bankerId;
    const bankerHand = this.hands[bankerId];
    const results = [];
    let paidOut = 0;
    for (const pid of this.playerIds) {
      if (String(pid) === String(bankerId)) continue;
      const bet = Number(this.playerBets[pid] || 0);
      const cmp = compareHands(this.hands[pid], bankerHand);
      if (cmp > 0) {
        const payout = bet * 2;
        results.push({
          userId: pid,
          chipsChange: payout,
          totalSpent: this.playerTotalSpent[pid] || 0,
          position: 2,
          status: 'win',
          niu: bestNiuValue(this.hands[pid]),
          hand: this.hands[pid],
        });
        paidOut += payout;
      } else if (cmp === 0) {
        const payout = bet;
        results.push({
          userId: pid,
          chipsChange: payout,
          totalSpent: this.playerTotalSpent[pid] || 0,
          position: 2,
          status: 'push',
          niu: bestNiuValue(this.hands[pid]),
          hand: this.hands[pid],
        });
        paidOut += payout;
      } else {
        results.push({
          userId: pid,
          chipsChange: 0,
          totalSpent: this.playerTotalSpent[pid] || 0,
          position: 2,
          status: 'lose',
          niu: bestNiuValue(this.hands[pid]),
          hand: this.hands[pid],
        });
      }
    }

    const bankerPayout = Math.max(0, Number(this.pot || 0) - paidOut);
    paidOut += bankerPayout;

    results.push({
      userId: bankerId,
      chipsChange: bankerPayout,
      totalSpent: this.playerTotalSpent[bankerId] || 0,
      position: 2,
      status: 'banker',
      niu: bestNiuValue(bankerHand),
      hand: bankerHand,
    });

    let winnerId = bankerId;
    let bestNet = -Infinity;
    for (const r of results) {
      const net = Number(r.chipsChange || 0) - Number(r.totalSpent || 0);
      if (net > bestNet) {
        bestNet = net;
        winnerId = r.userId;
      }
    }
    for (const r of results) {
      r.position = String(r.userId) === String(winnerId) ? 1 : 2;
    }

    return {
      winnerId,
      totalPot: this.pot,
      pot: this.pot,
      type: 'niuniu_settle',
      results,
    };
  }

  handleAction(playerId, action, payload) {
    if (action === 'reveal') return this.reveal(playerId);
    if (action === 'settle') {
      if (String(playerId) !== String(this.bankerId)) throw new Error('只有庄家可以结算');
      return this.settle();
    }
    throw new Error('未知操作');
  }

  getGameState() {
    return {
      gameCode: 'niuniu',
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      bankerId: this.bankerId,
      hands: this.hands,
      playerBets: this.playerBets,
      playerStatus: this.playerStatus,
      playerRevealed: this.playerRevealed,
      gameOver: this.gameOver,
    };
  }
}
