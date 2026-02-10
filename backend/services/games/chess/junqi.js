import { AbstractBoardGame } from './abstractBoard.js';

function emptyBoard(w, h) {
  const b = new Array(h);
  for (let y = 0; y < h; y++) b[y] = new Array(w).fill(null);
  return b;
}

function isRedPiece(p) {
  return typeof p === 'string' && p === p.toUpperCase();
}

function isBlackPiece(p) {
  return typeof p === 'string' && p === p.toLowerCase();
}

function colorOf(p) {
  if (!p) return null;
  return isRedPiece(p) ? 'red' : 'black';
}

function normalizePieceCode(code, color) {
  const c = String(code || '').trim();
  if (!c) return null;
  const upper = c.toUpperCase();
  if (/^[2-9]$/.test(upper)) {
    return color === 'red' ? `R${upper}` : `r${upper}`;
  }
  return color === 'red' ? upper : upper.toLowerCase();
}

function rankOf(piece) {
  const p0 = String(piece);
  const p = p0.toLowerCase();
  if (p === 'f') return { type: 'flag', rank: 0, movable: false };
  if (p === 'm') return { type: 'mine', rank: 0, movable: false };
  if (p === 'b') return { type: 'bomb', rank: 99, movable: true };
  if (p === 'e') return { type: 'engineer', rank: 1, movable: true };
  if (p.length === 2 && (p[0] === 'r') && /^[2-9]$/.test(p[1])) {
    return { type: 'soldier', rank: Number(p[1]), movable: true };
  }
  return { type: 'unknown', rank: 0, movable: false };
}

function inHalf(color, y) {
  return color === 'black' ? y >= 0 && y <= 5 : y >= 6 && y <= 11;
}

function cloneBoard(b) {
  return b.map((r) => r.slice());
}

export class JunqiGame extends AbstractBoardGame {
  constructor(playerIds, options = {}) {
    super(playerIds, 'junqi', { ...options, boardW: 5, boardH: 12, baseBet: options.baseBet || 10 });
    this.redId = this.playerIds[0];
    this.blackId = this.playerIds[1];
    this.phase = 'setup';
    this.ready = { red: false, black: false };
    this.autoSetup = options.autoSetup !== false;
    this.requiredPieces = ['F', 'B', 'B', 'M', 'M', 'M', 'E', '9', '8', '7', '6', '5', '4', '3', '2'];

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
    if (this.autoSetup) {
      this.applyDefaultSetup();
    }
  }

  applyDefaultSetup() {
    this.board = emptyBoard(this.boardW, this.boardH);
    const placeRow = (y, pieces, color) => {
      let i = 0;
      for (let x = 0; x < this.boardW; x++) {
        if (i >= pieces.length) break;
        this.board[y][x] = normalizePieceCode(pieces[i], color);
        i += 1;
      }
    };
    const redPiecesTop = ['M', 'E', '7', 'M', '6'];
    const redPiecesBottom = ['4', 'F', 'B', 'B', '5'];
    const blackPiecesTop = ['4', 'f', 'b', 'b', '5'];
    const blackPiecesBottom = ['m', 'e', '7', 'm', '6'];

    placeRow(11, redPiecesBottom, 'red');
    placeRow(10, redPiecesTop, 'red');
    placeRow(0, blackPiecesTop, 'black');
    placeRow(1, blackPiecesBottom, 'black');

    this.ready = { red: true, black: true };
    this.phase = 'playing';
    this.currentPlayerIndex = 0;
  }

  setup(playerId, placements) {
    if (this.gameOver) throw new Error('游戏已结束');
    if (this.phase !== 'setup') throw new Error('当前不在布阵阶段');
    const color = String(playerId) === String(this.redId) ? 'red' : 'black';
    const isRed = color === 'red';
    const list = Array.isArray(placements) ? placements : [];
    if (list.length !== this.requiredPieces.length) throw new Error('布阵数量不正确');

    const expected = new Map();
    for (const p of this.requiredPieces) expected.set(String(p).toUpperCase(), (expected.get(String(p).toUpperCase()) || 0) + 1);

    const seenPos = new Set();
    const temp = cloneBoard(this.board);
    for (let y = 0; y < this.boardH; y++) {
      for (let x = 0; x < this.boardW; x++) {
        const cell = temp[y][x];
        if (!cell) continue;
        if (colorOf(cell) === color) temp[y][x] = null;
      }
    }

    for (const it of list) {
      const x = Number(it?.x), y = Number(it?.y);
      const code = String(it?.piece || '').trim();
      if (![x, y].every(Number.isInteger)) throw new Error('坐标不合法');
      if (x < 0 || x >= this.boardW || y < 0 || y >= this.boardH) throw new Error('坐标越界');
      if (!inHalf(isRed ? 'red' : 'black', y)) throw new Error('布阵必须在己方区域');
      const key = `${x},${y}`;
      if (seenPos.has(key)) throw new Error('布阵位置重复');
      seenPos.add(key);

      const upper = code.toUpperCase();
      if (!expected.has(upper) || expected.get(upper) <= 0) throw new Error('布阵棋子不合法');
      expected.set(upper, expected.get(upper) - 1);

      if (temp[y][x]) throw new Error('布阵位置已占用');
      temp[y][x] = normalizePieceCode(upper, color);
    }

    for (const v of expected.values()) if (v !== 0) throw new Error('布阵棋子数量不匹配');

    this.board = temp;
    this.ready[color] = true;
    if (this.ready.red && this.ready.black) {
      this.phase = 'playing';
      this.currentPlayerIndex = 0;
    }
    return null;
  }

  move(playerId, from, to) {
    this.validateTurn(playerId);
    if (this.phase !== 'playing') throw new Error('当前不在行棋阶段');
    const fx = Number(from?.x), fy = Number(from?.y), tx = Number(to?.x), ty = Number(to?.y);
    if (![fx, fy, tx, ty].every(Number.isInteger)) throw new Error('坐标不合法');
    if (fx < 0 || fx >= this.boardW || tx < 0 || tx >= this.boardW || fy < 0 || fy >= this.boardH || ty < 0 || ty >= this.boardH) throw new Error('坐标越界');

    const piece = this.board[fy][fx];
    if (!piece) throw new Error('起点无棋子');
    const isRedTurn = String(playerId) === String(this.redId);
    const isRedPiece = String(piece) === String(piece).toUpperCase();
    if (isRedTurn !== isRedPiece) throw new Error('不能操作对方棋子');
    const info = rankOf(piece);
    if (!info.movable) throw new Error('该棋子不可移动');
    const manhattan = Math.abs(tx - fx) + Math.abs(ty - fy);
    if (manhattan !== 1) throw new Error('一次只能移动一格');

    const target = this.board[ty][tx];
    if (target) {
      const targetRed = String(target) === String(target).toUpperCase();
      if (targetRed === isRedTurn) throw new Error('不能吃己方棋子');
    }

    let attackerSurvives = true;
    let defenderSurvives = false;
    let captureFlag = false;
    if (target) {
      const defInfo = rankOf(target);
      if (defInfo.type === 'flag') {
        captureFlag = true;
      } else if (info.type === 'bomb' || defInfo.type === 'bomb') {
        attackerSurvives = false;
        defenderSurvives = false;
      } else if (defInfo.type === 'mine') {
        if (info.type === 'engineer') {
          attackerSurvives = true;
          defenderSurvives = false;
        } else {
          attackerSurvives = false;
          defenderSurvives = true;
        }
      } else {
        if (info.rank > defInfo.rank) {
          attackerSurvives = true;
          defenderSurvives = false;
        } else if (info.rank < defInfo.rank) {
          attackerSurvives = false;
          defenderSurvives = true;
        } else {
          attackerSurvives = false;
          defenderSurvives = false;
        }
      }
    }

    this.board[fy][fx] = null;
    if (!target) {
      this.board[ty][tx] = piece;
    } else if (captureFlag) {
      this.board[ty][tx] = piece;
    } else {
      if (attackerSurvives) this.board[ty][tx] = piece;
      else if (defenderSurvives) this.board[ty][tx] = target;
      else this.board[ty][tx] = null;
    }

    if (captureFlag) {
      return this.endGame(playerId, 'capture_flag');
    }

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    return null;
  }

  handleAction(playerId, action, payload) {
    if (action === 'setup') return this.setup(playerId, payload?.placements);
    if (action === 'move') return this.move(playerId, payload?.from, payload?.to);
    if (action === 'surrender') return this.surrender(playerId);
    throw new Error('未知操作');
  }

  getGameState() {
    const base = super.getGameState();
    return {
      ...base,
      phase: this.phase,
      redId: this.redId,
      blackId: this.blackId,
      ready: this.ready
    };
  }
}
