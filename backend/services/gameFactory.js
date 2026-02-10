
import { TexasHoldemGame } from './games/poker/texasHoldem.js';
import { ZhajinhuaGame } from './games/poker/zhajinhua.js';
import { BlackjackGame } from './games/poker/blackjack.js';
import { DoudizhuGame } from './games/poker/doudizhu.js';
import { PaodekuaiGame } from './games/poker/paodekuai.js';
import { ShengjiGame } from './games/poker/shengji.js';
import { GomokuGame } from './games/chess/gomoku.js';
import { XiangqiGame } from './games/chess/xiangqi.js';
import { WeiqiGame } from './games/chess/weiqi.js';
import { InternationalChessGame } from './games/chess/internationalChess.js';
import { JunqiGame } from './games/chess/junqi.js';
import { MahjongGame } from './games/mahjong/mahjong.js';
import { NiuniuGame } from './games/other/niuniu.js';
import { DiceBaoGame } from './games/other/diceBao.js';
import { ErbabanGame } from './games/other/erbaban.js';
import { GenericGame } from './games/generic.js';

export function createGameInstance(gameCode, playerIds, options = {}) {
  switch (gameCode) {
    case 'texas_holdem':
      return new TexasHoldemGame(playerIds, options);
    case 'zhajinhua':
      return new ZhajinhuaGame(playerIds, options);
    case 'doudizhu':
      return new DoudizhuGame(playerIds, options);
    case 'paodekuai':
      return new PaodekuaiGame(playerIds, options);
    case 'shengji':
      return new ShengjiGame(playerIds, options);
    case 'blackjack':
      return new BlackjackGame(playerIds, options);
    case 'wuziqi':
      return new GomokuGame(playerIds, options);
    case 'xiangqi':
      return new XiangqiGame(playerIds, options);
    case 'weiqi':
      return new WeiqiGame(playerIds, options);
    case 'international_chess':
      return new InternationalChessGame(playerIds, options);
    case 'junqi':
      return new JunqiGame(playerIds, options);
    case 'sichuan_mahjong':
    case 'guangdong_mahjong':
    case 'guobiao_mahjong':
    case 'ren_mahjong':
      return new MahjongGame(playerIds, gameCode, options);
    case 'niuniu':
      return new NiuniuGame(playerIds, options);
    case 'erbaban':
      return new ErbabanGame(playerIds, options);
    case 'touzi_bao':
      return new DiceBaoGame(playerIds, options);
    default:
      console.warn(`Game code ${gameCode} not explicitly implemented, using GenericGame.`);
      return new GenericGame(playerIds, gameCode, options);
  }
}
