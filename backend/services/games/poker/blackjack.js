import { Deck } from './texasHoldem.js';

function handValue(cards) {
  let total = 0;
  let aces = 0;

  for (const c of cards) {
    const r = String(c.rank);
    if (r === 'A') {
      aces += 1;
      total += 11;
      continue;
    }
    if (r === 'K' || r === 'Q' || r === 'J') {
      total += 10;
      continue;
    }
    total += Number(r);
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isBlackjack(cards) {
  return Array.isArray(cards) && cards.length === 2 && handValue(cards) === 21;
}

export class BlackjackGame {
  constructor(playerIds, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.deck = new Deck();

    this.baseBet = Number(options.baseBet || 20);

    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};

    this.dealerHand = [];
    this.dealerReveal = false;

    this.currentPlayerIndex = 0;
    this.phase = 'player_turns';
    this.gameOver = false;
    this.pot = 0;
    this.__immediateResult = null;

    this.initializeGame();
  }

  initializeGame() {
    this.deck.reset();
    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.dealerHand = [];
    this.dealerReveal = false;
    this.currentPlayerIndex = 0;
    this.phase = 'player_turns';
    this.gameOver = false;
    this.pot = 0;
    this.__immediateResult = null;

    for (const pid of this.playerIds) {
      this.hands[pid] = [this.deck.deal(), this.deck.deal()];
      this.playerBets[pid] = this.baseBet;
      this.playerTotalSpent[pid] = this.baseBet;
      this.playerStatus[pid] = 'active';
      this.pot += this.baseBet;
    }

    this.dealerHand = [this.deck.deal(), this.deck.deal()];

    this.advanceToNextPlayablePlayer();
    this.checkImmediateSettle();
  }

  getCurrentPlayerId() {
    return this.playerIds[this.currentPlayerIndex];
  }

  getPlayerValue(playerId) {
    return handValue(this.hands[playerId] || []);
  }

  getDealerValue() {
    return handValue(this.dealerHand || []);
  }

  validateTurn(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.phase !== 'player_turns') throw new Error('当前阶段不允许该操作');
    if (String(playerId) !== String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
    if (this.playerStatus[playerId] !== 'active') throw new Error('玩家状态不允许操作');
  }

  advanceToNextPlayablePlayer() {
    if (this.phase !== 'player_turns') return;
    const max = this.playerIds.length;
    let tries = 0;
    while (tries < max && this.playerStatus[this.getCurrentPlayerId()] !== 'active') {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
      tries += 1;
    }
    if (tries >= max) {
      this.phase = 'dealer_turn';
    }
  }

  checkImmediateSettle() {
    if (this.phase !== 'player_turns') return;

    const allBJ = this.playerIds.every((pid) => isBlackjack(this.hands[pid]));
    const dealerBJ = isBlackjack(this.dealerHand);

    if (dealerBJ || allBJ) {
      this.phase = 'dealer_turn';
      const result = this.settle();
      this.__immediateResult = result;
      return result;
    }
    return null;
  }

  hit(playerId) {
    this.validateTurn(playerId);
    const card = this.deck.deal();
    this.hands[playerId].push(card);

    const v = this.getPlayerValue(playerId);
    if (v > 21) {
      this.playerStatus[playerId] = 'busted';
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
      this.advanceToNextPlayablePlayer();
      if (this.phase === 'dealer_turn') return this.settle();
      return null;
    }

    return null;
  }

  stand(playerId) {
    this.validateTurn(playerId);
    this.playerStatus[playerId] = 'stood';
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    this.advanceToNextPlayablePlayer();
    if (this.phase === 'dealer_turn') return this.settle();
    return null;
  }

  double(playerId) {
    this.validateTurn(playerId);
    if ((this.hands[playerId] || []).length !== 2) throw new Error('只能在前两张牌时加倍');
    const add = this.baseBet;
    this.playerBets[playerId] = Number(this.playerBets[playerId] || 0) + add;
    this.playerTotalSpent[playerId] = (this.playerTotalSpent[playerId] || 0) + add;
    this.pot += add;

    this.hands[playerId].push(this.deck.deal());
    const v = this.getPlayerValue(playerId);
    this.playerStatus[playerId] = v > 21 ? 'busted' : 'stood';
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    this.advanceToNextPlayablePlayer();
    if (this.phase === 'dealer_turn') return this.settle();
    return null;
  }

  handleAction(playerId, action, payload) {
    if (action === 'hit') return this.hit(playerId);
    if (action === 'stand') return this.stand(playerId);
    if (action === 'double') return this.double(playerId);
    throw new Error('未知操作');
  }

  dealerPlay() {
    this.dealerReveal = true;
    while (this.getDealerValue() < 17) {
      this.dealerHand.push(this.deck.deal());
    }
  }

  settle() {
    if (this.gameOver) return null;
    this.phase = 'settled';
    this.dealerPlay();
    this.gameOver = true;

    const dealerVal = this.getDealerValue();
    const dealerBust = dealerVal > 21;
    const dealerBJ = isBlackjack(this.dealerHand);

    const outcomes = {};
    for (const pid of this.playerIds) {
      const bet = Number(this.playerBets[pid] || 0);
      const hv = this.getPlayerValue(pid);
      const bj = isBlackjack(this.hands[pid]);

      let outcome = 'lose';

      if (hv > 21) {
        outcome = 'bust';
      } else if (dealerBust) {
        outcome = bj ? 'blackjack' : 'win';
      } else if (dealerBJ && !bj) {
        outcome = 'lose';
      } else if (bj && !dealerBJ) {
        outcome = 'blackjack';
      } else if (hv > dealerVal) {
        outcome = 'win';
      } else if (hv === dealerVal) {
        outcome = 'push';
      } else {
        outcome = 'lose';
      }

      outcomes[pid] = { outcome, bet, handValue: hv };
    }

    const losers = this.playerIds.filter((pid) => ['lose', 'bust'].includes(outcomes[pid]?.outcome));
    const pushes = this.playerIds.filter((pid) => outcomes[pid]?.outcome === 'push');
    const winners = this.playerIds.filter((pid) => ['win', 'blackjack'].includes(outcomes[pid]?.outcome));

    const loserPot = losers.reduce((s, pid) => s + Number(this.playerBets[pid] || 0), 0);
    const weightBet = {};
    for (const pid of winners) {
      const w = outcomes[pid]?.outcome === 'blackjack' ? 1.5 : 1;
      weightBet[pid] = Number(this.playerBets[pid] || 0) * w;
    }
    const weightSum = winners.reduce((s, pid) => s + Number(weightBet[pid] || 0), 0);

    const payouts = {};
    for (const pid of this.playerIds) payouts[pid] = 0;

    for (const pid of pushes) {
      payouts[pid] = Number(this.playerBets[pid] || 0);
    }

    if (winners.length === 0) {
      for (const pid of pushes) payouts[pid] = Number(this.playerBets[pid] || 0);
    } else if (loserPot <= 0 || weightSum <= 0) {
      for (const pid of winners) payouts[pid] = Number(this.playerBets[pid] || 0);
    } else {
      let distributed = 0;
      const ordered = winners.slice().sort((a, b) => Number(a) - Number(b));
      for (const pid of ordered) {
        const base = Number(this.playerBets[pid] || 0);
        const share = Math.floor((loserPot * Number(weightBet[pid] || 0)) / weightSum);
        payouts[pid] = base + share;
        distributed += share;
      }
      const remainder = loserPot - distributed;
      if (remainder > 0 && ordered.length > 0) {
        payouts[ordered[0]] = Number(payouts[ordered[0]] || 0) + remainder;
      }
    }

    const results = this.playerIds.map((pid) => {
      const spent = Number(this.playerTotalSpent[pid] || 0);
      const hv = outcomes[pid]?.handValue;
      const outcome = outcomes[pid]?.outcome || 'lose';
      return {
        userId: pid,
        chipsChange: Number(payouts[pid] || 0),
        totalSpent: spent,
        position: 2,
        status: outcome,
        hand: this.hands[pid],
        handValue: hv,
      };
    });

    let winnerId = this.playerIds[0];
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
      type: 'blackjack_settle',
      results,
    };
  }

  getGameState() {
    const dealer = this.dealerReveal
      ? this.dealerHand
      : [this.dealerHand[0], { suit: '🂠', rank: 'HIDDEN', value: 0 }];

    return {
      gameCode: 'blackjack',
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      currentPlayer: this.phase === 'player_turns' ? this.getCurrentPlayerId() : null,
      playerBets: this.playerBets,
      playerStatus: this.playerStatus,
      hands: this.hands,
      dealerHand: dealer,
      dealerReveal: this.dealerReveal,
      gameOver: this.gameOver,
    };
  }
}
