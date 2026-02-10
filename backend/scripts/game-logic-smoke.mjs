import assert from 'node:assert/strict';
import { Card, HandEvaluator } from '../services/games/poker/texasHoldem.js';
import { ZhajinhuaGame } from '../services/games/poker/zhajinhua.js';
import { GomokuGame } from '../services/games/chess/gomoku.js';
import { BlackjackGame } from '../services/games/poker/blackjack.js';
import { DoudizhuGame } from '../services/games/poker/doudizhu.js';
import { PaodekuaiGame } from '../services/games/poker/paodekuai.js';
import { ShengjiGame } from '../services/games/poker/shengji.js';
import { MahjongGame } from '../services/games/mahjong/mahjong.js';
import { XiangqiGame } from '../services/games/chess/xiangqi.js';
import { WeiqiGame } from '../services/games/chess/weiqi.js';
import { InternationalChessGame } from '../services/games/chess/internationalChess.js';
import { JunqiGame } from '../services/games/chess/junqi.js';
import { NiuniuGame } from '../services/games/other/niuniu.js';
import { DiceBaoGame } from '../services/games/other/diceBao.js';
import { ErbabanGame } from '../services/games/other/erbaban.js';
import { evaluateDoudizhuPlay } from '../services/games/poker/doudizhu.js';
import { evaluatePaodekuaiPlay } from '../services/games/poker/paodekuai.js';

function c(suit, rank) {
  return new Card(suit, rank);
}

function testTexasStraight() {
  const notStraight = HandEvaluator.evaluateFiveCards([
    c('♠', 'A'),
    c('♥', 'K'),
    c('♦', 'Q'),
    c('♣', 'J'),
    c('♠', '9')
  ]);
  assert.equal(notStraight.rank, 1);

  const wheel = HandEvaluator.evaluateFiveCards([
    c('♠', 'A'),
    c('♥', '2'),
    c('♦', '3'),
    c('♣', '4'),
    c('♠', '5')
  ]);
  assert.equal(wheel.rank, 5);
  assert.equal(wheel.highCard.value, 5);

  const broadway = HandEvaluator.evaluateFiveCards([
    c('♠', 'A'),
    c('♥', 'K'),
    c('♦', 'Q'),
    c('♣', 'J'),
    c('♠', '10')
  ]);
  assert.equal(broadway.rank, 5);
  assert.equal(broadway.highCard.value, 14);
}

function testZhajinhuaBasic() {
  const game = new ZhajinhuaGame([1, 2], { baseBet: 10, ante: 10, enable235: true });

  assert.equal(game.getCurrentPlayerId(), 1);
  game.see(1);
  game.call(1);
  assert.equal(game.getCurrentPlayerId(), 2);
  game.call(2);
  assert.equal(game.pot > 0, true);
}

function testGomokuWin() {
  const game = new GomokuGame([1, 2]);
  const moves = [
    [1, 7, 7],
    [2, 7, 8],
    [1, 8, 7],
    [2, 8, 8],
    [1, 9, 7],
    [2, 9, 8],
    [1, 10, 7],
    [2, 10, 8],
    [1, 11, 7]
  ];
  let result = null;
  for (const [pid, x, y] of moves) {
    result = game.playMove(pid, x, y) || result;
  }
  assert.ok(result);
  assert.equal(result.winnerId, 1);
  assert.equal(result.totalPot, 200);
}

function testBlackjackSettles() {
  const game = new BlackjackGame([1, 2], { baseBet: 20 });
  let guard = 0;
  while (!game.gameOver && guard < 20) {
    const pid = game.getCurrentPlayerId();
    game.stand(pid);
    guard += 1;
  }
  assert.equal(game.gameOver, true);
  const state = game.getGameState();
  assert.equal(state.dealerReveal, true);
}

function testNiuniuSettle() {
  const game = new NiuniuGame([1, 2], { baseBet: 20 });
  game.reveal(1);
  const result = game.reveal(2);
  assert.ok(result);
  assert.equal(result.type, 'niuniu_settle');
}

function testDiceBaoSettle() {
  const game = new DiceBaoGame([1, 2], { baseBet: 10 });
  game.bet(1, 'big', 10);
  game.bet(2, 'small', 10);
  const result = game.roll(1);
  assert.ok(result);
  assert.equal(result.type, 'dicebao_settle');
}

function testDoudizhuEvaluateTypes() {
  const c = (v) => ({ value: v });
  assert.equal(evaluateDoudizhuPlay([c(3)]).type, 'single');
  assert.equal(evaluateDoudizhuPlay([c(6), c(6)]).type, 'pair');
  assert.equal(evaluateDoudizhuPlay([c(7), c(7), c(7)]).type, 'triple');
  assert.equal(evaluateDoudizhuPlay([c(8), c(8), c(8), c(9)]).type, 'triple1');
  assert.equal(evaluateDoudizhuPlay([c(10), c(10), c(10), c(11), c(11)]).type, 'triple2');
  assert.equal(evaluateDoudizhuPlay([c(3), c(4), c(5), c(6), c(7)]).type, 'straight');
  assert.equal(evaluateDoudizhuPlay([c(3), c(3), c(4), c(4), c(5), c(5)]).type, 'double_straight');
  assert.equal(evaluateDoudizhuPlay([c(3), c(3), c(3), c(4), c(4), c(4)]).type, 'plane');
  assert.equal(evaluateDoudizhuPlay([c(9), c(9), c(9), c(9)]).type, 'bomb');
  assert.equal(evaluateDoudizhuPlay([c(16), c(17)]).type, 'rocket');
}

function testPaodekuaiEvaluateTypes() {
  const c = (rank) => ({ rank });
  assert.equal(evaluatePaodekuaiPlay([c('3')]).type, 'single');
  assert.equal(evaluatePaodekuaiPlay([c('A'), c('A')]).type, 'pair');
  assert.equal(evaluatePaodekuaiPlay([c('9'), c('9'), c('9')]).type, 'triple');
  assert.equal(evaluatePaodekuaiPlay([c('4'), c('4'), c('4'), c('8')]).type, 'triple1');
  assert.equal(evaluatePaodekuaiPlay([c('5'), c('5'), c('5'), c('7'), c('7')]).type, 'triple2');
  assert.equal(evaluatePaodekuaiPlay([c('3'), c('4'), c('5'), c('6'), c('7')]).type, 'straight');
  assert.equal(evaluatePaodekuaiPlay([c('3'), c('3'), c('4'), c('4'), c('5'), c('5')]).type, 'double_straight');
}

function testDoudizhuBidAndSurrender() {
  const game = new DoudizhuGame([1, 2, 3], { baseBet: 10 });
  game.bid(1, 1);
  game.bid(2, 0);
  game.bid(3, 0);
  assert.equal(game.phase, 'playing');
  const res = game.surrender(game.getCurrentPlayerId());
  assert.ok(res);
  assert.equal(res.totalPot, 30);
}

function testPaodekuaiSurrender() {
  const game = new PaodekuaiGame([1, 2], { baseBet: 10 });
  const res = game.surrender(1);
  assert.ok(res);
}

function testShengjiSurrender() {
  const game = new ShengjiGame([1, 2, 3, 4], { baseBet: 10 });
  const res = game.surrender(1);
  assert.ok(res);
}

function testShengjiQuickPlayFinish() {
  const game = new ShengjiGame([1, 2, 3, 4], { baseBet: 10, handSize: 1 });
  let result = null;
  let guard = 0;
  while (!result && !game.gameOver && guard < 200) {
    const pid = game.getCurrentPlayerId();
    const hand = game.hands[pid] || [];
    if (hand.length === 0) break;
    result = game.play(pid, hand[0].id) || result;
    guard += 1;
  }
  assert.ok(result);
  assert.ok(result.winnerId);
}

function testMahjongSurrender() {
  const game = new MahjongGame([1, 2, 3, 4], 'sichuan_mahjong', { baseBet: 10 });
  assert.equal(game.getCurrentPlayerId(), 1);
  const res = game.surrender(1);
  assert.ok(res);
}

function testMahjongAutoSettleByMaxTurns() {
  const game = new MahjongGame([1, 2, 3, 4], 'sichuan_mahjong', { baseBet: 10, maxTurns: 2 });
  const p1 = game.getCurrentPlayerId();
  const tile1 = game.hands[p1][0].id;
  let r = game.discard(p1, tile1);
  assert.equal(r, null);
  const p2 = game.getCurrentPlayerId();
  const tile2 = game.hands[p2][0].id;
  r = game.discard(p2, tile2);
  assert.ok(r);
  assert.ok(r.winnerId);
}

function testMahjongPengUndoDraw() {
  const game = new MahjongGame([1, 2, 3, 4], 'sichuan_mahjong', { baseBet: 10 });
  game.tiles = [];
  game.hands = { 1: [], 2: [], 3: [], 4: [] };
  game.melds = { 1: [], 2: [], 3: [], 4: [] };
  game.discards = { 1: [], 2: [], 3: [], 4: [] };
  game.lastDiscard = { playerId: 1, tile: { suit: 'm', rank: 1, id: 'd' } };
  game.currentPlayerIndex = 1;
  game.hands[2] = [
    { id: 'a', suit: 'm', rank: 1 },
    { id: 'b', suit: 'm', rank: 1 },
    { id: 'x', suit: 'p', rank: 2 },
    { id: 'ld', suit: 's', rank: 3 }
  ];
  game.lastDraw = { playerId: 2, tile: { id: 'ld', suit: 's', rank: 3 }, fromDiscardId: 'd' };

  const r = game.peng(2, ['a', 'b']);
  assert.equal(r, null);
  assert.equal(game.lastDiscard, null);
  assert.equal(game.melds[2].length, 1);
  assert.equal(game.getCurrentPlayerId(), 2);
  assert.equal(game.lastDraw, null);
}

function testXiangqiMoveAndSurrender() {
  const game = new XiangqiGame([1, 2], { baseBet: 10 });
  const state = game.getGameState();
  assert.equal(state.boardW, 9);
  game.move(1, { x: 0, y: 9 }, { x: 0, y: 8 });
  const res = game.surrender(2);
  assert.ok(res);
}

function testXiangqiPawnSidewaysRule() {
  const game = new XiangqiGame([1, 2], { baseBet: 10 });
  assert.throws(() => game.move(1, { x: 0, y: 6 }, { x: 1, y: 6 }));
  game.move(1, { x: 0, y: 6 }, { x: 0, y: 5 });
  game.move(2, { x: 0, y: 3 }, { x: 0, y: 4 });
  game.move(1, { x: 0, y: 5 }, { x: 0, y: 4 });
  game.move(2, { x: 2, y: 3 }, { x: 2, y: 4 });
  game.move(1, { x: 0, y: 4 }, { x: 1, y: 4 });
  assert.equal(game.board[4][1], 'P');
}

function testWeiqiPlaceAndSurrender() {
  const game = new WeiqiGame([1, 2], { baseBet: 10 });
  game.place(1, 3, 3);
  const res = game.surrender(2);
  assert.ok(res);
}

function testWeiqiCaptureAndKo() {
  const game = new WeiqiGame([1, 2], { baseBet: 10, boardW: 5, boardH: 5, komi: 0 });
  game.board = [
    [0, 1, 0, 0, 0],
    [1, 2, 1, 0, 0],
    [2, 0, 2, 0, 0],
    [0, 2, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ];
  const h = (b) => b.map((r) => r.join('')).join('|');
  game.currHash = h(game.board);
  game.prevHash = null;
  game.currentPlayerIndex = 0;
  game.passCount = 0;
  game.captureCount = { black: 0, white: 0 };

  game.place(1, 1, 2);
  assert.equal(game.captureCount.black, 1);
  assert.equal(game.board[1][1], 0);
  assert.throws(() => game.place(2, 1, 1));
}

function testInternationalChessMoveAndSurrender() {
  const game = new InternationalChessGame([1, 2], { baseBet: 10 });
  game.move(1, { x: 0, y: 6 }, { x: 0, y: 5 });
  const res = game.surrender(2);
  assert.ok(res);
}

function testInternationalChessCastling() {
  const game = new InternationalChessGame([1, 2], { baseBet: 10 });
  game.board = [
    [null, null, null, null, 'k', null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['R', null, null, null, 'K', null, null, 'R']
  ];
  const result = game.move(1, { x: 4, y: 7 }, { x: 6, y: 7 });
  assert.equal(result, null);
  assert.equal(game.board[7][6], 'K');
  assert.equal(game.board[7][5], 'R');
}

function testJunqiMoveAndSurrender() {
  const game = new JunqiGame([1, 2], { baseBet: 10 });
  game.move(1, { x: 2, y: 10 }, { x: 2, y: 9 });
  const res = game.surrender(2);
  assert.ok(res);
}

function testJunqiSetupAndBattle() {
  const game = new JunqiGame([1, 2], { baseBet: 10, autoSetup: false });
  const red = [
    { x: 2, y: 11, piece: 'F' },
    { x: 0, y: 11, piece: 'B' },
    { x: 4, y: 11, piece: 'B' },
    { x: 0, y: 10, piece: 'M' },
    { x: 1, y: 10, piece: 'M' },
    { x: 2, y: 10, piece: 'M' },
    { x: 2, y: 9, piece: 'E' },
    { x: 3, y: 10, piece: '9' },
    { x: 4, y: 10, piece: '8' },
    { x: 3, y: 9, piece: '7' },
    { x: 4, y: 9, piece: '6' },
    { x: 0, y: 9, piece: '5' },
    { x: 1, y: 9, piece: '4' },
    { x: 0, y: 8, piece: '3' },
    { x: 1, y: 8, piece: '2' }
  ];
  const black = [
    { x: 2, y: 0, piece: 'F' },
    { x: 0, y: 0, piece: 'B' },
    { x: 4, y: 0, piece: 'B' },
    { x: 0, y: 1, piece: 'M' },
    { x: 1, y: 1, piece: 'M' },
    { x: 2, y: 1, piece: 'M' },
    { x: 2, y: 2, piece: 'E' },
    { x: 3, y: 1, piece: '9' },
    { x: 4, y: 1, piece: '8' },
    { x: 3, y: 2, piece: '7' },
    { x: 4, y: 2, piece: '6' },
    { x: 0, y: 2, piece: '5' },
    { x: 1, y: 2, piece: '4' },
    { x: 0, y: 3, piece: '3' },
    { x: 1, y: 3, piece: '2' }
  ];
  game.setup(1, red);
  game.setup(2, black);
  assert.equal(game.phase, 'playing');

  game.board[10][2] = 'E';
  game.board[9][2] = 'm';
  game.currentPlayerIndex = 0;
  game.move(1, { x: 2, y: 10 }, { x: 2, y: 9 });
  assert.equal(game.board[9][2], 'E');

  game.board[10][1] = 'B';
  game.board[9][1] = 'r7';
  game.currentPlayerIndex = 0;
  game.move(1, { x: 1, y: 10 }, { x: 1, y: 9 });
  assert.equal(game.board[9][1], null);
}

function testErbabanRoll() {
  const game = new ErbabanGame([1, 2], { baseBet: 10 });
  game.roll(1);
  const res = game.roll(2);
  assert.ok(res);
  assert.equal(res.type, 'erbaban_finish');
}

function run() {
  testTexasStraight();
  testZhajinhuaBasic();
  testGomokuWin();
  testBlackjackSettles();
  testNiuniuSettle();
  testDiceBaoSettle();
  testDoudizhuEvaluateTypes();
  testPaodekuaiEvaluateTypes();
  testDoudizhuBidAndSurrender();
  testPaodekuaiSurrender();
  testShengjiSurrender();
  testShengjiQuickPlayFinish();
  testMahjongSurrender();
  testMahjongAutoSettleByMaxTurns();
  testMahjongPengUndoDraw();
  testXiangqiMoveAndSurrender();
  testXiangqiPawnSidewaysRule();
  testWeiqiPlaceAndSurrender();
  testWeiqiCaptureAndKo();
  testInternationalChessMoveAndSurrender();
  testInternationalChessCastling();
  testJunqiMoveAndSurrender();
  testJunqiSetupAndBattle();
  testErbabanRoll();
  process.stdout.write('game-logic-smoke: ok\n');
}

run();
