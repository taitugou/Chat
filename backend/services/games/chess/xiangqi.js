import { AbstractBoardGame } from './abstractBoard.js';

const INIT = [
  ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'],
  [null, null, null, null, null, null, null, null, null],
  [null, 'c', null, null, null, null, null, 'c', null],
  ['p', null, 'p', null, 'p', null, 'p', null, 'p'],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ['P', null, 'P', null, 'P', null, 'P', null, 'P'],
  [null, 'C', null, null, null, null, null, 'C', null],
  [null, null, null, null, null, null, null, null, null],
  ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'],
];

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function isInside(x, y) {
  return x >= 0 && x < 9 && y >= 0 && y < 10;
}

function isRedPiece(p) {
  return typeof p === 'string' && p === p.toUpperCase();
}

function isBlackPiece(p) {
  return typeof p === 'string' && p === p.toLowerCase();
}

function colorOf(piece) {
  if (!piece) return null;
  return isRedPiece(piece) ? 'red' : 'black';
}

function palaceContains(color, x, y) {
  if (color === 'red') return x >= 3 && x <= 5 && y >= 7 && y <= 9;
  return x >= 3 && x <= 5 && y >= 0 && y <= 2;
}

function crossedRiver(color, y) {
  if (color === 'red') return y <= 4;
  return y >= 5;
}

function countBetweenStraight(board, fx, fy, tx, ty) {
  if (fx !== tx && fy !== ty) return null;
  let count = 0;
  if (fx === tx) {
    const dy = ty > fy ? 1 : -1;
    for (let y = fy + dy; y !== ty; y += dy) if (board[y][fx]) count += 1;
  } else {
    const dx = tx > fx ? 1 : -1;
    for (let x = fx + dx; x !== tx; x += dx) if (board[fy][x]) count += 1;
  }
  return count;
}

function findKing(board, color) {
  const target = color === 'red' ? 'K' : 'k';
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      if (board[y][x] === target) return { x, y };
    }
  }
  return null;
}

function generalsFacing(board) {
  const rk = findKing(board, 'red');
  const bk = findKing(board, 'black');
  if (!rk || !bk) return false;
  if (rk.x !== bk.x) return false;
  const x = rk.x;
  const dy = bk.y > rk.y ? 1 : -1;
  for (let y = rk.y + dy; y !== bk.y; y += dy) {
    if (board[y][x]) return false;
  }
  return true;
}

function attacksSquare(board, fx, fy, piece, tx, ty) {
  const color = colorOf(piece);
  const lower = String(piece).toLowerCase();
  const dx = tx - fx;
  const dy = ty - fy;

  if (lower === 'k') {
    if (!palaceContains(color, tx, ty)) return false;
    return (Math.abs(dx) + Math.abs(dy)) === 1;
  }
  if (lower === 'a') {
    if (!palaceContains(color, tx, ty)) return false;
    return Math.abs(dx) === 1 && Math.abs(dy) === 1;
  }
  if (lower === 'b') {
    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) return false;
    if (color === 'red' && ty <= 4) return false;
    if (color === 'black' && ty >= 5) return false;
    const bx = fx + dx / 2;
    const by = fy + dy / 2;
    return !board[by][bx];
  }
  if (lower === 'n') {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (!((adx === 2 && ady === 1) || (adx === 1 && ady === 2))) return false;
    const legX = fx + (adx === 2 ? dx / 2 : 0);
    const legY = fy + (ady === 2 ? dy / 2 : 0);
    return !board[legY][legX];
  }
  if (lower === 'r') {
    const between = countBetweenStraight(board, fx, fy, tx, ty);
    return between !== null && between === 0;
  }
  if (lower === 'c') {
    const between = countBetweenStraight(board, fx, fy, tx, ty);
    if (between === null) return false;
    const target = board[ty][tx];
    if (!target) return between === 0;
    return between === 1;
  }
  if (lower === 'p') {
    if (color === 'red') {
      if (dy === -1 && dx === 0) return true;
      if (crossedRiver(color, fy) && dy === 0 && Math.abs(dx) === 1) return true;
      return false;
    }
    if (dy === 1 && dx === 0) return true;
    if (crossedRiver(color, fy) && dy === 0 && Math.abs(dx) === 1) return true;
    return false;
  }
  return false;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return true;
  const enemy = color === 'red' ? 'black' : 'red';
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (!p) continue;
      if (colorOf(p) !== enemy) continue;
      if (attacksSquare(board, x, y, p, king.x, king.y)) return true;
    }
  }
  if (generalsFacing(board)) return true;
  return false;
}

function generatePseudoMoves(board, color) {
  const moves = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (!p) continue;
      if (colorOf(p) !== color) continue;
      const lower = String(p).toLowerCase();

      const push = (tx, ty) => {
        if (!isInside(tx, ty)) return;
        const t = board[ty][tx];
        if (t && colorOf(t) === color) return;
        if (attacksSquare(board, x, y, p, tx, ty)) moves.push({ from: { x, y }, to: { x: tx, y: ty } });
      };

      if (lower === 'k') {
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
      } else if (lower === 'a') {
        push(x + 1, y + 1);
        push(x + 1, y - 1);
        push(x - 1, y + 1);
        push(x - 1, y - 1);
      } else if (lower === 'b') {
        push(x + 2, y + 2);
        push(x + 2, y - 2);
        push(x - 2, y + 2);
        push(x - 2, y - 2);
      } else if (lower === 'n') {
        push(x + 2, y + 1);
        push(x + 2, y - 1);
        push(x - 2, y + 1);
        push(x - 2, y - 1);
        push(x + 1, y + 2);
        push(x - 1, y + 2);
        push(x + 1, y - 2);
        push(x - 1, y - 2);
      } else if (lower === 'r' || lower === 'c') {
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ];
        for (const [dx, dy] of dirs) {
          for (let step = 1; step <= 9; step++) {
            const tx = x + dx * step;
            const ty = y + dy * step;
            if (!isInside(tx, ty)) break;
            push(tx, ty);
            if (board[ty][tx]) break;
          }
        }
      } else if (lower === 'p') {
        if (color === 'red') {
          push(x, y - 1);
          if (crossedRiver(color, y)) {
            push(x + 1, y);
            push(x - 1, y);
          }
        } else {
          push(x, y + 1);
          if (crossedRiver(color, y)) {
            push(x + 1, y);
            push(x - 1, y);
          }
        }
      }
    }
  }
  return moves;
}

function applyMoveToBoard(board, from, to) {
  const b = cloneBoard(board);
  const piece = b[from.y][from.x];
  const target = b[to.y][to.x];
  b[from.y][from.x] = null;
  b[to.y][to.x] = piece;
  return { board: b, captured: target };
}

export class XiangqiGame extends AbstractBoardGame {
  constructor(playerIds, options = {}) {
    super(playerIds, 'xiangqi', { ...options, boardW: 9, boardH: 10, baseBet: options.baseBet || 10 });

    this.board = cloneBoard(INIT);
    this.redId = this.playerIds[0];
    this.blackId = this.playerIds[1];
    this.moveHistory = [];

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
  }

  move(playerId, from, to) {
    if (this.gameOver) throw new Error('游戏已结束');
    const fx = Number(from?.x), fy = Number(from?.y), tx = Number(to?.x), ty = Number(to?.y);
    if (![fx, fy, tx, ty].every(Number.isInteger)) throw new Error('坐标不合法');
    if (fx < 0 || fx >= 9 || tx < 0 || tx >= 9 || fy < 0 || fy >= 10 || ty < 0 || ty >= 10) throw new Error('坐标越界');
    const piece = this.board[fy][fx];
    if (!piece) throw new Error('起点无棋子');
    const turnColor = String(playerId) === String(this.redId) ? 'red' : 'black';
    if (String(playerId) !== String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
    if (colorOf(piece) !== turnColor) throw new Error('不能操作对方棋子');

    const target = this.board[ty][tx];
    if (target) {
      if (colorOf(target) === turnColor) throw new Error('不能吃己方棋子');
    }

    if (!attacksSquare(this.board, fx, fy, piece, tx, ty)) throw new Error('走法不合法');

    const { board: nextBoard, captured } = applyMoveToBoard(this.board, { x: fx, y: fy }, { x: tx, y: ty });
    if (generalsFacing(nextBoard)) throw new Error('将帅不能照面');
    if (isInCheck(nextBoard, turnColor)) throw new Error('不能送将');

    this.board = nextBoard;
    this.moveHistory.push({ playerId, from: { x: fx, y: fy }, to: { x: tx, y: ty }, captured });

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    const enemyColor = turnColor === 'red' ? 'black' : 'red';
    const enemyInCheck = isInCheck(this.board, enemyColor);
    if (captured && String(captured).toLowerCase() === 'k') {
      return this.endGame(playerId, 'capture_king');
    }

    if (enemyInCheck) {
      const enemyMoves = generatePseudoMoves(this.board, enemyColor);
      let hasLegal = false;
      for (const m of enemyMoves) {
        const p = this.board[m.from.y][m.from.x];
        if (!p) continue;
        const { board: b2 } = applyMoveToBoard(this.board, m.from, m.to);
        if (generalsFacing(b2)) continue;
        if (!isInCheck(b2, enemyColor)) {
          hasLegal = true;
          break;
        }
      }
      if (!hasLegal) return this.endGame(playerId, 'checkmate');
    }

    return null;
  }

  handleAction(playerId, action, payload) {
    if (action === 'move') return this.move(playerId, payload?.from, payload?.to);
    if (action === 'surrender') return this.surrender(playerId);
    throw new Error('未知操作');
  }

  getGameState() {
    const base = super.getGameState();
    return {
      ...base,
      redId: this.redId,
      blackId: this.blackId,
      inCheck: {
        red: isInCheck(this.board, 'red'),
        black: isInCheck(this.board, 'black')
      },
      moveCount: this.moveHistory.length
    };
  }
}
