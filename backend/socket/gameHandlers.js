import { query } from '../database/connection.js';
import { getRoomById, setPlayerReady, leaveRoom } from '../services/roomService.js';
import { createGameRecord, updateGameRecord } from '../services/gameService.js';
import { addChips, deductChips, getUserChips, CHIP_TRANSACTION_TYPES } from '../services/chipsService.js';
import { createLoan } from '../services/loanService.js';
import { createGameInstance } from '../services/gameFactory.js';
import { getGame, setGame, hasGame, deleteGame } from '../services/gameRegistry.js';
import { withGameLock, getOrCreateRoomLock, deleteRoomLock } from '../services/gameOperationLock.js';
import { settleGame, abortGame, getSettlementReport, validateSettlementIntegrity } from '../services/gameSettlementService.js';

// In-memory game state storage adapter
const games = {
  get: getGame,
  set: setGame,
  has: hasGame,
  delete: deleteGame
};

const readyTimers = new Map();

const DEFAULT托管_TIMEOUT_MS = 30000;
const AUTO托管_ACTIONS = ['check', 'call', 'fold', 'pass'];

function get托管Timeout() {
  return parseInt(process.env.GAME托管_TIMEOUT_MS || String(DEFAULT托管_TIMEOUT_MS));
}

async function execute托管Action(io, roomId, game, playerId, action, payload = {}) {
  const gameHandlers = {
    'zhajinhua': ['call', 'fold', 'see'],
    'doudizhu': ['pass', 'play', 'bid'],
    'paodekuai': ['pass', 'play'],
    'blackjack': ['hit', 'stand', 'double'],
    'niuniu': ['reveal', 'settle'],
    'shengji': ['play', 'pass'],
    'texas_holdem': ['check', 'call', 'raise', 'fold'],
    'touzi_bao': ['place_bet', 'roll'],
    'erbaban': ['roll', 'surrender'],
    'wuziqi': ['move', 'surrender'],
    'xiangqi': ['move', 'surrender'],
    'international_chess': ['move', 'surrender'],
    'junqi': ['move', 'setup', 'surrender'],
    'weiqi': ['place', 'pass', 'settle', 'surrender'],
    'sichuan_mahjong': ['discard', 'hu', 'ron', 'peng', 'chi', 'gang', 'settle', 'surrender'],
    'guangdong_mahjong': ['discard', 'hu', 'ron', 'peng', 'chi', 'gang', 'settle', 'surrender'],
    'guobiao_mahjong': ['discard', 'hu', 'ron', 'peng', 'chi', 'gang', 'settle', 'surrender'],
    'ren_mahjong': ['discard', 'hu', 'ron', 'peng', 'chi', 'gang', 'settle', 'surrender']
  };

  const gameCode = game.gameCode || 'generic';
  const allowedActions = gameHandlers[gameCode] || AUTO托管_ACTIONS;

  let托管Action = action;
  if (!allowedActions.includes(action)) {
    if (action === 'check' || action === 'call' || action === 'pass') {
     托管Action = 'fold';
    } else {
     托管Action = 'fold';
    }
  }

  try {
    const gameType = typeof game.handleAction === 'function' ? 'generic' : 
                     typeof game.playMove === 'function' ? 'board' : 
                     typeof game.place === 'function' ? 'weiqi' : 'poker';

    let result = null;

    if (gameType === 'board') {
      if (payload.from && payload.to) {
        result = game.playMove(playerId, payload.from.x, payload.from.y, payload.to.x, payload.to.y);
      }
    } else if (gameType === 'weiqi') {
      if (payload.x !== undefined && payload.y !== undefined) {
        result = game.place(playerId, payload.x, payload.y);
      } else {
        result = game.pass(playerId);
      }
    } else if (托管Action === 'fold' ||托管Action === 'surrender') {
      if (typeof game.fold === 'function') {
        result = game.fold(playerId);
      } else if (typeof game.handleAction === 'function') {
        result = game.handleAction(playerId, 'surrender', {});
      }
    } else if (typeof game.handleAction === 'function') {
      result = game.handleAction(playerId,托管Action, payload);
    } else {
      const method = game[托管Action];
      if (typeof method === 'function') {
        result = method.call(game, playerId, payload);
      }
    }

    if (result) {
      if (game.__finishing) return;
      game.__finishing = true;
      await finishGame(io, roomId, game.gameId, result);
    } else {
      io.to(`game_room:${roomId}`).emit('game:state_update', {
        roomId,
        gameState: game.getGameState()
      });
    }

    console.log(`[托管] 房间 ${roomId} 玩家 ${playerId} 执行${托管Action}操作完成`);
    return true;
  } catch (e) {
    console.error(`[托管] 房间 ${roomId} 玩家 ${playerId} 执行${托管Action}失败:`, e.message);
    return false;
  }
}

async function handlePlayerDisconnection(io, roomId, userId) {
  const game = games.get(parseInt(roomId));
  if (!game) return;

  if (game.gameOver || game.__finishing) return;

  const currentPlayer = game.getCurrentPlayerId ? game.getCurrentPlayerId() : null;
  if (!currentPlayer || String(currentPlayer) !== String(userId)) {
    return;
  }

  const isOwner = game.bankerId === userId || 
                 game.dealerId === userId || 
                 game.playerIds?.[0] === userId ||
                 (game.redId === userId || game.blackId === userId);

  const isImportantPlayer = isOwner || 
                           game.playerIds?.length === 2 ||
                           game.playerIds?.indexOf(userId) === 0;

  if (!isImportantPlayer) {
    return;
  }

  console.log(`[托管] 检测到关键玩家 ${userId} 断线，房间 ${roomId}，准备执行托管逻辑`);

  create托管Timer(io, roomId, game, userId);
}

async function clearPlayer托管Timers(game, userId) {
  if (!game || !game.托管Timers) return;
  
  const timer = game.托管Timers.get(userId);
  if (timer) {
    clearTimeout(timer);
    game.托管Timers.delete(userId);
    console.log(`[托管] 已清除玩家 ${userId} 的托管计时器`);
  }
}

async function clearAll托管Timers(game) {
  if (!game || !game.托管Timers) return;
  
  for (const [userId, timer] of game.托管Timers) {
    clearTimeout(timer);
    console.log(`[托管] 已清除玩家 ${userId} 的托管计时器`);
  }
  game.托管Timers.clear();
}

function create托管Timer(io, roomId, game, userId) {
  const托管Timeout = get托管Timeout();

  const托管Timer = setTimeout(async () => {
    console.log(`[托管] 玩家 ${userId} 超时 (${托管Timeout}ms)，执行托管操作`);

    try {
      const currentGame = games.get(parseInt(roomId));
      if (!currentGame || currentGame.gameOver || currentGame.__finishing) {
        clearPlayer托管Timers(game, userId);
        return;
      }

      const stillCurrent = currentGame.getCurrentPlayerId ? currentGame.getCurrentPlayerId() : null;
      if (!stillCurrent || String(stillCurrent) !== String(userId)) {
        clearPlayer托管Timers(game, userId);
        return;
      }

      const actions = ['check', 'call', 'pass', 'fold'];
      const action = actions[Math.floor(Math.random() * actions.length)];

      console.log(`[托管] 玩家 ${userId} 执行托管操作: ${action}`);

      const lock = getOrCreateRoomLock(roomId);
      const context = await lock.acquire(`托管_${userId}_${Date.now()}`, 10);

      try {
        await execute托管Action(io, roomId, currentGame, userId, action, {});
      } finally {
        context.release();
      }
    } catch (e) {
      console.error(`[托管] 执行托管操作失败:`, e);
    } finally {
      clearPlayer托管Timers(game, userId);
    }
  },托管Timeout);

  game.托管Timers = game.托管Timers || new Map();
  game.托管Timers.set(userId,托管Timer);

  io.to(`game_room:${roomId}`).emit('game:托管通知', {
    userId,
    message: '玩家已断线，即将执行托管',
    timeout:托管Timeout
  });
}

async function executeStartGame(io, roomId, playerIds) {
  let game = null;
  let gameId = null;
  try {
    const room = await getRoomById(roomId);
    if (room.status === 'playing') return;

    const [typeResult] = await query('SELECT code FROM game_types WHERE id = ?', [room.game_type_id]);
    const gameTypeCode = typeResult[0]?.code || 'texas_holdem';

    let roomSettings = {};
    try {
      roomSettings = typeof room.settings === 'string' ? JSON.parse(room.settings || '{}') : (room.settings || {});
    } catch {
      roomSettings = {};
    }
    const gameOptions = roomSettings?.gameOptions && typeof roomSettings.gameOptions === 'object' ? roomSettings.gameOptions : {};

    game = createGameInstance(gameTypeCode, playerIds, gameOptions);

    for (const [pid, amount] of Object.entries(game.playerBets || {})) {
      const required = Number(amount || 0);
      if (required <= 0) continue;
      const chips = await getUserChips(parseInt(pid));
      if (!chips || Number(chips.balance || 0) < required) {
        throw new Error('筹码不足，无法开始游戏');
      }
    }

    gameId = await createGameRecord(roomId, room.game_type_id, game.getGameState());
    game.gameId = gameId;
    games.set(parseInt(roomId), game);

    await query('UPDATE game_rooms SET status = "playing" WHERE id = ?', [roomId]);

    for (const [pid, amount] of Object.entries(game.playerBets || {})) {
      const required = Number(amount || 0);
      if (required <= 0) continue;
      await deductChips(parseInt(pid), required, CHIP_TRANSACTION_TYPES.GAME_LOSS, '底注', gameId, 'game');
    }

    io.to(`game_room:${roomId}`).emit('game:started', {
      gameId,
      roomId,
      gameType: gameTypeCode,
      gameState: game.getGameState()
    });

    const roomSockets = await io.in(`game_room:${roomId}`).fetchSockets();
    for (const s of roomSockets) {
      const socketUserId = s.data?.userId || s.userId;
      if (game.hands && game.hands[socketUserId]) {
        s.emit('game:hand', { roomId, hand: game.hands[socketUserId] });
      }
    }

    const immediate = game?.__immediateResult;
    if (immediate && !game.__finishing) {
      game.__finishing = true;
      await finishGame(io, roomId, gameId, immediate);
    }
  } catch (error) {
    console.error('executeStartGame error:', error);
    try {
      if (gameId) {
        await updateGameRecord(gameId, {
          status: 'aborted',
          totalPot: Number(game?.pot || 0),
          gameData: game?.getGameState?.()
        });
      }
    } catch (e) {
      console.error('executeStartGame abort record error:', e);
    }
    try {
      await query('UPDATE game_rooms SET status = "waiting" WHERE id = ?', [roomId]);
      await query('UPDATE game_room_players SET is_ready = FALSE WHERE room_id = ?', [roomId]);
    } catch (e) {
      console.error('executeStartGame reset room error:', e);
    }
    try {
      games.delete(parseInt(roomId));
    } catch {}
    throw error;
  }
}

async function attemptStartGame(io, roomId) {
  const room = await getRoomById(roomId);
  if (room.status !== 'waiting') return;

  const players = room.players;
  
  // 仅在所有人准备且达到最小人数时，发送通知或进行其他逻辑
  // 但不再自动执行 executeStartGame，除非手动触发
  const everyoneReady = players.length >= room.min_players && players.every(p => {
    if (String(p.user_id) === String(room.creator_id)) return true;
    return !!p.is_ready;
  });
  
  if (everyoneReady) {
    if (readyTimers.has(parseInt(roomId))) {
      clearTimeout(readyTimers.get(parseInt(roomId)));
      readyTimers.delete(parseInt(roomId));
    }
    // 之前这里会自动开始，现在我们将其注释掉或删除
    // return await executeStartGame(io, roomId, players.map(p => p.user_id));
    console.log(`房间 ${roomId} 所有人已准备，等待房主手动开始`);
  }
  
  // 同样禁用倒计时自动开始逻辑
  /*
  if (readyPlayers.length >= room.min_players && !readyTimers.has(parseInt(roomId))) {
    const timer = setTimeout(async () => {
      // ...
    }, 10000);
    // ...
  }
  */
}

export function initGameSocketHandlers(io, socket) {
  const userId = socket.userId;

  socket.on('disconnecting', () => {
    for (const roomName of socket.rooms) {
      if (typeof roomName !== 'string') continue;
      if (!roomName.startsWith('game_voice:')) continue;
      const voiceRoomId = roomName.slice('game_voice:'.length);
      socket.to(roomName).emit('game:voice:left', { roomId: voiceRoomId, userId });
    }
  });

  socket.on('game:join_room', async (data) => {
    try {
      const { roomId } = data;
      
      const room = await getRoomById(roomId);
      
      socket.join(`game_room:${roomId}`);
      
      await query('UPDATE game_room_players SET is_online = TRUE WHERE room_id = ? AND user_id = ?', [roomId, userId]);
      
      io.to(`game_room:${roomId}`).emit('game:player_joined', {
        userId,
        roomId,
        room
      });

      // If game is playing, send current state to the joining player
      if (room.status === 'playing' && games.has(parseInt(roomId))) {
          const game = games.get(parseInt(roomId));
          const gameState = game.getGameState();
          
          // Send public state
          socket.emit('game:state_update', {
              roomId,
              gameState: {
                  ...gameState,
                  // Hide other players' hands?
                  // getGameState() returns playerBets, communityCards, etc.
                  // It does NOT return hands. We need to check pokerLogic.js getGameState.
                  // It does NOT return hands. Good.
              }
          });
          
          // Send private hand if this player is in the game
          if (game.hands && game.hands[userId]) {
              socket.emit('game:hand', {
                  roomId,
                  hand: game.hands[userId]
              });
          }
      }

    } catch (error) {
      console.error('加入游戏房间失败:', error);
      socket.emit('game:error', { error: '加入房间失败' });
    }
  });

  socket.on('game:leave_room', async (data) => {
    try {
      const { roomId } = data;
      
      socket.to(`game_voice:${roomId}`).emit('game:voice:left', { roomId, userId });
      socket.leave(`game_voice:${roomId}`);
      socket.leave(`game_room:${roomId}`);
      
      // 调用 roomService.leaveRoom，它现在会彻底删除玩家记录
      const result = await leaveRoom(userId, roomId);
      
      // 所有人退出后游戏结束逻辑
      if (result.remainingCount === 0) {
        if (games.has(parseInt(roomId))) {
          const game = games.get(parseInt(roomId));
          console.log(`房间 ${roomId} 所有人已退出，强制结束游戏 ${game.gameId}`);
          
          try {
            const spentMap = game.playerTotalSpent && typeof game.playerTotalSpent === 'object' ? game.playerTotalSpent : {};
            for (const [pid, spentRaw] of Object.entries(spentMap)) {
              const spent = Number(spentRaw || 0);
              if (spent > 0) {
                await addChips(parseInt(pid), spent, CHIP_TRANSACTION_TYPES.REFUND, '对局中止退款', game.gameId, 'game');
              }
            }

            await updateGameRecord(game.gameId, {
              status: 'aborted',
              totalPot: game.pot || 0,
              gameData: game.getGameState()
            });
            
            // 确保房间状态正确
            await query('UPDATE game_rooms SET status = "waiting", empty_at = NOW() WHERE id = ?', [roomId]);
            // 清除内存中的游戏
            games.delete(parseInt(roomId));
          } catch (e) {
            console.error('强制结束游戏失败:', e);
          }
        }
        // 既然房间没人了，不需要广播也不需要后续逻辑
        return;
      }
      
      io.to(`game_room:${roomId}`).emit('game:player_left', { userId });
      
      if (result.newCreatorId) {
          io.to(`game_room:${roomId}`).emit('game:owner_changed', {
            newOwnerId: result.newCreatorId,
            roomId: parseInt(roomId)
          });
        }

        await attemptStartGame(io, roomId);
        
        // If player folds/leaves during game? 
        // Ideally should call game.fold(userId) if active.
      if (games.has(parseInt(roomId))) {
          const game = games.get(parseInt(roomId));
          if (game?.__finishing || game?.gameOver) {
              return;
          }
          if (game.playerStatus && game.playerStatus[userId] === 'active') {
              try {
                  let result = null;
                  if (typeof game.fold === 'function') {
                      result = game.fold(userId);
                  } else if (typeof game.handleAction === 'function') {
                      result = game.handleAction(userId, 'surrender', {});
                  }
                  
                  if (result) {
                      if (game.__finishing) return;
                      game.__finishing = true;
                      await finishGame(io, roomId, game.gameId, result);
                  } else {
                      io.to(`game_room:${roomId}`).emit('game:state_update', {
                          roomId,
                          gameState: game.getGameState()
                      });
                  }
              } catch (e) {
                  console.error('Auto-fold/surrender on leave failed:', e);
              }
          }
      }

    } catch (error) {
      console.error('离开游戏房间失败:', error);
    }
  });

  socket.on('game:voice:join', async (data) => {
    try {
      const { roomId } = data || {};
      if (!roomId) return;
      const [check] = await query('SELECT id FROM game_room_players WHERE room_id = ? AND user_id = ? LIMIT 1', [roomId, userId]);
      if (!check || check.length === 0) {
        socket.emit('game:error', { error: '不在房间内，无法加入语音' });
        return;
      }
      const voiceRoom = `game_voice:${roomId}`;
      socket.join(voiceRoom);

      const sockets = await io.in(voiceRoom).fetchSockets();
      const userIds = Array.from(new Set(sockets.map((s) => String(s.userId || s.data?.userId)).filter(Boolean)));

      socket.emit('game:voice:participants', { roomId, userIds });
      socket.to(voiceRoom).emit('game:voice:joined', { roomId, userId });
    } catch (error) {
      socket.emit('game:error', { error: '加入语音失败' });
    }
  });

  socket.on('game:voice:leave', async (data) => {
    try {
      const { roomId } = data || {};
      if (!roomId) return;
      const voiceRoom = `game_voice:${roomId}`;
      socket.to(voiceRoom).emit('game:voice:left', { roomId, userId });
      socket.leave(voiceRoom);
    } catch {
      socket.emit('game:error', { error: '退出语音失败' });
    }
  });

  socket.on('game:voice:signal', async (data) => {
    try {
      const { roomId, toId, type, signal } = data || {};
      if (!roomId || !toId || !type) return;
      const [check] = await query('SELECT id FROM game_room_players WHERE room_id = ? AND user_id = ? LIMIT 1', [roomId, userId]);
      if (!check || check.length === 0) return;
      const [checkTo] = await query('SELECT id FROM game_room_players WHERE room_id = ? AND user_id = ? LIMIT 1', [roomId, toId]);
      if (!checkTo || checkTo.length === 0) return;
      const voiceRoom = `game_voice:${roomId}`;

      const sockets = await io.in(voiceRoom).fetchSockets();
      for (const s of sockets) {
        if (String(s.userId || s.data?.userId) !== String(toId)) continue;
        s.emit('game:voice:signal', { roomId, fromId: userId, toId, type, signal });
      }
    } catch (error) {
      socket.emit('game:error', { error: '语音信令转发失败' });
    }
  });

  socket.on('game:player_ready', async (data) => {
    try {
      const { roomId, isReady } = data;
      
      await setPlayerReady(userId, roomId, isReady);
      
      io.to(`game_room:${roomId}`).emit('game:player_ready', {
        userId,
        roomId,
        isReady
      });

      if (isReady) {
        await attemptStartGame(io, roomId);
      }
    } catch (error) {
      console.error('设置准备状态失败:', error);
      socket.emit('game:error', { error: '设置准备状态失败' });
    }
  });

  socket.on('game:start', async (data) => {
    try {
      const { roomId } = data;
      const room = await getRoomById(roomId);
      
      // 检查权限：只有房主可以开始游戏
      if (String(room.creator_id) !== String(userId)) {
        socket.emit('game:error', { error: '只有房主可以开始游戏' });
        return;
      }

      // 检查人数和准备状态
      const players = room.players;
      if (players.length < room.min_players) {
        socket.emit('game:error', { error: `人数不足，至少需要 ${room.min_players} 人` });
        return;
      }

      const everyoneReady = players.every(p => {
        if (String(p.user_id) === String(room.creator_id)) return true;
        return !!p.is_ready;
      });
      if (!everyoneReady) {
        socket.emit('game:error', { error: '还有玩家未准备' });
        return;
      }

      // 手动触发开始
      await executeStartGame(io, roomId, players.map(p => p.user_id));
    } catch (error) {
      console.error('开始游戏失败:', error);
      socket.emit('game:error', { error: error?.message || '开始游戏失败' });
    }
  });

  // Unified Action Handler with Operation Lock
  socket.on('game:action', async (data) => {
    const lockOperationId = `action_${userId}_${Date.now()}`;
    
    try {
      const { roomId, action } = data;
      const payload = data.payload || {};
      const amount = payload.amount || data.amount || 0;
      
      if (!games.has(parseInt(roomId))) {
          socket.emit('game:error', { error: '游戏不存在' });
          return;
      }
      
      const game = games.get(parseInt(roomId));
      
      if (game.gameOver || game.__finishing) {
        socket.emit('game:error', { error: '游戏已结束' });
        return;
      }

      const currentPlayerId = game.getCurrentPlayerId ? game.getCurrentPlayerId() : 
                             game.playerIds?.[game.currentPlayerIndex];
      
      const gameState = game.getGameState ? game.getGameState() : {};
      const isSimultaneousGame = gameState.gameCode === 'niuniu' || gameState.gameCode === 'erbaban';
      
      if (!isSimultaneousGame && currentPlayerId && String(currentPlayerId) !== String(userId)) {
        socket.emit('game:error', { error: '不是你的回合' });
        return;
      }

      const lockContext = await getOrCreateRoomLock(roomId).acquire(lockOperationId, 5);

      if (!lockContext.isValid()) {
        socket.emit('game:error', { error: '操作过于频繁，请稍后再试' });
        return;
      }

      let result = null;
      let chipsToDeduct = 0;
      const previousBet = Number(game.playerBets?.[userId] || 0);

      try {
        switch (action) {
            case 'fold':
                if (typeof game.fold === 'function') {
                    result = game.fold(userId);
                } else {
                    throw new Error('该游戏不支持此操作');
                }
                break;
            case 'check':
                if (typeof game.check === 'function') {
                    result = game.check(userId);
                } else if (typeof game.call === 'function') {
                    result = game.call(userId);
                } else {
                    throw new Error('该游戏不支持此操作');
                }
                break;
            case 'call':
                if (typeof game.call === 'function') {
                    result = game.call(userId);
                } else {
                    const currentBet = game.currentBet;
                    const myBet = game.playerBets[userId] || 0;
                    const callAmt = currentBet - myBet;
                    result = game.bet(userId, callAmt);
                }
                break;
            case 'raise':
                if (typeof game.raise === 'function') {
                    result = game.raise(userId, amount);
                } else {
                    result = game.bet(userId, amount);
                }
                break;
            case 'see':
                if (typeof game.see !== 'function') {
                    throw new Error('该游戏不支持看牌');
                }
                result = game.see(userId);
                break;
            case 'compare':
                if (typeof game.compare !== 'function') {
                    throw new Error('该游戏不支持比牌');
                }
                if (!payload.targetId) {
                    throw new Error('缺少比牌目标');
                }
                result = game.compare(userId, payload.targetId);
                break;
            case 'move':
                if (typeof game.playMove === 'function') {
                  result = game.playMove(userId, payload.x, payload.y);
                  break;
                }
                if (typeof game.handleAction === 'function') {
                  result = game.handleAction(userId, action, payload);
                  break;
                }
                throw new Error('该游戏不支持此操作');
            default:
                if (typeof game.handleAction === 'function') {
                  result = game.handleAction(userId, action, payload);
                  break;
                }
                throw new Error('未知操作');
        }

        const updatedBet = Number(game.playerBets?.[userId] || 0);
        chipsToDeduct = Math.max(0, updatedBet - previousBet);
        if (chipsToDeduct > 0) {
            await deductChips(userId, chipsToDeduct, CHIP_TRANSACTION_TYPES.GAME_LOSS, '下注', game.gameId, 'game');
            io.to(`game_room:${roomId}`).emit('game:player_bet', {
                userId,
                amount: chipsToDeduct,
                gameId: game.gameId
            });
        }
        
        const updatedState = game.getGameState();
        io.to(`game_room:${roomId}`).emit('game:player_action', {
            userId,
            action,
            amount: chipsToDeduct,
            payload,
            currentPlayer: updatedState.currentPlayer,
            gameId: game.gameId
        });

        if (result) {
            if (game.__finishing) return;
            game.__finishing = true;
            await finishGame(io, roomId, game.gameId, result, lockContext);
            return;
        } else {
            io.to(`game_room:${roomId}`).emit('game:state_update', {
                roomId,
                gameState: game.getGameState()
            });
        }
      } finally {
        if (!result || !game.__finishing) {
          lockContext.release();
        }
      }
      
    } catch (error) {
      console.error('游戏操作失败:', error);
      socket.emit('game:error', { error: error.message || '操作失败' });
    }
  });

  // Keep existing handlers for chat/voice/loan
  socket.on('game:loan', async (data) => {
    try {
      const { roomId, gameId, amount } = data;
      const loan = await createLoan(userId, amount, 'inside', roomId, gameId);
      io.to(`game_room:${roomId}`).emit('game:player_loan', { userId, loan, gameId });
    } catch (error) {
      console.error('局内借贷失败:', error);
      socket.emit('game:error', { error: '借贷失败' });
    }
  });

  socket.on('game:chat', async (data) => {
    try {
      const { roomId, message, messageType = 'text' } = data;
      const [result] = await query(
        `INSERT INTO game_chat_messages (room_id, user_id, message_type, content) VALUES (?, ?, ?, ?)`,
        [roomId, userId, messageType, message]
      );
      const [user] = await query('SELECT username, nickname, avatar FROM users WHERE id = ?', [userId]);
      io.to(`game_room:${roomId}`).emit('game:chat_message', {
        id: result.insertId,
        roomId,
        room_id: roomId,
        userId,
        user_id: userId,
        username: user[0].username,
        nickname: user[0].nickname,
        avatar: user[0].avatar,
        message,
        content: message,
        messageType,
        message_type: messageType,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('发送游戏聊天失败:', error);
      socket.emit('game:error', { error: '发送消息失败' });
    }
  });

  socket.on('game:voice_start', async (data) => {
      try { io.to(`game_room:${data.roomId}`).emit('game:voice_started', { userId }); } catch (e) {}
  });

  socket.on('game:voice_stop', async (data) => {
      try { io.to(`game_room:${data.roomId}`).emit('game:voice_stopped', { userId }); } catch (e) {}
  });
}

async function finishGame(io, roomId, gameId, resultsData, lockContext = null) {
    try {
        const roomNumId = parseInt(roomId);
        const game = games.get(roomNumId);

        if (game) {
            clearAll托管Timers(game);
        }

        const settlementResult = await settleGame(io, roomId, game, resultsData, {
            useTransaction: true,
            validateIntegrity: true,
            lockContext
        });

        if (settlementResult.alreadySettled) {
            console.log(`游戏 ${gameId} 已经结算过，跳过`);
            return;
        }

        await query('UPDATE game_rooms SET status = "waiting" WHERE id = ?', [roomId]);
        await query('UPDATE game_room_players SET is_ready = FALSE WHERE room_id = ?', [roomId]);

        deleteGame(roomNumId);
        deleteRoomLock(roomNumId);

        io.to(`game_room:${roomId}`).emit('game:finished', {
            gameId,
            winnerId: settlementResult.winnerId,
            results: settlementResult.results,
            totalPot: settlementResult.totalPot,
            settledAt: settlementResult.settledAt
        });

        console.log(`[finishGame] 游戏 ${gameId} 结算完成`);

    } catch (error) {
        console.error('Finish game error:', error);

        try {
            const roomNumId = parseInt(roomId);
            const game = games.get(roomNumId);
            if (game) {
                clearAll托管Timers(game);
            }
        } catch (e) {
            console.error('清理托管Timer失败:', e);
        }

        try {
            await abortGame(null, gameId, 'settlement_error', {
                error: error.message,
                stack: error.stack
            });
        } catch (e) {
            console.error('中止游戏记录失败:', e);
        }

        try {
            await query('UPDATE game_rooms SET status = "waiting" WHERE id = ?', [roomId]);
            await query('UPDATE game_room_players SET is_ready = FALSE WHERE room_id = ?', [roomId]);
        } catch (e) {
            console.error('重置房间状态失败:', e);
        }

        try {
            deleteGame(parseInt(roomId));
            deleteRoomLock(parseInt(roomId));
        } catch (e) {
            console.error('清理游戏内存失败:', e);
        }

        try {
            io.to(`game_room:${roomId}`).emit('game:error', {
                error: '结算失败，已中止对局',
                code: 'SETTLEMENT_ERROR',
                message: error.message
            });
        } catch (e) {
            console.error('发送错误通知失败:', e);
        }
    }
}
