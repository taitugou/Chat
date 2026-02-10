import { AbstractBoardGame } from './abstractBoard.js';

function emptyBoard(w, h) {
  const b = new Array(h);
  for (let y = 0; y < h; y++) b[y] = new Array(w).fill(0);
  return b;
}

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function boardHash(b) {
  return b.map((r) => r.join('')).join('|');
}

function neighbors(x, y, w, h) {
  const out = [];
  if (x > 0) out.push([x - 1, y]);
  if (x + 1 < w) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y + 1 < h) out.push([x, y + 1]);
  return out;
}

function collectGroup(board, x, y) {
  const w = board[0].length;
  const h = board.length;
  const color = board[y][x];
  const q = [[x, y]];
  const seen = new Set([`${x},${y}`]);
  const stones = [];
  let liberties = 0;

  while (q.length) {
    const [cx, cy] = q.pop();
    stones.push([cx, cy]);
    for (const [nx, ny] of neighbors(cx, cy, w, h)) {
      const v = board[ny][nx];
      if (v === 0) {
        liberties += 1;
        continue;
      }
      if (v !== color) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      q.push([nx, ny]);
    }
  }

  return { color, stones, liberties };
}

function removeStones(board, stones) {
  for (const [x, y] of stones) board[y][x] = 0;
}

export class WeiqiGame extends AbstractBoardGame {
  constructor(playerIds, options = {}) {
    super(playerIds, 'weiqi', { ...options, boardW: options.boardW || 19, boardH: options.boardH || 19, baseBet: options.baseBet || 10 });
    this.blackId = this.playerIds[0];
    this.whiteId = this.playerIds[1];
    this.komi = Number.isFinite(Number(options.komi)) ? Number(options.komi) : 6.5;
    this.passCount = 0;
    this.captureCount = { black: 0, white: 0 };
    this.prevHash = null;
    this.currHash = null;
    this.lastMove = null;

    this.playerBets = {};
    this.playerTotalSpent = {};
    this.playerStatus = {};
    this.pot = 0;
    for (const pid of this.playerIds) {
      this.playerBets[pid] = this.baseBet;
      this.playerTotalSpent[pid] = this.baseBet;
      this.playerStatus[pid] = 'active';
      this.pot += this.baseBet;
    }

    this.board = emptyBoard(this.boardW, this.boardH);
    this.currHash = boardHash(this.board);
  }

  place(playerId, x, y) {
    this.validateTurn(playerId);
    const px = Number(x), py = Number(y);
    if (![px, py].every(Number.isInteger)) throw new Error('坐标不合法');
    if (px < 0 || px >= this.boardW || py < 0 || py >= this.boardH) throw new Error('坐标越界');
    if (this.board[py][px] !== 0) throw new Error('该位置已有棋子');
    const isBlack = String(playerId) === String(this.blackId);
    const stone = isBlack ? 1 : 2;
    const myColor = isBlack ? 'black' : 'white';
    const enemyStone = isBlack ? 2 : 1;

    const before = cloneBoard(this.board);
    const beforeHash = this.currHash;
    const next = cloneBoard(this.board);
    next[py][px] = stone;

    let capturedTotal = 0;
    for (const [nx, ny] of neighbors(px, py, this.boardW, this.boardH)) {
      if (next[ny][nx] !== enemyStone) continue;
      const g = collectGroup(next, nx, ny);
      if (g.liberties === 0) {
        removeStones(next, g.stones);
        capturedTotal += g.stones.length;
      }
    }

    const myGroup = collectGroup(next, px, py);
    if (myGroup.liberties === 0 && capturedTotal === 0) throw new Error('禁入点（自杀）');

    const newHash = boardHash(next);
    if (this.prevHash && newHash === this.prevHash) throw new Error('劫（ko）');

    this.board = next;
    this.prevHash = beforeHash;
    this.currHash = newHash;
    this.passCount = 0;
    this.captureCount[myColor] += capturedTotal;
    this.lastMove = { type: 'place', playerId, x: px, y: py, captured: capturedTotal };

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    return null;
  }

  pass(playerId) {
    this.validateTurn(playerId);
    this.passCount += 1;
    this.lastMove = { type: 'pass', playerId };
    if (this.passCount >= 2) return this.settle('two_pass');
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    return null;
  }

  settle(reason) {
    if (this.gameOver) throw new Error('游戏已结束');
    let blackStones = 0;
    let whiteStones = 0;
    for (let y = 0; y < this.boardH; y++) {
      for (let x = 0; x < this.boardW; x++) {
        if (this.board[y][x] === 1) blackStones += 1;
        else if (this.board[y][x] === 2) whiteStones += 1;
      }
    }
    const blackScore = blackStones + Number(this.captureCount.black || 0);
    const whiteScore = whiteStones + Number(this.captureCount.white || 0) + this.komi;
    const winnerId = blackScore > whiteScore ? this.blackId : this.whiteId;
    return this.endGame(winnerId, reason || 'settle');
  }

  handleAction(playerId, action, payload) {
    if (action === 'place') return this.place(playerId, payload?.x, payload?.y);
    if (action === 'pass') return this.pass(playerId);
    if (action === 'settle') return this.settle('manual_settle');
    if (action === 'surrender') return this.surrender(playerId);
    throw new Error('未知操作');
  }

  getGameState() {
    const base = super.getGameState();
    return {
      ...base,
      blackId: this.blackId,
      whiteId: this.whiteId,
      komi: this.komi,
      passCount: this.passCount,
      captureCount: this.captureCount,
      lastMove: this.lastMove
    };
  }
}
