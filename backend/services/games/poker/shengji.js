import { Deck } from './texasHoldem.js';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rankValue(card) {
  const r = String(card.rank);
  if (r === '2') return 15;
  if (r === 'A') return 14;
  if (r === 'K') return 13;
  if (r === 'Q') return 12;
  if (r === 'J') return 11;
  return Number(r);
}

function pointValue(card) {
  const r = String(card.rank);
  if (r === '5') return 5;
  if (r === '10') return 10;
  if (r === 'K') return 10;
  return 0;
}

function teamOfIndex(i) {
  return i % 2 === 0 ? 'A' : 'B';
}

export class ShengjiGame {
  constructor(playerIds, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.baseBet = Number(options.baseBet || 10);
    this.handSize = Number(options.handSize || 26);
    this.trumpSuit = String(options.trumpSuit || '♠');
    this.trumpRank = String(options.trumpRank || '2');
    this.deck = new Deck();
    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;

    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.gameOver = false;

    this.trick = [];
    this.trickLeaderIndex = 0;
    this.tricksWon = {};
    this.teamPoints = { A: 0, B: 0 };

    this.initializeGame();
  }

  initializeGame() {
    this.deck.reset();
    let idSeq = 0;
    const deck1 = this.deck.cards.filter((c) => c.suit !== 'JOKER').map((c) => ({ ...c, id: `sj_${idSeq++}` }));
    const deck2 = deck1.map((c) => ({ ...c, id: `sj_${idSeq++}` }));
    const all = shuffle([...deck1, ...deck2]);

    this.hands = {};
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;

    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.gameOver = false;
    this.trick = [];
    this.trickLeaderIndex = 0;
    this.tricksWon = {};
    this.teamPoints = { A: 0, B: 0 };

    const n = this.playerIds.length;
    for (const pid of this.playerIds) {
      this.hands[pid] = [];
      this.playerBets[pid] = this.baseBet;
      this.playerTotalSpent[pid] = this.baseBet;
      this.playerStatus[pid] = 'active';
      this.pot += this.baseBet;
      this.tricksWon[pid] = 0;
    }

    const totalToDeal = Math.max(1, Math.min(all.length, this.handSize * n));
    for (let i = 0; i < totalToDeal; i++) {
      const pid = this.playerIds[i % n];
      this.hands[pid].push(all[i]);
    }
    for (const pid of this.playerIds) {
      this.hands[pid].sort((a, b) => rankValue(a) - rankValue(b));
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

  suitType(card) {
    if (String(card.rank) === this.trumpRank) return 'TRUMP';
    if (String(card.suit) === this.trumpSuit) return 'TRUMP';
    return String(card.suit);
  }

  cardStrength(card, leadType) {
    const isTrump = this.suitType(card) === 'TRUMP';
    const v = rankValue(card);
    if (isTrump) {
      const isLevel = String(card.rank) === this.trumpRank;
      return (isLevel ? 300 : 200) + v;
    }
    if (leadType === 'TRUMP') return 0;
    if (String(card.suit) !== String(leadType)) return 0;
    return 100 + v;
  }

  play(playerId, cardId) {
    this.validateTurn(playerId);
    if (this.phase !== 'playing') throw new Error('当前不在出牌阶段');
    const hand = this.hands[playerId] || [];
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx < 0) throw new Error('出牌不在手牌中');
    const [card] = hand.splice(idx, 1);

    if (this.trick.length > 0) {
      const leadCard = this.trick[0].card;
      const leadType = this.suitType(leadCard);
      const playedType = this.suitType(card);
      if (leadType === 'TRUMP') {
        const hasTrump = hand.some((c) => this.suitType(c) === 'TRUMP');
        if (hasTrump && playedType !== 'TRUMP') throw new Error('必须跟主');
      } else {
        const hasLeadSuit = hand.some((c) => this.suitType(c) !== 'TRUMP' && String(c.suit) === String(leadType));
        if (hasLeadSuit) {
          if (playedType === 'TRUMP' || String(card.suit) !== String(leadType)) throw new Error('必须跟花色');
        }
      }
    }

    this.trick.push({ playerId, card });

    if (this.trick.length < this.playerIds.length) {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
      return null;
    }

    const leadType = this.suitType(this.trick[0].card);
    let winner = this.trick[0];
    let best = this.cardStrength(winner.card, leadType);
    for (const t of this.trick.slice(1)) {
      const s = this.cardStrength(t.card, leadType);
      if (s > best) {
        best = s;
        winner = t;
      }
    }

    const winnerIdx = this.playerIds.findIndex((x) => String(x) === String(winner.playerId));
    const team = teamOfIndex(winnerIdx);
    const points = this.trick.reduce((sum, t) => sum + pointValue(t.card), 0);
    this.teamPoints[team] = Number(this.teamPoints[team] || 0) + points;
    this.tricksWon[winner.playerId] = Number(this.tricksWon[winner.playerId] || 0) + 1;
    this.trick = [];
    this.trickLeaderIndex = this.playerIds.findIndex((x) => String(x) === String(winner.playerId));
    this.currentPlayerIndex = this.trickLeaderIndex;

    const remaining = this.playerIds.reduce((sum, pid) => sum + (this.hands[pid] || []).length, 0);
    if (remaining === 0) return this.settle();
    return null;
  }

  surrender(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (!this.playerIds.some((pid) => String(pid) === String(playerId))) throw new Error('玩家不在对局中');
    const winnerId = this.playerIds.find((pid) => String(pid) !== String(playerId)) || playerId;
    return this.endGame(winnerId, 'surrender');
  }

  settle() {
    const winnerTeam = Number(this.teamPoints.A || 0) >= Number(this.teamPoints.B || 0) ? 'A' : 'B';
    const winners = this.playerIds.filter((_, i) => teamOfIndex(i) === winnerTeam);
    const winnerId = winners[0];
    return this.endGame(winnerId, `finish_${winnerTeam}`);
  }

  endGame(winnerId, reason) {
    this.gameOver = true;
    this.phase = 'settled';
    const winnerIndex = this.playerIds.findIndex((x) => String(x) === String(winnerId));
    const winnerTeam = winnerIndex >= 0 ? teamOfIndex(winnerIndex) : 'A';
    const winners = this.playerIds.filter((_, i) => teamOfIndex(i) === winnerTeam);
    const perWinner = winners.length > 0 ? Math.floor(this.pot / winners.length) : 0;
    let remainder = this.pot - perWinner * winners.length;
    const results = this.playerIds.map((pid) => {
      const isWinTeam = winners.some((w) => String(w) === String(pid));
      let chipsChange = 0;
      if (isWinTeam) {
        chipsChange = perWinner + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
      }
      return {
        userId: pid,
        chipsChange,
        totalSpent: this.playerTotalSpent[pid] || 0,
        position: isWinTeam ? 1 : 2,
        tricksWon: this.tricksWon[pid] || 0
      };
    });
    return { winnerId, totalPot: this.pot, pot: this.pot, type: `shengji_${reason || 'finish'}`, results };
  }

  handleAction(playerId, action, payload) {
    if (action === 'play') return this.play(playerId, payload?.cardId);
    if (action === 'surrender') return this.surrender(playerId);
    throw new Error('未知操作');
  }

  getGameState() {
    const handsCount = {};
    for (const pid of this.playerIds) handsCount[pid] = (this.hands[pid] || []).length;
    return {
      gameCode: 'shengji',
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      handSize: this.handSize,
      trumpSuit: this.trumpSuit,
      trumpRank: this.trumpRank,
      currentPlayer: this.getCurrentPlayerId(),
      handsCount,
      trick: this.trick.map((t) => ({ playerId: t.playerId, card: { suit: t.card.suit, rank: t.card.rank } })),
      tricksWon: this.tricksWon,
      teamPoints: this.teamPoints,
      gameOver: this.gameOver
    };
  }
}
