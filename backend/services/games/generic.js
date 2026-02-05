
export class GenericGame {
    constructor(playerIds, gameCode) {
        this.playerIds = playerIds;
        this.gameCode = gameCode;
        this.currentPlayerIndex = 0;
        this.gameState = { message: 'Generic Game Started' };
        this.history = [];
        this.playerBets = {};
        
        for (const pid of playerIds) {
            this.playerBets[pid] = 0;
        }
    }

    getCurrentPlayerId() {
        return this.playerIds[this.currentPlayerIndex];
    }

    // Generic action handler
    handleAction(playerId, action, data) {
        if (playerId != this.getCurrentPlayerId()) throw new Error('Not your turn');

        this.history.push({ playerId, action, data, time: Date.now() });
        this.gameState.lastAction = { playerId, action, data };

        // Simple turn passing
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;

        // Check generic end condition (e.g. "finish" action)
        if (action === 'finish' || action === 'win') {
             return this.endGame(playerId);
        }

        return null;
    }
    
    // Fallback for poker-like calls if used
    bet(playerId, amount) { return this.handleAction(playerId, 'bet', { amount }); }
    check(playerId) { return this.handleAction(playerId, 'check', {}); }
    fold(playerId) { return this.handleAction(playerId, 'fold', {}); }

    endGame(winnerId) {
        return {
            winnerId,
            type: 'generic_win',
            pot: 0,
            results: this.playerIds.map(pid => ({
                userId: pid,
                chipsChange: 0,
                position: (pid == winnerId) ? 1 : 2
            }))
        };
    }

    getGameState() {
        return {
            ...this.gameState,
            currentPlayer: this.getCurrentPlayerId(),
            history: this.history
        };
    }
}
