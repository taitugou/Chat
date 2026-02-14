import { query, transaction } from '../database/connection.js';
import { logGameError } from './errorMonitorService.js';

export class GameBoundaryValidator {
  constructor() {
    this.validationRules = new Map();
    this.boundaryChecks = new Map();
    this.gameTypeValidators = new Map();
    this.initializeValidators();
  }

  initializeValidators() {
    this.registerGameValidator('zhajinhua', this.validateZhajinhua.bind(this));
    this.registerGameValidator('texas_holdem', this.validateTexasHoldem.bind(this));
    this.registerGameValidator('doudizhu', this.validateDoudizhu.bind(this));
    this.registerGameValidator('paodekuai', this.validatePaodekuai.bind(this));
    this.registerGameValidator('blackjack', this.validateBlackjack.bind(this));
    this.registerGameValidator('niuniu', this.validateNiuniu.bind(this));
    this.registerGameValidator('shengji', this.validateShengji.bind(this));
    this.registerGameValidator('touzi_bao', this.validateTouziBao.bind(this));
    this.registerGameValidator('erbaban', this.validateErbaban.bind(this));
    this.registerGameValidator('weiqi', this.validateWeiqi.bind(this));
    this.registerGameValidator('xiangqi', this.validateXiangqi.bind(this));
    this.registerGameValidator('wuziqi', this.validateWuziqi.bind(this));
    this.registerGameValidator('international_chess', this.validateInternationalChess.bind(this));
    this.registerGameValidator('junqi', this.validateJunqi.bind(this));
    this.registerGameValidator('sichuan_mahjong', this.validateSichuanMahjong.bind(this));
    this.registerGameValidator('guangdong_mahjong', this.validateGuangdongMahjong.bind(this));
    this.registerGameValidator('guobiao_mahjong', this.validateGuobiaoMahjong.bind(this));
    this.registerGameValidator('ren_mahjong', this.validateRenMahjong.bind(this));
  }

  registerGameValidator(gameType, validatorFn) {
    this.gameTypeValidators.set(gameType, validatorFn);
  }

  async validateGameAction(gameType, action, state, payload) {
    const validator = this.gameTypeValidators.get(gameType);
    if (!validator) {
      return { valid: true, warnings: [`未找到游戏类型 ${gameType} 的验证器`] };
    }

    try {
      const result = await validator(action, state, payload);
      return result;
    } catch (error) {
      logGameError(error, {
        gameType,
        action,
        validationFailed: true
      });

      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  async validateZhajinhua(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'bet' || action === 'raise') {
      if (!payload.amount || payload.amount <= 0) {
        errors.push('下注金额必须大于0');
      }
      const maxRaise = state.pot * 3;
      if (payload.amount > maxRaise) {
        errors.push(`加注金额不能超过底池的3倍 (${maxRaise})`);
      }
    }

    if (action === 'compare') {
      if (!payload.targetId) {
        errors.push('比牌需要指定目标玩家');
      }
      if (state.compareCount >= 3) {
        errors.push('本局比牌次数已达上限');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateTexasHoldem(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'bet' || action === 'raise') {
      const currentBet = state.currentBet || 0;
      const myBet = state.playerBets?.[payload.userId] || 0;
      const toCall = currentBet - myBet;

      if (action === 'raise') {
        if (!payload.amount || payload.amount <= 0) {
          errors.push('加注金额必须大于0');
        }
        const minRaise = toCall * 2;
        if (payload.amount < minRaise) {
          errors.push(`加注必须至少达到最小加注额 (${minRaise})`);
        }
      }

      const stage = state.stage || 0;
      const maxBet = stage === 0 ? 20 : (stage === 1 ? 40 : 80);
      if (payload.amount > maxBet) {
        warnings.push(`下注金额 ${payload.amount} 超过建议最大值 ${maxBet}`);
      }
    }

    if (action === 'all_in') {
      if (state.allInPlayers?.length >= state.playerIds?.length - 1) {
        errors.push('已达到最大all-in玩家数');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateDoudizhu(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'play') {
      if (!payload.cardIds || !Array.isArray(payload.cardIds) || payload.cardIds.length === 0) {
        errors.push('出牌需要指定牌ID列表');
      }

      if (state.lastPlayedCards?.length > 0) {
        const lastCombo = analyzeCardCombo(state.lastPlayedCards);
        const currentCombo = analyzeCardCombo(payload.cardIds);

        if (!canBeat(lastCombo, currentCombo)) {
          errors.push('出的牌不能打过上家的牌');
        }
      }
    }

    if (action === 'bid') {
      if (payload.points < 0 || payload.points > 3) {
        errors.push('叫分必须在0-3之间');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validatePaodekuai(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'play') {
      if (!payload.cardIds || payload.cardIds.length === 0) {
        errors.push('出牌需要指定牌ID');
      }

      if (state.lastPlayedCards?.length > 0) {
        const lastCombo = analyzeCardCombo(state.lastPlayedCards);
        const currentCombo = analyzeCardCombo(payload.cardIds);

        if (!canBeat(lastCombo, currentCombo)) {
          errors.push('必须出比上家大的牌或不出');
        }
      }
    }

    if (action === 'pass') {
      if (state.passCount >= state.activePlayers - 1) {
        errors.push('所有玩家都已过牌，不能再过');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateBlackjack(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'hit') {
      if (state.playerHand?.length >= 5) {
        errors.push('已达到最大5张牌，不能再要牌');
      }

      const handValue = calculateBlackjackValue(state.playerHand);
      if (handValue > 21) {
        errors.push('当前点数已超过21，必须停牌');
      }
    }

    if (action === 'double') {
      if (state.playerHand?.length !== 2) {
        errors.push('加倍只能在初始2张牌时使用');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateNiuniu(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'reveal') {
      const hand = state.playerHands?.[payload.userId] || [];
      if (hand.length !== 5) {
        errors.push('摊牌需要5张牌');
      }

      const { groups, value } = calculateNiuniuValue(hand);
      if (!groups.valid) {
        errors.push(`无法组成牛牛牌型: ${groups.reason}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateShengji(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'play') {
      if (!payload.cardIds || payload.cardIds.length === 0) {
        errors.push('出牌需要指定牌ID');
      }

      if (state.mustFollowSuit) {
        const hand = state.playerHands?.[payload.userId] || [];
        const hasSuit = checkSuit(hand, state.turnSuit);
        if (!hasSuit && !payload.isMainSuit) {
          errors.push(`必须出${state.turnSuit}花色的牌`);
        }
      }

      if (state.mustBeat) {
        const lastCombo = analyzeCardCombo(state.lastPlayedCards);
        const currentCombo = analyzeCardCombo(payload.cardIds);
        if (!canBeat(lastCombo, currentCombo, state.levelSuit)) {
          errors.push('必须出比上家大的牌');
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateTouziBao(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'place_bet') {
      if (!payload.amount || payload.amount <= 0) {
        errors.push('下注金额必须大于0');
      }

      const playerChips = state.playerChips?.[payload.userId] || 0;
      if (payload.amount > playerChips) {
        errors.push('下注金额不能超过可用筹码');
      }

      if (state.betPhase !== 'betting') {
        errors.push('当前不是下注阶段');
      }
    }

    if (action === 'roll') {
      if (state.rollerId !== payload.userId) {
        errors.push('只有当前掷骰者可以掷骰');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateErbaban(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'roll') {
      if (state.rollPhase !== 'rolling') {
        errors.push('当前不是掷骰阶段');
      }
    }

    if (action === 'compare') {
      if (!payload.targetId) {
        errors.push('比牌需要指定目标玩家');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateWeiqi(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'place') {
      if (payload.x < 0 || payload.x >= 19 || payload.y < 0 || payload.y >= 19) {
        errors.push('落子位置超出棋盘范围');
      }

      if (state.board?.[payload.y]?.[payload.x] !== 0) {
        errors.push('该位置已有棋子');
      }

      if (state.koPoint && payload.x === state.koPoint.x && payload.y === state.koPoint.y) {
        errors.push('打劫不能立即回提');
      }

      if (isSuicide(state.board, payload.x, payload.y, state.currentPlayer)) {
        errors.push('禁入点（自杀）');
      }
    }

    if (action === 'pass') {
      const passCount = (state.passCount || 0) + 1;
      if (passCount >= 2) {
        return { valid: true, warnings: ['双方都Pass，将进入点目阶段'] };
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateXiangqi(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'move') {
      const from = payload.from;
      const to = payload.to;

      if (!isValidPosition(from.x, from.y, 9, 10)) {
        errors.push('起始位置不合法');
      }

      if (!isValidPosition(to.x, to.y, 9, 10)) {
        errors.push('目标位置不合法');
      }

      const piece = state.board?.[from.y]?.[from.x];
      if (!piece) {
        errors.push('起始位置没有棋子');
      }

      if (piece && piece !== state.currentPlayer) {
        errors.push('不能移动对方的棋子');
      }

      if (!isValidMove(piece, from, to, state.board)) {
        errors.push('走法不合法');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateWuziqi(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'move') {
      if (payload.x < 0 || payload.x >= 15 || payload.y < 0 || payload.y >= 15) {
        errors.push('落子位置超出棋盘范围');
      }

      if (state.board?.[payload.y]?.[payload.x] !== 0) {
        errors.push('该位置已有棋子');
      }

      const player = state.currentPlayer;
      const opponent = player === 1 ? 2 : 1;

      if (hasForbiddenMove(state.board, payload.x, payload.y, player, opponent)) {
        errors.push('禁手：长连/活四/冲四');
      }

      const win = checkWuziqiWin(state.board, payload.x, payload.y, player);
      if (win) {
        return { valid: true, warnings: [`即将胜利 - 连成${win}子`] };
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateInternationalChess(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'move') {
      const from = payload.from;
      const to = payload.to;

      if (!isValidPosition(from.x, from.y, 8, 8)) {
        errors.push('起始位置不合法');
      }

      if (!isValidPosition(to.x, to.y, 8, 8)) {
        errors.push('目标位置不合法');
      }

      const piece = state.board?.[from.y]?.[from.x];
      if (!piece) {
        errors.push('起始位置没有棋子');
      }

      const isWhite = piece === piece.toUpperCase();
      if (isWhite !== (state.currentPlayer === 'white')) {
        errors.push('不能移动对方的棋子');
      }

      if (!isValidChessMove(piece, from, to, state.board, state.castlingRights)) {
        errors.push('走法不合法');
      }

      if (state.isCheck && !preventsCheck(state.board, from, to, state.currentPlayer)) {
        errors.push('将军时必须解除将军状态');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateJunqi(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'setup') {
      const myPieces = state.myPieces?.[payload.userId] || [];
      if (myPieces.length > 25) {
        errors.push('布阵棋子数量超过限制');
      }
    }

    if (action === 'move') {
      const from = payload.from;
      const to = payload.to;

      if (state.setupPhase) {
        errors.push('布阵阶段不能移动棋子');
      }

      const piece = state.board?.[from.y]?.[from.x];
      if (!piece) {
        errors.push('起始位置没有棋子');
      }

      if (isFlag(piece) && to.y === 0) {
        errors.push('军棋不能移动到对方大本营');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateSichuanMahjong(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'discard') {
      if (state.phase !== 'discard') {
        errors.push('当前不是出牌阶段');
      }

      const hand = state.playerHands?.[payload.userId] || [];
      const hasTile = hand.find(t => t.id === payload.tileId);
      if (!hasTile) {
        errors.push('手牌中没有这张牌');
      }
    }

    if (action === 'chi' || action === 'peng' || action === 'gang') {
      if (!payload.tileId) {
        errors.push('需要指定操作的牌');
      }

      const missingSuits = state.playerHands?.[payload.userId]?.missingSuits || [];
      if (missingSuits.length > 0 && action !== 'gang') {
        errors.push(`必须缺一门（缺少: ${missingSuits.join(', ')}）`);
      }
    }

    if (action === 'hu') {
      if (state.phase !== 'self_discard' && state.phase !== 'discard') {
        errors.push('当前不能胡牌');
      }

      const hand = state.playerHands?.[payload.userId] || [];
      if (!isValidMahjongHand(hand)) {
        errors.push('牌型不符合胡牌规则');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateGuangdongMahjong(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'discard') {
      if (state.phase !== 'discard') {
        errors.push('当前不是出牌阶段');
      }
    }

    if (action === 'hu') {
      const hand = state.playerHands?.[payload.userId] || [];
      const { fans, valid } = calculateGuangdongFans(hand);
      if (!valid) {
        errors.push('牌型不符合胡牌规则');
      }
      if (fans < 8) {
        warnings.push(`只有${fans}番，达不到起和番数(8番)`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateGuobiaoMahjong(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'hu') {
      const hand = state.playerHands?.[payload.userId] || [];
      const { fans, valid } = calculateGuobiaoFans(hand);
      if (!valid) {
        errors.push('牌型不符合国标麻将规则');
      }
      if (fans < 8) {
        errors.push(`只有${fans}番，达不到起和番数(8番)`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateRenMahjong(action, state, payload) {
    const errors = [];
    const warnings = [];

    if (action === 'discard') {
      if (state.phase !== 'discard') {
        errors.push('当前不是出牌阶段');
      }
    }

    if (action === 'hu') {
      const hand = state.playerHands?.[payload.userId] || [];
      if (hand.length !== 2 && hand.length !== 5 && hand.length !== 8 && hand.length !== 11 && hand.length !== 14) {
        errors.push('手牌数量不符合胡牌要求');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

function analyzeCardCombo(cardIds) {
  if (!cardIds || cardIds.length === 0) return null;

  const values = cardIds.map(id => Math.floor(id / 4) + 1);
  const suits = cardIds.map(id => id % 4);

  if (cardIds.length === 1) {
    return { type: 'single', value: values[0], strength: values[0] };
  }

  const isFlush = suits.every(s => s === suits[0]);
  const sortedValues = values.sort((a, b) => b - a);
  const isStraight = sortedValues.every((v, i) => i === 0 || v === sortedValues[i - 1] - 1);
  const counts = {};
  values.forEach(v => counts[v] = (counts[v] || 0) + 1);

  if (isFlush && isStraight) {
    return { type: 'straight_flush', value: sortedValues[0], strength: sortedValues[0] + 100 };
  }

  if (Object.values(counts).includes(4)) {
    return { type: 'four_of_kind', value: Number(Object.keys(counts).find(k => counts[k] === 4)), strength: Number(Object.keys(counts).find(k => counts[k] === 4)) + 80 };
  }

  if (Object.values(counts).includes(3) && Object.values(counts).includes(2)) {
    return { type: 'full_house', value: Number(Object.keys(counts).find(k => counts[k] === 3)), strength: Number(Object.keys(counts).find(k => counts[k] === 3)) + 60 };
  }

  if (isFlush) {
    return { type: 'flush', value: sortedValues[0], strength: sortedValues[0] + 50 };
  }

  if (isStraight) {
    return { type: 'straight', value: sortedValues[0], strength: sortedValues[0] + 40 };
  }

  if (Object.values(counts).includes(3)) {
    return { type: 'three', value: Number(Object.keys(counts).find(k => counts[k] === 3)), strength: Number(Object.keys(counts).find(k => counts[k] === 3)) + 30 };
  }

  if (Object.values(counts).filter(c => c === 2).length === 2) {
    const pairs = Object.keys(counts).filter(k => counts[k] === 2).map(Number).sort((a, b) => b - a);
    return { type: 'two_pair', value: pairs[0], strength: pairs[0] + 20 };
  }

  if (Object.values(counts).includes(2)) {
    const pair = Number(Object.keys(counts).find(k => counts[k] === 2));
    return { type: 'pair', value: pair, strength: pair + 10 };
  }

  return { type: 'high_card', value: sortedValues[0], strength: sortedValues[0] };
}

function canBeat(lastCombo, currentCombo) {
  if (!currentCombo) return false;
  if (!lastCombo) return true;
  if (currentCombo.type === 'pass') return true;
  if (lastCombo.type === 'pass') return true;

  return currentCombo.strength > lastCombo.strength;
}

function calculateBlackjackValue(hand) {
  if (!hand || hand.length === 0) return 0;

  let value = 0;
  let aces = 0;

  for (const card of hand) {
    const rank = card % 4 + 1;
    if (rank === 1) {
      aces++;
      value += 11;
    } else if (rank >= 10) {
      value += 10;
    } else {
      value += rank;
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

function calculateNiuniuValue(hand) {
  if (!hand || hand.length !== 5) {
    return { valid: false, reason: '需要5张牌' };
  }

  const values = hand.map(c => Math.floor(c / 4) + 1);
  const counts = {};
  values.forEach(v => counts[v] = (counts[v] || 0) + 1);

  const groups = [];
  for (const v of values) {
    groups.push({ value: v, count: counts[v] });
  }

  const total = values.reduce((a, b) => a + b, 0);
  const remainder = total % 10;

  if (remainder === 0) {
    return { valid: true, value: 10, groups, name: '牛牛' };
  }

  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const sum = values[i] + values[j];
      if (sum % 10 === remainder) {
        const remaining = values.filter((_, idx) => idx !== i && idx !== j);
        return { valid: true, value: remainder, groups, name: `牛${remainder}` };
      }
    }
  }

  return { valid: false, reason: '无法组成牛牛', value: 0 };
}

function checkSuit(hand, suit) {
  return hand.some(c => (c % 4) === suit);
}

function isValidPosition(x, y, w, h) {
  return x >= 0 && x < w && y >= 0 && y < h;
}

function isSuicide(board, x, y, player) {
  const nextBoard = board.map(row => [...row]);
  nextBoard[y][x] = player;

  const group = getGroup(nextBoard, x, y);
  return group.liberties === 0;
}

function getGroup(board, x, y) {
  const w = board[0].length;
  const h = board.length;
  const color = board[y][x];
  const q = [[x, y]];
  const seen = new Set([`${x},${y}`]);
  const stones = [];
  let liberties = 0;
  const neighborCoords = [[-1,0], [1,0], [0,-1], [0,1]];

  while (q.length > 0) {
    const [cx, cy] = q.pop();
    stones.push([cx, cy]);

    for (const [dx, dy] of neighborCoords) {
      const nx = cx + dx;
      const ny = cy + dy;

      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

      const v = board[ny][nx];
      if (v === 0) {
        liberties++;
      } else if (v === color) {
        const key = `${nx},${ny}`;
        if (!seen.has(key)) {
          seen.add(key);
          q.push([nx, ny]);
        }
      }
    }
  }

  return { color, stones, liberties };
}

function hasForbiddenMove(board, x, y, player, opponent) {
  const nextBoard = board.map(row => [...row]);
  nextBoard[y][x] = player;

  const directions = [[1,0], [0,1], [1,1], [1,-1]];

  for (const [dx, dy] of directions) {
    let count = 1;
    for (let i = 1; i <= 4; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || nextBoard[ny][nx] !== player) break;
      count++;
    }
    for (let i = 1; i <= 4; i++) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || nextBoard[ny][nx] !== player) break;
      count++;
    }

    if (count > 5) return true;
    if (count === 5) {
      const midX = x + dx * 2;
      const midY = y + dy * 2;
      if (midX >= 0 && midX < 15 && midY >= 0 && midY < 15 && nextBoard[midY][midX] === 0) {
        return true;
      }
    }
  }

  return false;
}

function checkWuziqiWin(board, x, y, player) {
  const directions = [[1,0], [0,1], [1,1], [1,-1]];

  for (const [dx, dy] of directions) {
    let count = 1;

    for (let i = 1; i <= 4; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || board[ny][nx] !== player) break;
      count++;
    }

    for (let i = 1; i <= 4; i++) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || board[ny][nx] !== player) break;
      count++;
    }

    if (count >= 5) return count;
  }

  return null;
}

function isValidMove(piece, from, to, board) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const type = piece.toLowerCase();

  switch (type) {
    case 'r': return absDx * absDy === 0;
    case 'n': return (absDx === 1 && absDy === 2) || (absDx === 2 && absDy === 1);
    case 'b':
      if (absDx !== absDy) return false;
      return !isBlocked(board, from, to, dx / absDx, dy / absDy);
    case 'a':
      if (absDy !== 1 || absDx !== 1) return false;
      return to.y < 5;
    case 'k':
      if (absDx > 1 || absDy > 1) return false;
      return to.y < 5;
    case 'c':
      if (absDx * absDy === 0) {
        return !isCannonBlocked(board, from, to);
      }
      return absDx * absDy === 2;
    case 'p':
      return absDx * absDy === 0;
    default: return false;
  }
}

function isBlocked(board, from, to, dx, dy) {
  let x = from.x + dx;
  let y = from.y + dy;
  while (x !== to.x || y !== to.y) {
    if (board[y][x] !== 0) return true;
    x += dx;
    y += dy;
  }
  return false;
}

function isCannonBlocked(board, from, to) {
  if (from.x === to.x) {
    const minY = Math.min(from.y, to.y) + 1;
    const maxY = Math.max(from.y, to.y);
    for (let y = minY; y < maxY; y++) {
      if (board[y][from.x] !== 0) return true;
    }
  } else if (from.y === to.y) {
    const minX = Math.min(from.x, to.x) + 1;
    const maxX = Math.max(from.x, to.x);
    for (let x = minX; x < maxX; x++) {
      if (board[from.y][x] !== 0) return true;
    }
  }
  return false;
}

function isValidChessMove(piece, from, to, board, castlingRights) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const p = piece.toLowerCase();

  switch (p) {
    case 'p':
      if (absDx === 1 && absDy === 0) return board[to.y][to.x] === 0;
      if (absDx === 1 && absDy === 1) return board[to.y][to.x] !== 0;
      if (absDy === 2 && absDx === 0) return from.y === 6 && board[to.y][to.x] === 0;
      return absDy === 1 && absDx === 0;
    case 'r': return absDx * absDy === 0;
    case 'n': return (absDx === 1 && absDy === 2) || (absDx === 2 && absDy === 1);
    case 'b': return absDx === absDy;
    case 'q': return absDx === absDy || absDx * absDy === 0;
    case 'k':
      if (absDx === 2 && dy === 0 && castlingRights) {
        return true;
      }
      return absDx <= 1 && absDy <= 1;
    default: return false;
  }
}

function preventsCheck(board, from, to, player) {
  return true;
}

function isFlag(piece) {
  return piece?.toLowerCase() === 'f';
}

function isValidMahjongHand(hand) {
  if (!hand || hand.length % 3 !== 2) return false;

  return true;
}

function calculateGuangdongFans(hand) {
  return { fans: 0, valid: true };
}

function calculateGuobiaoFans(hand) {
  return { fans: 0, valid: true };
}

export const gameBoundaryValidator = new GameBoundaryValidator();

export async function validateGameAction(gameType, action, state, payload) {
  return gameBoundaryValidator.validateGameAction(gameType, action, state, payload);
}
