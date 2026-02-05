
export class GomokuGame {
    constructor(playerIds) {
        this.playerIds = playerIds; // Expect 2 players
        this.boardSize = 15;
        this.board = []; // 15x15 grid
        this.currentPlayerIndex = 0; // 0 = Black, 1 = White
        this.gameOver = false;
        this.winner = null;
        this.playerBets = {}; // For initial buy-in
        this.playerStatus = {};
        
        this.initializeGame();
    }

    initializeGame() {
        // Init empty board
        this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(0));
        this.currentPlayerIndex = 0;
        this.gameOver = false;
        this.winner = null;
        this.playerBets = {};
        this.playerTotalSpent = {};
        this.playerStatus = {};
        
        for (const pid of this.playerIds) {
            this.playerBets[pid] = 100; // Fixed buy-in
            this.playerTotalSpent[pid] = 100;
            this.playerStatus[pid] = 'active';
        }
    }

    getCurrentPlayerId() {
        return this.playerIds[this.currentPlayerIndex];
    }
    
    validateTurn(playerId) {
        if (this.gameOver) throw new Error('游戏已结束');
        if (String(playerId) !== String(this.getCurrentPlayerId())) {
            throw new Error(`不是你的回合 (当前: ${this.getCurrentPlayerId()}, 你: ${playerId})`);
        }
    }

    // Action: { x, y }
    bet(playerId, payload) { 
        return this.playMove(playerId, payload.x, payload.y);
    }

    // Generic handler
    handleAction(playerId, action, data) {
        if (action === 'move') {
            return this.playMove(playerId, data.x, data.y);
        }
        if (action === 'surrender') {
             const winnerId = this.playerIds.find(id => String(id) !== String(playerId));
             return this.endGame(winnerId);
        }
        throw new Error('未知操作');
    }

    playMove(playerId, x, y) {
        this.validateTurn(playerId);
        
        const ix = parseInt(x);
        const iy = parseInt(y);

        if (isNaN(ix) || isNaN(iy)) throw new Error('无效的坐标');
        if (ix < 0 || ix >= this.boardSize || iy < 0 || iy >= this.boardSize) throw new Error('坐标越界');
        if (this.board[iy][ix] !== 0) throw new Error('该位置已有棋子');

        const piece = this.currentPlayerIndex === 0 ? 1 : 2; // 1=Black, 2=White
        this.board[iy][ix] = piece;

        if (this.checkWin(ix, iy, piece)) {
            return this.endGame(playerId);
        }

        // Switch turn
        this.currentPlayerIndex = 1 - this.currentPlayerIndex;
        return null;
    }

    checkWin(x, y, piece) {
        const directions = [
            [[1, 0], [-1, 0]], // Horizontal
            [[0, 1], [0, -1]], // Vertical
            [[1, 1], [-1, -1]], // Diagonal \
            [[1, -1], [-1, 1]]  // Diagonal /
        ];

        for (const dir of directions) {
            let count = 1;
            for (const delta of dir) {
                let dx = delta[0];
                let dy = delta[1];
                let nx = x + dx;
                let ny = y + dy;
                while (nx >= 0 && nx < this.boardSize && ny >= 0 && ny < this.boardSize && this.board[ny][nx] === piece) {
                    count++;
                    nx += dx;
                    ny += dy;
                }
            }
            if (count >= 5) return true;
        }
        return false;
    }

    endGame(winnerId) {
        this.gameOver = true;
        const totalPot = Object.values(this.playerBets).reduce((a, b) => a + b, 0);
        return {
            winnerId,
            type: 'gomoku_win',
            totalPot, 
            pot: totalPot,
            results: this.playerIds.map(pid => ({
                userId: pid,
                chipsChange: (pid == winnerId) ? totalPot : 0, // Amount to AWARD
                totalSpent: this.playerTotalSpent[pid] || 0,
                position: (pid == winnerId) ? 1 : 2
            }))
        };
    }

    getGameState() {
        return {
            board: this.board,
            currentPlayer: this.getCurrentPlayerId(),
            gameOver: this.gameOver
        };
    }
}
