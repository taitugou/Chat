function emptyBoard(w, h, fill = null) {
  const b = new Array(h);
  for (let y = 0; y < h; y++) {
    b[y] = new Array(w).fill(fill);
  }
  return b;
}

export class AbstractBoardGame {
  constructor(playerIds, gameCode, options = {}) {
    this.playerIds = playerIds.map((x) => Number(x));
    this.gameCode = gameCode;
    this.baseBet = Number(options.baseBet || 10);
    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;

    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.gameOver = false;

    this.boardW = Number(options.boardW || 8);
    this.boardH = Number(options.boardH || 8);
    this.board = emptyBoard(this.boardW, this.boardH, null);
  }

  getCurrentPlayerId() {
    return this.playerIds[this.currentPlayerIndex];
  }

  validateTurn(playerId) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.phase !== 'playing') throw new Error('当前阶段不允许该操作');
    if (String(playerId) !== String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
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
    return { winnerId, totalPot: this.pot, pot: this.pot, type: `${this.gameCode}_${reason || 'finish'}`, results };
  }

  getGameState() {
    return {
      gameCode: this.gameCode,
      phase: this.phase,
      pot: this.pot,
      baseBet: this.baseBet,
      currentPlayer: this.getCurrentPlayerId(),
      boardW: this.boardW,
      boardH: this.boardH,
      board: this.board,
      gameOver: this.gameOver
    };
  }
}
