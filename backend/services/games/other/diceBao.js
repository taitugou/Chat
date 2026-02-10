function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function isTriple(dice) {
  return dice.length === 3 && dice[0] === dice[1] && dice[1] === dice[2];
}

function outcomeForDice(dice) {
  const sum = dice.reduce((a, b) => a + b, 0);
  if (isTriple(dice)) return { outcome: 'triple', sum };
  if (sum >= 11 && sum <= 17) return { outcome: 'big', sum };
  if (sum >= 4 && sum <= 10) return { outcome: 'small', sum };
  return { outcome: 'unknown', sum };
}

function distributeLoserPot({ playerIds, bets, outcomes, weights }) {
  const payouts = {};
  const spent = {};
  for (const pid of playerIds) {
    const b = Number(bets[pid] || 0);
    spent[pid] = b;
    payouts[pid] = 0;
  }

  const losers = playerIds.filter((pid) => outcomes[pid] === 'lose');
  const winners = playerIds.filter((pid) => outcomes[pid] === 'win');
  const pushes = playerIds.filter((pid) => outcomes[pid] === 'push');

  const loserPot = losers.reduce((s, pid) => s + Number(bets[pid] || 0), 0);
  const winnerWeightSum = winners.reduce((s, pid) => s + Number(weights[pid] || 0), 0);

  for (const pid of pushes) {
    payouts[pid] = Number(bets[pid] || 0);
  }

  if (winners.length === 0) {
    for (const pid of playerIds) {
      payouts[pid] = Number(bets[pid] || 0);
    }
    return { payouts, spent };
  }

  if (loserPot <= 0 || winnerWeightSum <= 0) {
    for (const pid of winners) {
      payouts[pid] = Number(bets[pid] || 0);
    }
    return { payouts, spent };
  }

  let distributed = 0;
  const orderedWinners = winners.slice().sort((a, b) => Number(a) - Number(b));
  for (const pid of orderedWinners) {
    const b = Number(bets[pid] || 0);
    const w = Number(weights[pid] || 0);
    const share = Math.floor((loserPot * w) / winnerWeightSum);
    payouts[pid] = b + share;
    distributed += share;
  }

  const remainder = loserPot - distributed;
  if (remainder > 0 && orderedWinners.length > 0) {
    const target = orderedWinners[0];
    payouts[target] = Number(payouts[target] || 0) + remainder;
  }

  return { payouts, spent };
}

export class DiceBaoGame {
  constructor(playerIds, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.baseBet = Number(options.baseBet || 10);

    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.playerSelections = {};

    this.currentPlayerIndex = 0;
    this.phase = 'betting';
    this.gameOver = false;
    this.pot = 0;

    this.dice = null;
    this.result = null;

    this.initializeGame();
  }

  initializeGame() {
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.playerSelections = {};
    this.currentPlayerIndex = 0;
    this.phase = 'betting';
    this.gameOver = false;
    this.pot = 0;
    this.dice = null;
    this.result = null;

    for (const pid of this.playerIds) {
      this.playerBets[pid] = 0;
      this.playerTotalSpent[pid] = 0;
      this.playerStatus[pid] = 'active';
      this.playerSelections[pid] = null;
    }
  }

  getCurrentPlayerId() {
    return this.playerIds[this.currentPlayerIndex];
  }

  validateTurn(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.phase !== 'betting') throw new Error('当前阶段不允许该操作');
    if (String(playerId) !== String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
    if (this.playerStatus[playerId] !== 'active') throw new Error('玩家状态不允许操作');
  }

  bet(playerId, selection, amount) {
    this.validateTurn(playerId);
    const sel = String(selection || '').toLowerCase();
    if (!['big', 'small', 'triple'].includes(sel)) throw new Error('下注类型不合法');
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) throw new Error('下注金额不合法');

    this.playerSelections[playerId] = sel;
    this.playerBets[playerId] = a;
    this.playerTotalSpent[playerId] = a;
    this.pot += a;

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    if (this.playerIds.every((pid) => !!this.playerSelections[pid])) {
      this.phase = 'rolling';
    }
    return null;
  }

  roll(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.phase !== 'rolling') throw new Error('尚未到开奖阶段');
    if (String(playerId) !== String(this.playerIds[0])) throw new Error('只有房主座位可开奖');

    this.dice = [rollDie(), rollDie(), rollDie()];
    this.result = outcomeForDice(this.dice);
    return this.settle();
  }

  settle() {
    if (this.gameOver) return null;
    this.phase = 'settled';
    this.gameOver = true;

    const outcomes = {};
    const weights = {};

    for (const pid of this.playerIds) {
      const bet = Number(this.playerBets[pid] || 0);
      const pick = this.playerSelections[pid];
      const isWin = pick && pick === this.result?.outcome;
      const isPush = !pick;
      outcomes[pid] = isPush ? 'push' : isWin ? 'win' : 'lose';
      const w = pick === 'triple' ? 2 : 1;
      weights[pid] = bet * w;
    }

    const { payouts, spent } = distributeLoserPot({
      playerIds: this.playerIds,
      bets: this.playerBets,
      outcomes,
      weights
    });

    const results = this.playerIds.map((pid) => {
      const pick = this.playerSelections[pid];
      const status = outcomes[pid] || 'lose';
      return {
        userId: pid,
        chipsChange: Number(payouts[pid] || 0),
        totalSpent: Number(spent[pid] || 0),
        position: 2,
        status,
        selection: pick,
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
      type: 'dicebao_settle',
      results,
      dice: this.dice,
      outcome: this.result,
    };
  }

  handleAction(playerId, action, payload) {
    if (action === 'place_bet') {
      return this.bet(playerId, payload?.selection, payload?.amount);
    }
    if (action === 'roll') {
      return this.roll(playerId);
    }
    throw new Error('未知操作');
  }

  getGameState() {
    return {
      gameCode: 'touzi_bao',
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      currentPlayer: this.phase === 'betting' ? this.getCurrentPlayerId() : null,
      playerBets: this.playerBets,
      playerStatus: this.playerStatus,
      playerSelections: this.playerSelections,
      dice: this.phase === 'settled' ? this.dice : null,
      outcome: this.phase === 'settled' ? this.result : null,
      gameOver: this.gameOver,
    };
  }
}
