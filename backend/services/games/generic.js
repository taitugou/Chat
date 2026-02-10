
export class GenericGame {
    constructor(playerIds, gameCode, options = {}) {
        this.playerIds = playerIds.map((x) => Number(x));
        this.gameCode = gameCode;
        this.currentPlayerIndex = 0;
        this.gameState = { message: 'Generic Game Started' };
        this.history = [];
        this.baseBet = Number(options.baseBet || 10);
        this.playerBets = {};
        this.playerTotalSpent = {};
        this.playerStatus = {};
        this.pot = 0;
        this.gameOver = false;

        for (const pid of this.playerIds) {
            this.playerBets[pid] = this.baseBet;
            this.playerTotalSpent[pid] = this.baseBet;
            this.playerStatus[pid] = 'active';
            this.pot += this.baseBet;
        }
    }

    getCurrentPlayerId() {
        return this.playerIds[this.currentPlayerIndex];
    }

    // Generic action handler
    handleAction(playerId, action, data) {
        if (this.gameOver) throw new Error('游戏已结束');
        if (String(playerId) != String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
        if (this.playerStatus[playerId] !== 'active') throw new Error('玩家状态不允许操作');

        this.history.push({ playerId, action, data, time: Date.now() });
        this.gameState.lastAction = { playerId, action, data };

        // Simple turn passing
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;

        // Check generic end condition (e.g. "finish" action)
        if (action === 'finish' || action === 'win' || action === 'surrender') {
             return this.endGame(playerId);
        }

        return null;
    }
    
    // Fallback for poker-like calls if used
    bet(playerId, amount) { return this.handleAction(playerId, 'bet', { amount }); }
    check(playerId) { return this.handleAction(playerId, 'check', {}); }
    fold(playerId) { return this.handleAction(playerId, 'fold', {}); }

    endGame(winnerId) {
        this.gameOver = true;
        return {
            winnerId,
            type: 'generic_win',
            pot: this.pot,
            totalPot: this.pot,
            results: this.playerIds.map(pid => ({
                userId: pid,
                chipsChange: (pid == winnerId) ? this.pot : 0,
                totalSpent: this.playerTotalSpent[pid] || 0,
                position: (pid == winnerId) ? 1 : 2
            }))
        };
    }

    getGameState() {
        return {
            ...this.gameState,
            gameCode: this.gameCode,
            currentPlayer: this.getCurrentPlayerId(),
            history: this.history,
            pot: this.pot,
            baseBet: this.baseBet,
            playerBets: this.playerBets,
            playerStatus: this.playerStatus,
            gameOver: this.gameOver
        };
    }
}
