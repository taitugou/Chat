function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function scoreFor(d1, d2) {
  const a = Math.min(d1, d2);
  const b = Math.max(d1, d2);
  if (a === 2 && b === 8) return { rank: 1000, sum: 10, high: 8 };
  const sum = a + b;
  const isPair = a === b;
  return { rank: (isPair ? 500 : 0) + sum * 10 + b, sum, high: b };
}

export class ErbabanGame {
  constructor(playerIds, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.baseBet = Number(options.baseBet || 10);
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;

    this.phase = 'rolling';
    this.currentPlayerIndex = 0;
    this.gameOver = false;

    this.rolls = {};

    for (const pid of this.playerIds) {
      this.playerBets[pid] = this.baseBet;
      this.playerTotalSpent[pid] = this.baseBet;
      this.playerStatus[pid] = 'active';
      this.pot += this.baseBet;
      this.rolls[pid] = null;
    }
  }

  getCurrentPlayerId() {
    return this.playerIds[this.currentPlayerIndex];
  }

  validateTurn(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.phase !== 'rolling') throw new Error('当前阶段不允许该操作');
    if (String(playerId) !== String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
    if (this.rolls[playerId]) throw new Error('已掷骰');
  }

  roll(playerId) {
    this.validateTurn(playerId);
    const d1 = rollDie();
    const d2 = rollDie();
    this.rolls[playerId] = { d1, d2, score: scoreFor(d1, d2) };
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    const allRolled = this.playerIds.every((pid) => this.rolls[pid]);
    if (allRolled) return this.settle();
    return null;
  }

  surrender(playerId) {
    this.validateTurn(playerId);
    const winnerId = this.playerIds.find((pid) => String(pid) !== String(playerId)) || playerId;
    return this.endGame(winnerId, 'surrender');
  }

  settle() {
    let winnerId = this.playerIds[0];
    let best = -Infinity;
    for (const pid of this.playerIds) {
      const r = this.rolls[pid];
      const v = Number(r?.score?.rank || 0);
      if (v > best) {
        best = v;
        winnerId = pid;
      }
    }
    return this.endGame(winnerId, 'finish');
  }

  endGame(winnerId, reason) {
    this.gameOver = true;
    this.phase = 'settled';
    const results = this.playerIds.map((pid) => ({
      userId: pid,
      chipsChange: String(pid) === String(winnerId) ? this.pot : 0,
      totalSpent: this.playerTotalSpent[pid] || 0,
      position: String(pid) === String(winnerId) ? 1 : 2,
      roll: this.rolls[pid]
    }));
    return { winnerId, totalPot: this.pot, pot: this.pot, type: `erbaban_${reason || 'finish'}`, results };
  }

  handleAction(playerId, action, payload) {
    if (action === 'roll') return this.roll(playerId);
    if (action === 'surrender') return this.surrender(playerId);
    throw new Error('未知操作');
  }

  getGameState() {
    const rolled = {};
    for (const pid of this.playerIds) rolled[pid] = !!this.rolls[pid];
    return {
      gameCode: 'erbaban',
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      currentPlayer: this.getCurrentPlayerId(),
      rolled,
      gameOver: this.gameOver
    };
  }
}

