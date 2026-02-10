import { AbstractBoardGame } from './abstractBoard.js';

const INIT = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function isWhitePiece(p) {
  return typeof p === 'string' && p === p.toUpperCase();
}

function isBlackPiece(p) {
  return typeof p === 'string' && p === p.toLowerCase();
}

function colorOf(piece) {
  if (!piece) return null;
  return isWhitePiece(piece) ? 'white' : 'black';
}

function inside(x, y) {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

function sign(n) {
  return n === 0 ? 0 : n > 0 ? 1 : -1;
}

function pathClear(board, fx, fy, tx, ty) {
  const dx = sign(tx - fx);
  const dy = sign(ty - fy);
  let x = fx + dx;
  let y = fy + dy;
  while (x !== tx || y !== ty) {
    if (board[y][x]) return false;
    x += dx;
    y += dy;
  }
  return true;
}

function findKing(board, color) {
  const target = color === 'white' ? 'K' : 'k';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (board[y][x] === target) return { x, y };
    }
  }
  return null;
}

function attacksSquare(board, fx, fy, piece, tx, ty, state) {
  const color = colorOf(piece);
  const lower = String(piece).toLowerCase();
  const dx = tx - fx;
  const dy = ty - fy;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (lower === 'p') {
    const dir = color === 'white' ? -1 : 1;
    return dy === dir && adx === 1;
  }
  if (lower === 'n') {
    return (adx === 2 && ady === 1) || (adx === 1 && ady === 2);
  }
  if (lower === 'b') {
    return adx === ady && pathClear(board, fx, fy, tx, ty);
  }
  if (lower === 'r') {
    if (fx !== tx && fy !== ty) return false;
    return pathClear(board, fx, fy, tx, ty);
  }
  if (lower === 'q') {
    if (fx === tx || fy === ty) return pathClear(board, fx, fy, tx, ty);
    if (adx === ady) return pathClear(board, fx, fy, tx, ty);
    return false;
  }
  if (lower === 'k') {
    if (adx <= 1 && ady <= 1) return true;
    return false;
  }
  return false;
}

function isInCheck(board, color, state) {
  const king = findKing(board, color);
  if (!king) return true;
  const enemy = color === 'white' ? 'black' : 'white';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p) continue;
      if (colorOf(p) !== enemy) continue;
      if (attacksSquare(board, x, y, p, king.x, king.y, state)) return true;
    }
  }
  return false;
}

function materialScore(board, color) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let sum = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p) continue;
      if (colorOf(p) !== color) continue;
      sum += values[String(p).toLowerCase()] || 0;
    }
  }
  return sum;
}

function applyMove(board, move) {
  const b = cloneBoard(board);
  const piece = b[move.from.y][move.from.x];
  const captured = b[move.to.y][move.to.x];
  b[move.from.y][move.from.x] = null;
  b[move.to.y][move.to.x] = piece;
  return { board: b, captured };
}

function generateLegalMoves(board, color, state) {
  const moves = [];
  const dir = color === 'white' ? -1 : 1;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p || colorOf(p) !== color) continue;
      const lower = String(p).toLowerCase();

      const push = (tx, ty, special = null) => {
        if (!inside(tx, ty)) return;
        const t = board[ty][tx];
        if (t && colorOf(t) === color) return;
        moves.push({ from: { x, y }, to: { x: tx, y: ty }, special });
      };

      if (lower === 'p') {
        const ny = y + dir;
        if (inside(x, ny) && !board[ny][x]) push(x, ny);
        const startRow = color === 'white' ? 6 : 1;
        const ny2 = y + dir * 2;
        if (y === startRow && inside(x, ny2) && !board[ny][x] && !board[ny2][x]) push(x, ny2, { type: 'pawn_double' });
        for (const dx of [-1, 1]) {
          const cx = x + dx;
          const cy = y + dir;
          if (!inside(cx, cy)) continue;
          const target = board[cy][cx];
          if (target && colorOf(target) !== color) push(cx, cy);
          const ep = state?.enPassant;
          if (ep && ep.x === cx && ep.y === cy) push(cx, cy, { type: 'en_passant' });
        }
      } else if (lower === 'n') {
        const deltas = [
          [2, 1],
          [2, -1],
          [-2, 1],
          [-2, -1],
          [1, 2],
          [1, -2],
          [-1, 2],
          [-1, -2]
        ];
        for (const [dx, dy] of deltas) push(x + dx, y + dy);
      } else if (lower === 'b') {
        const dirs = [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1]
        ];
        for (const [dx, dy] of dirs) {
          for (let step = 1; step <= 7; step++) {
            const tx = x + dx * step;
            const ty = y + dy * step;
            if (!inside(tx, ty)) break;
            push(tx, ty);
            if (board[ty][tx]) break;
          }
        }
      } else if (lower === 'r' || lower === 'q') {
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ];
        for (const [dx, dy] of dirs) {
          for (let step = 1; step <= 7; step++) {
            const tx = x + dx * step;
            const ty = y + dy * step;
            if (!inside(tx, ty)) break;
            push(tx, ty);
            if (board[ty][tx]) break;
          }
        }
        if (lower === 'q') {
          const d2 = [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1]
          ];
          for (const [dx, dy] of d2) {
            for (let step = 1; step <= 7; step++) {
              const tx = x + dx * step;
              const ty = y + dy * step;
              if (!inside(tx, ty)) break;
              push(tx, ty);
              if (board[ty][tx]) break;
            }
          }
        }
      } else if (lower === 'k') {
        for (const dx of [-1, 0, 1]) {
          for (const dy of [-1, 0, 1]) {
            if (dx === 0 && dy === 0) continue;
            push(x + dx, y + dy);
          }
        }
        const homeY = color === 'white' ? 7 : 0;
        const homeX = 4;
        if (x === homeX && y === homeY && !isInCheck(board, color, state)) {
          const rights = state?.castlingRights || {};
          if ((color === 'white' ? rights.K : rights.k) && !board[homeY][5] && !board[homeY][6]) {
            if (!isSquareAttacked(board, { x: 5, y: homeY }, color, state) && !isSquareAttacked(board, { x: 6, y: homeY }, color, state)) {
              push(6, homeY, { type: 'castle_k' });
            }
          }
          if ((color === 'white' ? rights.Q : rights.q) && !board[homeY][3] && !board[homeY][2] && !board[homeY][1]) {
            if (!isSquareAttacked(board, { x: 3, y: homeY }, color, state) && !isSquareAttacked(board, { x: 2, y: homeY }, color, state)) {
              push(2, homeY, { type: 'castle_q' });
            }
          }
        }
      }
    }
  }

  const legal = [];
  for (const m of moves) {
    const b2 = cloneBoard(board);
    const piece = b2[m.from.y][m.from.x];
    const color = colorOf(piece);
    const lower = String(piece).toLowerCase();
    const special = m.special?.type;

    let captured = b2[m.to.y][m.to.x];
    b2[m.from.y][m.from.x] = null;

    if (special === 'en_passant') {
      const dir = color === 'white' ? -1 : 1;
      const cy = m.to.y - dir;
      captured = b2[cy][m.to.x];
      b2[cy][m.to.x] = null;
    }

    if (special === 'castle_k') {
      b2[m.to.y][m.to.x] = piece;
      const rookFromX = 7;
      const rookToX = 5;
      const rook = b2[m.to.y][rookFromX];
      b2[m.to.y][rookFromX] = null;
      b2[m.to.y][rookToX] = rook;
    } else if (special === 'castle_q') {
      b2[m.to.y][m.to.x] = piece;
      const rookFromX = 0;
      const rookToX = 3;
      const rook = b2[m.to.y][rookFromX];
      b2[m.to.y][rookFromX] = null;
      b2[m.to.y][rookToX] = rook;
    } else {
      b2[m.to.y][m.to.x] = piece;
    }

    if (lower === 'p' && (m.to.y === 0 || m.to.y === 7)) {
      b2[m.to.y][m.to.x] = color === 'white' ? 'Q' : 'q';
    }

    if (!isInCheck(b2, color, state)) legal.push(m);
  }
  return legal;
}

function isSquareAttacked(board, square, defenderColor, state) {
  const attacker = defenderColor === 'white' ? 'black' : 'white';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p) continue;
      if (colorOf(p) !== attacker) continue;
      if (attacksSquare(board, x, y, p, square.x, square.y, state)) return true;
    }
  }
  return false;
}

export class InternationalChessGame extends AbstractBoardGame {
  constructor(playerIds, options = {}) {
    super(playerIds, 'international_chess', { ...options, boardW: 8, boardH: 8, baseBet: options.baseBet || 10 });
    this.board = cloneBoard(INIT);
    this.whiteId = this.playerIds[0];
    this.blackId = this.playerIds[1];
    this.castlingRights = { K: true, Q: true, k: true, q: true };
    this.enPassant = null;
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
    if (fx < 0 || fx >= 8 || tx < 0 || tx >= 8 || fy < 0 || fy >= 8 || ty < 0 || ty >= 8) throw new Error('坐标越界');
    const piece = this.board[fy][fx];
    if (!piece) throw new Error('起点无棋子');
    if (String(playerId) !== String(this.getCurrentPlayerId())) throw new Error('不是你的回合');
    const turnColor = String(playerId) === String(this.whiteId) ? 'white' : 'black';
    if (colorOf(piece) !== turnColor) throw new Error('不能操作对方棋子');

    const target = this.board[ty][tx];
    if (target) {
      if (colorOf(target) === turnColor) throw new Error('不能吃己方棋子');
    }

    const state = { castlingRights: this.castlingRights, enPassant: this.enPassant };
    const legal = generateLegalMoves(this.board, turnColor, state).filter((m) => m.from.x === fx && m.from.y === fy && m.to.x === tx && m.to.y === ty);
    if (legal.length === 0) throw new Error('走法不合法');
    const chosen = legal[0];
    const special = chosen.special?.type;

    const next = cloneBoard(this.board);
    const moving = next[fy][fx];
    let captured = next[ty][tx];
    next[fy][fx] = null;

    if (special === 'en_passant') {
      const dir = turnColor === 'white' ? -1 : 1;
      const cy = ty - dir;
      captured = next[cy][tx];
      next[cy][tx] = null;
    }

    next[ty][tx] = moving;

    if (special === 'castle_k') {
      const rook = next[ty][7];
      next[ty][7] = null;
      next[ty][5] = rook;
    } else if (special === 'castle_q') {
      const rook = next[ty][0];
      next[ty][0] = null;
      next[ty][3] = rook;
    }

    const lower = String(moving).toLowerCase();
    if (lower === 'p' && (ty === 0 || ty === 7)) {
      next[ty][tx] = turnColor === 'white' ? 'Q' : 'q';
    }

    if (isInCheck(next, turnColor, state)) throw new Error('不能送将');

    this.board = next;
    this.moveHistory.push({ playerId, from: { x: fx, y: fy }, to: { x: tx, y: ty }, captured, special });

    this.enPassant = null;
    if (special === 'pawn_double') {
      const dir = turnColor === 'white' ? -1 : 1;
      this.enPassant = { x: fx, y: fy + dir };
    }

    if (lower === 'k') {
      if (turnColor === 'white') {
        this.castlingRights.K = false;
        this.castlingRights.Q = false;
      } else {
        this.castlingRights.k = false;
        this.castlingRights.q = false;
      }
    }
    if (lower === 'r') {
      if (turnColor === 'white' && fy === 7 && fx === 0) this.castlingRights.Q = false;
      if (turnColor === 'white' && fy === 7 && fx === 7) this.castlingRights.K = false;
      if (turnColor === 'black' && fy === 0 && fx === 0) this.castlingRights.q = false;
      if (turnColor === 'black' && fy === 0 && fx === 7) this.castlingRights.k = false;
    }
    if (captured && String(captured).toLowerCase() === 'r') {
      const capColor = colorOf(captured);
      if (capColor === 'white' && ty === 7 && tx === 0) this.castlingRights.Q = false;
      if (capColor === 'white' && ty === 7 && tx === 7) this.castlingRights.K = false;
      if (capColor === 'black' && ty === 0 && tx === 0) this.castlingRights.q = false;
      if (capColor === 'black' && ty === 0 && tx === 7) this.castlingRights.k = false;
    }

    const enemy = turnColor === 'white' ? 'black' : 'white';
    const enemyState = { castlingRights: this.castlingRights, enPassant: this.enPassant };
    const enemyLegal = generateLegalMoves(this.board, enemy, enemyState);
    const enemyInCheck = isInCheck(this.board, enemy, enemyState);

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;

    if (captured && String(captured).toLowerCase() === 'k') {
      return this.endGame(playerId, 'capture_king');
    }

    if (enemyLegal.length === 0) {
      if (enemyInCheck) return this.endGame(playerId, 'checkmate');
      const wScore = materialScore(this.board, 'white');
      const bScore = materialScore(this.board, 'black');
      const winnerId = wScore === bScore ? playerId : (wScore > bScore ? this.whiteId : this.blackId);
      return this.endGame(winnerId, 'draw');
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
    const state = { castlingRights: this.castlingRights, enPassant: this.enPassant };
    return {
      ...base,
      whiteId: this.whiteId,
      blackId: this.blackId,
      castlingRights: this.castlingRights,
      enPassant: this.enPassant,
      inCheck: {
        white: isInCheck(this.board, 'white', state),
        black: isInCheck(this.board, 'black', state)
      },
      moveCount: this.moveHistory.length
    };
  }
}
