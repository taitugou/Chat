
import { TexasHoldemGame } from './games/poker/texasHoldem.js';
import { ZhajinhuaGame } from './games/poker/zhajinhua.js';
import { GomokuGame } from './games/chess/gomoku.js';
import { GenericGame } from './games/generic.js';

export function createGameInstance(gameCode, playerIds) {
    console.log(`Creating game instance for ${gameCode} with players ${playerIds}`);
    switch (gameCode) {
        case 'texas_holdem':
            return new TexasHoldemGame(playerIds);
        case 'zhajinhua':
            return new ZhajinhuaGame(playerIds);
        case 'wuziqi': // Gomoku
            return new GomokuGame(playerIds);
        // Add other specific games here
        default:
            console.warn(`Game code ${gameCode} not explicitly implemented, using GenericGame.`);
            return new GenericGame(playerIds, gameCode);
    }
}
