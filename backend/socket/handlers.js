import { query } from '../database/connection.js';
import { redisUtils } from '../database/redis.js';
import { filterSensitiveWords } from '../utils/sensitiveWords.js';
import { updateActiveUser, removeActiveUser, removeActiveSocket } from '../utils/activeTracker.js';
import { processMentions } from '../utils/mentionHelper.js';
import { enqueueMessage } from '../services/messageQueue.js';
import { initGameSocketHandlers } from './gameHandlers.js';
import { getRoomById, leaveRoom } from '../services/roomService.js';

async function cleanupUserGameRooms(io, userId, socket = null) {
  try {
    const [playerRooms] = await query('SELECT room_id FROM game_room_players WHERE user_id = ?', [userId]);
    if (playerRooms && playerRooms.length > 0) {
      for (const pr of playerRooms) {
        (async (roomId) => {
          try {
            const roomName = `game_room:${roomId}`;
            const GRACE_PERIOD = 5000; // 5秒宽限期
            
            // 立即标记为离线
            await query('UPDATE game_room_players SET is_online = FALSE WHERE room_id = ? AND user_id = ?', [roomId, userId]);
            
            // 无论是否有 socket，都延迟检查。
            // 这样如果是页面刷新，用户会有足够的时间在新的 Socket 中加入房间。
            setTimeout(async () => {
              try {
                // 重新获取房间的所有 Socket
                const socketsInRoom = await io.in(roomName).fetchSockets();
                // 检查是否该用户有任何活跃连接在房间里
                const hasActiveConnection = socketsInRoom.some(s => String(s.userId) === String(userId));
                
                if (!hasActiveConnection) {
                  // 如果真的没有连接了，才执行离开逻辑
                  await performLeave(io, userId, roomId, roomName, socket ? '房间连接断开' : '完全下线');
                } else {
                  // 如果有了新连接，确保 is_online 恢复为 TRUE
                  await query('UPDATE game_room_players SET is_online = TRUE WHERE room_id = ? AND user_id = ?', [roomId, userId]);
                  console.log(`用户 ${userId} 在宽限期内重新连接到房间 ${roomId}`);
                }
              } catch (e) {
                console.error(`宽限期检查出错: ${roomId}`, e);
              }
            }, GRACE_PERIOD);
          } catch (e) {
            console.error(`清理任务执行出错: ${roomId}`, e);
          }
        })(pr.room_id);
      }
    }
  } catch (error) {
    console.error('游戏房间下线清理整体失败:', error);
  }
}

async function performLeave(io, userId, roomId, roomName, reason) {
  try {
    // 再次检查数据库，确保用户还在房间里（可能在延迟期间已经通过其他方式离开了）
    const [check] = await query('SELECT id FROM game_room_players WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (!check || check.length === 0) return;

    const result = await leaveRoom(userId, roomId);
    io.to(roomName).emit('game:player_left', { userId });
    
    if (result.newCreatorId) {
      io.to(roomName).emit('game:owner_changed', {
        newOwnerId: result.newCreatorId,
        roomId: roomId
      });
    }
    
    console.log(`用户 ${userId} 离开房间 ${roomId} (原因: ${reason})`);
  } catch (error) {
    console.error(`执行离开房间失败 (用户 ${userId}, 房间 ${roomId}):`, error.message);
  }
}

export function initSocketHandlers(io, socket) {
  const userId = socket.userId;
  console.log('Socket.IO连接成功，用户ID:', userId, 'Socket ID:', socket.id);

  // 初始化时记录活跃状态
  updateActiveUser(userId, socket.id);

  initGameSocketHandlers(io, socket);

  // 心跳/活跃状态更新
  socket.on('user:heartbeat', (data) => {
    if (data && data.active) {
      updateActiveUser(userId, socket.id);
    }
  });

  // 用户上线
  socket.on('user:online', async (data = {}) => {
    const status = data.status === 'offline' ? 'offline' : 'online';
    console.log('收到user:online事件，用户ID:', userId, '状态:', status);

    if (status === 'offline') {
      const isFullyOffline = removeActiveSocket(userId, socket.id);
      
      if (isFullyOffline) {
        await query('UPDATE users SET online_status = ? WHERE id = ?', [status, userId]);
        
        // 清理游戏房间
        await cleanupUserGameRooms(io, userId);

        // 从在线用户列表移除
        const onlineUsersKey = 'users:online';
        let onlineUsers = await redisUtils.get(onlineUsersKey) || [];
        onlineUsers = onlineUsers.filter(id => id !== userId);
        await redisUtils.set(onlineUsersKey, onlineUsers, 3600);

        // 通知好友状态更新
        const [friends] = await query(
          `SELECT friend_id as friend_id FROM user_friends WHERE user_id = ?
           UNION
           SELECT user_id as friend_id FROM user_friends WHERE friend_id = ?`,
          [userId, userId]
        );

        friends.forEach(friend => {
          io.to(`user:${friend.friend_id}`).emit('friend:status_update', { userId, status });
        });

        io.emit('user:status_change', { userId, status });
      }
      return;
    }

    updateActiveUser(userId, socket.id);

    // 更新数据库中的在线状态（仅在线才刷新 last_login_at）
    await query('UPDATE users SET online_status = ?, last_login_at = NOW() WHERE id = ?', [status, userId]);

    // 记录登录日志 - 添加错误处理
    try {
      await query(
        'INSERT INTO user_login_logs (user_id, login_time, login_ip) VALUES (?, NOW(), ?)',
        [userId, socket.handshake.address]
      );
    } catch (logError) {
      console.debug('记录登录日志失败:', logError.message);
      // 如果表不存在，尝试创建表
      if (logError.code === 'ER_NO_SUCH_TABLE') {
        try {
          await query(`
            CREATE TABLE IF NOT EXISTS user_login_logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              login_time DATETIME NOT NULL,
              logout_time DATETIME,
              login_ip VARCHAR(45) NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
          `);
          // 重试记录登录日志
          await query(
            'INSERT INTO user_login_logs (user_id, login_time, login_ip) VALUES (?, NOW(), ?)',
            [userId, socket.handshake.address]
          );
        } catch (createError) {
          console.error('创建登录日志表失败:', createError);
        }
      } else if (logError.code === 'ER_BAD_FIELD_ERROR' && /login_ip/.test(logError.sqlMessage || '')) {
        // 兼容老版本缺少 login_ip 字段的情况：尝试添加列，否则降级为不记录IP
        try {
          await query(`ALTER TABLE user_login_logs ADD COLUMN login_ip VARCHAR(45) NULL`);
          await query(
            'INSERT INTO user_login_logs (user_id, login_time, login_ip) VALUES (?, NOW(), ?)',
            [userId, socket.handshake.address]
          );
        } catch (alterError) {
          console.warn('添加login_ip列失败，降级为不记录IP:', alterError.message);
          try {
            await query(
              'INSERT INTO user_login_logs (user_id, login_time) VALUES (?, NOW())',
              [userId]
            );
          } catch (fallbackError) {
            console.debug('降级写入登录日志失败:', fallbackError.message);
          }
        }
      }
    }

    // 添加到在线用户列表
    const onlineUsersKey = 'users:online';
    let onlineUsers = await redisUtils.get(onlineUsersKey) || [];
    if (!onlineUsers.includes(userId)) {
      onlineUsers.push(userId);
      await redisUtils.set(onlineUsersKey, onlineUsers, 3600);
    }

    // 加入用户专属房间
    socket.join(`user:${userId}`);

    // 加入所属的所有群聊房间
    try {
      const [userGroups] = await query(
        'SELECT group_id FROM chat_group_members WHERE user_id = ?',
        [userId]
      );
      if (userGroups && Array.isArray(userGroups)) {
        userGroups.forEach(group => {
          socket.join(`group:${group.group_id}`);
        });
      }
    } catch (err) {
      console.error('获取用户群聊失败:', err);
    }

    // 通知好友用户上线
    const [friends] = await query(
      `SELECT friend_id as friend_id FROM user_friends WHERE user_id = ?
       UNION
       SELECT user_id as friend_id FROM user_friends WHERE friend_id = ?`,
      [userId, userId]
    );

    friends.forEach(friend => {
      io.to(`user:${friend.friend_id}`).emit('friend:online', { userId, status });
    });

    // 特殊处理：如果是匹配进入的，可能不是好友关系，直接广播在线状态更新
    io.emit('user:status_change', { userId, status });
  });

  // 更新在线状态
  socket.on('status:update', async (data) => {
    const { status } = data;
    if (!['online', 'offline'].includes(status)) {
      return;
    }

    if (status === 'offline') {
      const isFullyOffline = removeActiveSocket(userId, socket.id);
      if (!isFullyOffline) return; // 还有其他连接，不处理状态变更
    } else {
      updateActiveUser(userId, socket.id);
    }
    
    // 更新数据库中的在线状态
    await query(
      'UPDATE users SET online_status = ? WHERE id = ?',
      [status, userId]
    );

    // 清理游戏房间（如果是完全下线）
    if (status === 'offline') {
      await cleanupUserGameRooms(io, userId);
    } else {
      // 如果恢复在线，确保游戏中房间的状态也同步
      await query(
        'UPDATE game_room_players SET is_online = TRUE WHERE user_id = ?',
        [userId]
      );
    }

    // 同步在线用户列表（用于在线统计）
    const onlineUsersKey = 'users:online';
    let onlineUsers = await redisUtils.get(onlineUsersKey) || [];
    if (status === 'online') {
      if (!onlineUsers.includes(userId)) onlineUsers.push(userId);
    } else {
      onlineUsers = onlineUsers.filter(id => id !== userId);
    }
    await redisUtils.set(onlineUsersKey, onlineUsers, 3600);
    
    // 通知好友状态更新
    const [friends] = await query(
      `SELECT friend_id as friend_id FROM user_friends WHERE user_id = ?
       UNION
       SELECT user_id as friend_id FROM user_friends WHERE friend_id = ?`,
      [userId, userId]
    );
    
    friends.forEach(friend => {
      io.to(`user:${friend.friend_id}`).emit('friend:status_update', { userId, status });
    });

    // 广播状态变更给所有监听者
    io.emit('user:status_change', { userId, status });
  });

  // 用户下线
  socket.on('disconnect', async () => {
    // 即使不是完全下线，也需要检查是否离开了游戏房间标签页
    await cleanupUserGameRooms(io, userId, socket);

    const isFullyOffline = removeActiveSocket(userId, socket.id);
    if (!isFullyOffline) {
      console.log('Socket断开，但用户仍有其他活跃连接:', userId);
      return;
    }

    console.log('用户完全下线:', userId);

    // 更新数据库中的在线状态为离线
    await query(
      'UPDATE users SET online_status = ?, last_login_at = NOW() WHERE id = ?',
      ['offline', userId]
    );

    // 此时 socket 已断开，调用 cleanupUserGameRooms(io, userId) 处理完全下线逻辑
    await cleanupUserGameRooms(io, userId);
    
    // 通知状态变更为离线
    io.emit('user:status_change', { userId, status: 'offline' });

    // 更新登录日志，记录登出时间 - 添加错误处理
    try {
      await query(
        `UPDATE user_login_logs 
         SET logout_time = NOW() 
         WHERE user_id = ? AND logout_time IS NULL 
         ORDER BY login_time DESC 
         LIMIT 1`,
        [userId]
      );
    } catch (logError) {
      console.debug('更新登录日志失败:', logError.message);
    }

    // 从在线用户列表移除
    const onlineUsersKey = 'users:online';
    let onlineUsers = await redisUtils.get(onlineUsersKey) || [];
    onlineUsers = onlineUsers.filter(id => id !== userId);
    await redisUtils.set(onlineUsersKey, onlineUsers, 3600);

    // 通知好友用户下线
    try {
      const [friends] = await query(
        `SELECT friend_id as friend_id FROM user_friends WHERE user_id = ?
         UNION
         SELECT user_id as friend_id FROM user_friends WHERE friend_id = ?`,
        [userId, userId]
      );

      friends.forEach(friend => {
        io.to(`user:${friend.friend_id}`).emit('friend:offline', { userId });
      });
    } catch (friendError) {
      console.debug('获取好友列表失败:', friendError.message);
    }
  });

  // 用户主动下线
  socket.on('user:offline', async () => {
    const isFullyOffline = removeActiveSocket(userId, socket.id);
    if (!isFullyOffline) return;

    // 更新数据库中的在线状态为离线
    await query(
      'UPDATE users SET online_status = ?, last_login_at = NOW() WHERE id = ?',
      ['offline', userId]
    );

    // 清理游戏房间
    await cleanupUserGameRooms(io, userId);
    
    // 更新登录日志，记录登出时间 - 添加错误处理
    try {
      await query(
        `UPDATE user_login_logs 
         SET logout_time = NOW() 
         WHERE user_id = ? AND logout_time IS NULL 
         ORDER BY login_time DESC 
         LIMIT 1`,
        [userId]
      );
    } catch (logError) {
      console.debug('更新登录日志失败:', logError.message);
    }

    // 从在线用户列表移除
    const onlineUsersKey = 'users:online';
    let onlineUsers = await redisUtils.get(onlineUsersKey) || [];
    onlineUsers = onlineUsers.filter(id => id !== userId);
    await redisUtils.set(onlineUsersKey, onlineUsers, 3600);

    // 通知好友用户下线
    try {
      const [friends] = await query(
        `SELECT friend_id as friend_id FROM user_friends WHERE user_id = ?
         UNION
         SELECT user_id as friend_id FROM user_friends WHERE friend_id = ?`,
        [userId, userId]
      );

      friends.forEach(friend => {
        io.to(`user:${friend.friend_id}`).emit('friend:offline', { userId });
      });
    } catch (friendError) {
      console.debug('获取好友列表失败:', friendError.message);
    }

    // 广播在线状态更新
    io.emit('user:status_change', { userId, status: 'offline' });
  });

  // 发送消息
  socket.on('message:send', async (data) => {
    try {
      const { receiverId, groupId, content, messageType = 'text', isSnapchat = false, snapchatDuration = 0 } = data;

      if ((!receiverId && !groupId) || !content) {
        socket.emit('message:error', { error: '消息格式错误' });
        return;
      }

      // 敏感词过滤
      let processedContent = filterSensitiveWords(content);

      // 阅后即焚时长限制（统一30秒）
      if (isSnapchat && snapchatDuration > 30) {
        socket.emit('message:error', { 
          error: '阅后即焚时长不能超过30秒',
          maxDuration: 30,
        });
        return;
      }

      let conversationId, queryParams, message, recipients;
      if (groupId) {
        // 群聊消息
        // 检查用户是否是群聊成员
        const [membership] = await query(
          `SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?`,
          [groupId, userId]
        );

        if (!membership || membership.length === 0) {
          socket.emit('message:error', { error: '你不是该群聊成员' });
          return;
        }

        // 获取群聊成员
        const [members] = await query(
          `SELECT user_id FROM chat_group_members WHERE group_id = ?`,
          [groupId]
        );
        recipients = members.map(m => m.user_id);

        conversationId = `group_${groupId}`;
        // 异步写入队列
        await enqueueMessage({
          sender_id: userId,
          receiver_id: null,
          group_id: groupId,
          conversation_id: conversationId,
          message_type: messageType,
          content: processedContent,
          is_snapchat: isSnapchat ? 1 : 0,
          snapchat_duration: snapchatDuration || 0,
          temp_id: Date.now()
        });

        message = {
          id: Date.now(),
          sender_id: userId,
          group_id: groupId,
          content: processedContent,
          message_type: messageType,
          is_snapchat: isSnapchat ? 1 : 0,
          snapchat_duration: snapchatDuration || 0,
          created_at: new Date(),
          is_temp: true
        };

        // 发送给所有群聊成员
        recipients.forEach(recipientId => {
          io.to(`user:${recipientId}`).emit('message:receive', message);
        });
      } else {
        // 私聊消息
        // 检查黑名单
        const [blacklist] = await query(
          'SELECT id FROM user_blacklist WHERE blocker_id = ? AND blocked_id = ?',
          [receiverId, userId]
        );

        if (blacklist && blacklist.length > 0) {
          socket.emit('message:error', { error: '你已被对方加入黑名单' });
          return;
        }

        // 支持临时房间 ID
        conversationId = data.roomId || [userId, receiverId].sort().join('_');
        // 异步写入队列
        await enqueueMessage({
          sender_id: userId,
          receiver_id: receiverId,
          group_id: null,
          conversation_id: conversationId,
          message_type: messageType,
          content: processedContent,
          is_snapchat: isSnapchat ? 1 : 0,
          snapchat_duration: snapchatDuration || 0,
          temp_id: Date.now()
        });

        message = {
          id: Date.now(),
          sender_id: userId,
          receiver_id: receiverId,
          conversation_id: conversationId,
          content: processedContent,
          message_type: messageType,
          is_snapchat: isSnapchat ? 1 : 0,
          snapchat_duration: snapchatDuration || 0,
          created_at: new Date(),
          is_temp: true
        };

        // 处理提及
        if (messageType === 'text') {
          await processMentions({
            content: processedContent,
            chatMessageId: message.id,
            userId: userId,
            io: io
          });
        }

        // 发送给接收者
        io.to(`user:${receiverId}`).emit('message:receive', message);
        // 同时发送给发送者（自己），确保自己的界面也能显示
        socket.emit('message:receive', message);
      }

      // 确认发送成功
      socket.emit('message:sent', { messageId: message.id });
    } catch (error) {
      console.error('发送消息错误:', error);
      socket.emit('message:error', { error: '发送消息失败' });
    }
  });

  // 正在输入
  socket.on('typing:start', (data) => {
    const { receiverId, groupId } = data;
    if (groupId) {
      // 群聊正在输入
      // 获取群聊成员
      query(
        `SELECT user_id FROM chat_group_members WHERE group_id = ?`,
        [groupId]
      ).then(([members]) => {
        members.forEach(m => {
          if (m.user_id !== userId) {
            io.to(`user:${m.user_id}`).emit('typing:start', { userId, groupId });
          }
        });
      }).catch(error => {
        console.error('获取群聊成员错误:', error);
      });
    } else {
      // 私聊正在输入
      io.to(`user:${receiverId}`).emit('typing:start', { userId });
    }
  });

  socket.on('typing:stop', (data) => {
    const { receiverId, groupId } = data;
    if (groupId) {
      // 群聊停止输入
      // 获取群聊成员
      query(
        `SELECT user_id FROM chat_group_members WHERE group_id = ?`,
        [groupId]
      ).then(([members]) => {
        members.forEach(m => {
          if (m.user_id !== userId) {
            io.to(`user:${m.user_id}`).emit('typing:stop', { userId, groupId });
          }
        });
      }).catch(error => {
        console.error('获取群聊成员错误:', error);
      });
    } else {
      // 私聊停止输入
      io.to(`user:${receiverId}`).emit('typing:stop', { userId });
    }
  });

  // 聊天页面进入/离开状态
  socket.on('chat:join', (data) => {
    const { receiverId, roomId } = data;
    if (receiverId) {
      // 加入一个特定的 Socket.IO 房间，以便于跟踪
      const roomName = roomId || [userId, receiverId].sort().join('_');
      socket.join(`chat_room:${roomName}`);
      
      // 通知对方我进来了
      io.to(`user:${receiverId}`).emit('chat:joined', { userId, roomId });
      
      // 检查对方是否已经在房间里
      const room = io.sockets.adapter.rooms.get(`chat_room:${roomName}`);
      if (room && room.size > 1) {
        // 如果房间人数大于 1，说明对方也在（或者是其他设备上的自己，但这里简化处理）
        socket.emit('chat:joined', { userId: receiverId, roomId });
      }
    }
  });

  socket.on('chat:leave', (data) => {
    const { receiverId, roomId } = data;
    if (receiverId) {
      const roomName = roomId || [userId, receiverId].sort().join('_');
      socket.leave(`chat_room:${roomName}`);
      
      // 通知对方我离开了
      io.to(`user:${receiverId}`).emit('chat:left', { userId, roomId });
    }
  });

  // 匹配系统
  socket.on('match:start', async (data) => {
    try {
      // 并行匹配：使用 Worker Threads
      const { runMatchTask } = await import('../services/workerPool.js');
      const { gender, isAnonymous } = data || {};
      const result = await runMatchTask({ userId, criteria: { gender } });

      if (result && result.ok) {
        socket.emit('match:success', { 
          user: result.user, 
          score: result.score,
          isAnonymous: isAnonymous || false
        });
      } else {
        socket.emit('match:failed', { error: '暂无合适的匹配用户' });
      }

      socket.emit('match:started', { message: '匹配已开始' });
    } catch (error) {
      console.error('匹配错误:', error);
      socket.emit('match:error', { error: '匹配失败' });
    }
  });

  // WebRTC P2P Signaling
  socket.on('webrtc:signal', (data) => {
    (async () => {
      const { targetId, signal, type, roomId, usage } = data || {};
      if (!targetId && !roomId) return;

      const payload = {
        fromId: userId,
        signal,
        type,
        roomId,
        usage,
        timestamp: Date.now()
      };

      if (targetId) {
        if (Number(targetId) === Number(userId)) return;

        const [blocked] = await query(
          'SELECT id FROM user_blacklist WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
          [targetId, userId, userId, targetId]
        );
        if (blocked && blocked.length > 0) {
          socket.emit('webrtc:error', { error: '双方存在黑名单关系，无法直连', targetId });
          return;
        }

        const [friends] = await query(
          'SELECT id FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?) LIMIT 1',
          [userId, targetId, targetId, userId]
        );
        if (!friends || friends.length === 0) {
          const conversationId = [userId, targetId].sort().join('_');
          const [messages] = await query('SELECT id FROM messages WHERE conversation_id = ? LIMIT 1', [conversationId]);
          if (!messages || messages.length === 0) {
            socket.emit('webrtc:error', { error: '无权限向该用户发起直连', targetId });
            return;
          }
        }

        io.to(`user:${targetId}`).emit('webrtc:signal', payload);
        return;
      }

      if (roomId) {
        const roomName = `chat_room:${roomId}`;
        if (!socket.rooms.has(roomName)) return;
        socket.to(roomName).emit('webrtc:signal', payload);
      }
    })().catch((error) => {
      console.error('webrtc:signal error:', error);
      socket.emit('webrtc:error', { error: '信令转发失败' });
    });
  });

  // Initiate P2P connection request
  socket.on('webrtc:call', (data) => {
    (async () => {
      const { targetId, roomId, type = 'data' } = data || {};
      const payload = {
        fromId: userId,
        type,
        roomId,
        timestamp: Date.now()
      };

      if (targetId) {
        if (Number(targetId) === Number(userId)) return;

        const [blocked] = await query(
          'SELECT id FROM user_blacklist WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
          [targetId, userId, userId, targetId]
        );
        if (blocked && blocked.length > 0) {
          socket.emit('webrtc:error', { error: '双方存在黑名单关系，无法直连', targetId });
          return;
        }

        const [friends] = await query(
          'SELECT id FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?) LIMIT 1',
          [userId, targetId, targetId, userId]
        );
        if (!friends || friends.length === 0) {
          const conversationId = [userId, targetId].sort().join('_');
          const [messages] = await query('SELECT id FROM messages WHERE conversation_id = ? LIMIT 1', [conversationId]);
          if (!messages || messages.length === 0) {
            socket.emit('webrtc:error', { error: '无权限向该用户发起直连', targetId });
            return;
          }
        }

        io.to(`user:${targetId}`).emit('webrtc:call', payload);
        return;
      }

      if (roomId) {
        const roomName = `chat_room:${roomId}`;
        if (!socket.rooms.has(roomName)) return;
        socket.to(roomName).emit('webrtc:call', payload);
      }
    })().catch((error) => {
      console.error('webrtc:call error:', error);
      socket.emit('webrtc:error', { error: '直连请求失败' });
    });
  });
}
