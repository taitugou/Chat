import { query } from '../database/connection.js';
import { getRoomById, setPlayerReady, leaveRoom } from '../services/roomService.js';
import { createGameRecord, updateGameRecord } from '../services/gameService.js';
import { addChips, deductChips, getUserChips, CHIP_TRANSACTION_TYPES } from '../services/chipsService.js';
import { createLoan } from '../services/loanService.js';
import { createGameInstance } from '../services/gameFactory.js';
import { TexasHoldemGame } from '../services/games/poker/texasHoldem.js'; // Keep old reference if needed, but Factory is preferred

// In-memory game state storage
const games = new Map();
const readyTimers = new Map();

async function executeStartGame(io, roomId, playerIds) {
  try {
    const room = await getRoomById(roomId);
    if (room.status === 'playing') return;

    const [typeResult] = await query('SELECT code FROM game_types WHERE id = ?', [room.game_type_id]);
    const gameTypeCode = typeResult[0]?.code || 'texas_holdem';

    const game = createGameInstance(gameTypeCode, playerIds);
    const gameId = await createGameRecord(roomId, room.game_type_id, game.getGameState());
    game.gameId = gameId;
    games.set(parseInt(roomId), game);

    await query('UPDATE game_rooms SET status = "playing" WHERE id = ?', [roomId]);

    for (const [pid, amount] of Object.entries(game.playerBets)) {
      if (amount > 0) {
        await deductChips(parseInt(pid), amount, CHIP_TRANSACTION_TYPES.GAME_LOSS, '底注', gameId, 'game');
      }
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
  } catch (error) {
    console.error('executeStartGame error:', error);
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
      
      socket.leave(`game_room:${roomId}`);
      
      // 调用 roomService.leaveRoom，它现在会彻底删除玩家记录
      const result = await leaveRoom(userId, roomId);
      
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
          if (game.playerStatus && game.playerStatus[userId] === 'active') {
              try {
                  let result = null;
                  if (typeof game.fold === 'function') {
                      result = game.fold(userId);
                  } else if (typeof game.handleAction === 'function') {
                      result = game.handleAction(userId, 'surrender', {});
                  }
                  
                  if (result) {
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
      socket.emit('game:error', { error: '开始游戏失败' });
    }
  });

  // Unified Action Handler
  socket.on('game:action', async (data) => {
    try {
      const { roomId, action } = data;
      const payload = data.payload || {};
      const amount = payload.amount || data.amount || 0;
      
      if (!games.has(parseInt(roomId))) {
          socket.emit('game:error', { error: '游戏不存在' });
          return;
      }
      
      const game = games.get(parseInt(roomId));
      let result = null;
      let chipsToDeduct = 0;
      const previousBet = Number(game.playerBets?.[userId] || 0);
      
      // Generic Handler check
      if (typeof game.handleAction === 'function' && !['bet', 'call', 'raise', 'check', 'fold', 'compare'].includes(action)) {
             // Custom action (like 'move' in chess)
             result = game.handleAction(userId, action, payload);
             // Broadcast generic action
             io.to(`game_room:${roomId}`).emit('game:player_action', {
                userId,
                action,
                payload,
                gameId: game.gameId
             });
             
             if (result) {
                await finishGame(io, roomId, game.gameId, result);
             } else {
                io.to(`game_room:${roomId}`).emit('game:state_update', {
                    roomId,
                    gameState: game.getGameState()
                });
             }
             return;
      }

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
          case 'move': // Also allow 'move' for board games if not using handleAction
              if (typeof game.playMove === 'function') {
                  result = game.playMove(userId, payload.x, payload.y);
              } else {
                  throw new Error('该游戏不支持此操作');
              }
              break;
          default:
              throw new Error('未知操作');
      }

      // Deduct chips if needed
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
          await finishGame(io, roomId, game.gameId, result);
      } else {
          io.to(`game_room:${roomId}`).emit('game:state_update', {
              roomId,
              gameState: game.getGameState()
          });
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
        userId,
        username: user[0].username,
        nickname: user[0].nickname,
        avatar: user[0].avatar,
        message,
        messageType,
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

async function finishGame(io, roomId, gameId, resultsData) {
    try {
        const { winnerId, totalPot, results } = resultsData;
        
        // Process results
        for (const result of results) {
            const { userId, chipsChange, position } = result;
            
            if (chipsChange > 0) {
                await addChips(userId, chipsChange, CHIP_TRANSACTION_TYPES.GAME_WIN, '游戏胜利', gameId, 'game');
            }
            
            // Calculate net change for reporting
            const totalSpent = result.totalSpent || 0;
            const netChange = chipsChange - totalSpent;
            
            // Get current chips for final_chips recording
            const userChips = await getUserChips(userId);
            
            await query(
                `INSERT INTO game_player_records (game_id, user_id, chips_change, final_chips, position, hand_data)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [gameId, userId, netChange, userChips.balance, position, JSON.stringify(result.handData || result.hand || {})]
            );
        }
        
        await updateGameRecord(gameId, {
            winnerId,
            totalPot,
            status: 'finished'
        });
        
        await query('UPDATE game_rooms SET status = "waiting" WHERE id = ?', [roomId]);
        
        // 重置所有玩家的准备状态
        await query('UPDATE game_room_players SET is_ready = FALSE WHERE room_id = ?', [roomId]);
        
        // Remove game from memory
        games.delete(parseInt(roomId));

        io.to(`game_room:${roomId}`).emit('game:finished', {
            gameId,
            winnerId,
            results,
            totalPot
        });

    } catch (error) {
        console.error('Finish game error:', error);
    }
}
