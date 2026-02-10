import { query, transaction } from '../database/connection.js';

export async function createRoom(userId, roomData) {
  return await transaction(async (connection) => {
    const { gameTypeId, name, password, maxPlayers, minBet, maxBet, permission, settings } = roomData;
    
    // 验证游戏类型并获取人数限制
    const [gameTypes] = await connection.query(
      'SELECT * FROM game_types WHERE id = ? AND is_active = TRUE',
      [gameTypeId]
    );
    
    if (!gameTypes || gameTypes.length === 0) {
      console.error(`Invalid game type: ${gameTypeId}`);
      throw new Error('无效的游戏类型');
    }
    
    const gameType = gameTypes[0];
    
    // 确保 maxPlayers 是数字
    const numMaxPlayers = parseInt(maxPlayers);
    if (isNaN(numMaxPlayers) || numMaxPlayers < gameType.min_players || numMaxPlayers > gameType.max_players) {
      throw new Error(`该游戏的人数限制为 ${gameType.min_players}-${gameType.max_players} 人`);
    }

    // 验证房间名称
    if (!name || name.trim().length < 2 || name.length > 20) {
      throw new Error('房间名称长度需在 2-20 个字符之间');
    }

    // 验证筹码限制
    const numMinBet = parseInt(minBet || 0);
    const numMaxBet = parseInt(maxBet || 0);
    if (isNaN(numMinBet) || numMinBet < 0 || isNaN(numMaxBet) || numMaxBet < 0) {
      throw new Error('筹码限制必须是有效的数字');
    }
    if (numMaxBet > 0 && numMinBet > numMaxBet) {
      throw new Error('最低筹码限制不能高于最高筹码限制');
    }

    const roomCode = generateRoomCode();
    
    // 构建房间设置
    const roomSettings = {
      ...(settings || {}),
      minBet: numMinBet,
      maxBet: numMaxBet,
      permission: permission || 'public'
    };
    
    const [result] = await connection.query(
      `INSERT INTO game_rooms (room_code, game_type_id, creator_id, name, password, max_players, 
                              current_players, status, settings, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'waiting', ?, NOW())`,
      [roomCode, gameTypeId, userId, name, password, numMaxPlayers, JSON.stringify(roomSettings)]
    );
    
    const roomId = result.insertId;
    console.log(`Room created with ID: ${roomId}, Code: ${roomCode}`);
    
    await connection.query(
      `INSERT INTO game_room_players (room_id, user_id, seat_number, chips, is_ready, is_online)
       VALUES (?, ?, 1, 0, TRUE, TRUE)`,
      [roomId, userId]
    );
    
    return await getRoomById(roomId, connection);
  });
}

export async function joinRoom(userId, roomCode, password = null) {
  return await transaction(async (connection) => {
    // 首先查找房间，不限制状态，以便判断是否是重连
    const [rooms] = await connection.query(
      `SELECT gr.*, gt.min_players, gt.max_players
       FROM game_rooms gr
       JOIN game_types gt ON gr.game_type_id = gt.id
       WHERE gr.room_code = ?`,
      [roomCode]
    );
    
    if (!rooms || rooms.length === 0) {
      throw new Error('房间不存在');
    }
    
    const room = rooms[0];

    // 检查用户是否已经在房间中（重连逻辑）
    const [existing] = await connection.query(
      'SELECT id FROM game_room_players WHERE room_id = ? AND user_id = ?',
      [room.id, userId]
    );
    
    const isRejoining = existing && existing.length > 0;

    if (isRejoining) {
      // 如果是重连，更新在线状态并清除空房间标记
      await connection.query(
        'UPDATE game_room_players SET is_online = TRUE WHERE room_id = ? AND user_id = ?',
        [room.id, userId]
      );
      await connection.query(
        'UPDATE game_rooms SET empty_at = NULL WHERE id = ?',
        [room.id]
      );
    } else {
      // 如果是新加入，严格检查权限
      
      // 1. 检查房间状态
      if (room.status === 'closed') {
        throw new Error('房间已关闭');
      }
      
      // 允许在 waiting 或 playing 状态下加入
      // 如果是 playing 状态，中途加入逻辑由游戏逻辑处理
      if (room.status !== 'waiting' && room.status !== 'playing') {
        throw new Error('当前房间状态不允许加入');
      }
      
      // 2. 检查人数
      if (room.current_players >= room.max_players) {
        throw new Error('房间已满');
      }
      
      // 3. 检查房间权限设置
      const settings = typeof room.settings === 'string' ? JSON.parse(room.settings || '{}') : (room.settings || {});
      if (settings.permission === 'approval') {
        throw new Error('该房间需要房主同意才能进入');
      }

      // 4. 检查密码
      if (room.password && room.password !== password) {
        throw new Error('房间密码错误');
      }
      
      const [players] = await connection.query(
        'SELECT seat_number FROM game_room_players WHERE room_id = ? ORDER BY seat_number',
        [room.id]
      );

      const wasEmptyRoom = !players || players.length === 0;
      
      let nextSeat = 1;
      for (const player of players) {
        if (player.seat_number === nextSeat) {
          nextSeat++;
        } else {
          break;
        }
      }
      
      await connection.query(
        `INSERT INTO game_room_players (room_id, user_id, seat_number, chips, is_ready, is_online)
         VALUES (?, ?, ?, 0, TRUE, TRUE)`,
        [room.id, userId, nextSeat]
      );
      
      // 使用 COUNT(*) 强制同步人数，避免并发导致的计数错误
      if (wasEmptyRoom) {
        await connection.query(
          `UPDATE game_rooms 
           SET creator_id = ?,
               current_players = (SELECT COUNT(*) FROM game_room_players WHERE room_id = ?), 
               empty_at = NULL, 
               last_active_at = NOW() 
           WHERE id = ?`,
          [userId, room.id, room.id]
        );
      } else {
        await connection.query(
          `UPDATE game_rooms 
           SET current_players = (SELECT COUNT(*) FROM game_room_players WHERE room_id = ?), 
               empty_at = NULL, 
               last_active_at = NOW() 
           WHERE id = ?`,
          [room.id, room.id]
        );
      }
    }
    
    // 返回完整的房间信息
    return await getRoomById(room.id, connection);
  });
}

export async function leaveRoom(userId, roomId) {
  return await transaction(async (connection) => {
    const [players] = await connection.query(
      'SELECT * FROM game_room_players WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    
    if (!players || players.length === 0) {
      throw new Error('不在房间中');
    }
    
    const [roomInfo] = await connection.query(
      'SELECT creator_id, status FROM game_rooms WHERE id = ? FOR UPDATE',
      [roomId]
    );
    const room = roomInfo[0];
    
    await connection.query(
      'DELETE FROM game_room_players WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    
    const [remaining] = await connection.query(
      'SELECT COUNT(*) as count FROM game_room_players WHERE room_id = ?',
      [roomId]
    );
    
    const remainingCount = remaining[0].count;
    
    let newCreatorId = null;
    
    if (remainingCount === 0) {
      // 房间空了，设置 empty_at，6小时后会自动清理
      await connection.query(
        'UPDATE game_rooms SET status = "waiting", current_players = 0, empty_at = NOW(), last_active_at = NOW() WHERE id = ?',
        [roomId]
      );
    } else {
      // 还有人，检查房主是否离开
      if (userId === room.creator_id) {
        // 房主离开了，随机选择一个新房主
        const [remainingPlayers] = await connection.query(
          'SELECT user_id FROM game_room_players WHERE room_id = ?',
          [roomId]
        );
        
        if (remainingPlayers.length > 0) {
          const randomIndex = Math.floor(Math.random() * remainingPlayers.length);
          newCreatorId = remainingPlayers[randomIndex].user_id;
          
          await connection.query(
            'UPDATE game_rooms SET creator_id = ? WHERE id = ?',
            [newCreatorId, roomId]
          );
          console.log(`房间 ${roomId} 房主离开，新房主: ${newCreatorId}`);
        }
      }
      
      // 使用 COUNT(*) 强制同步人数
      await connection.query(
        `UPDATE game_rooms 
         SET current_players = (SELECT COUNT(*) FROM game_room_players WHERE room_id = ?), 
             last_active_at = NOW() 
         WHERE id = ?`,
        [roomId, roomId]
      );
    }
    
    return { success: true, remainingCount, newCreatorId };
  });
}

export async function getRooms(filters = {}) {
  try {
    let sql = `SELECT gr.*, gt.code as game_code, gt.name as game_name, gt.category, gt.min_players, gt.max_players as max_game_players,
                      u.username, u.nickname, u.avatar as creator_avatar,
                      (SELECT COUNT(*) FROM game_room_players grp WHERE grp.room_id = gr.id) as player_count
               FROM game_rooms gr
               JOIN game_types gt ON gr.game_type_id = gt.id
               JOIN users u ON gr.creator_id = u.id
               WHERE gr.status IN ('waiting', 'playing')
               `;
    const params = [];
    
    if (filters.gameTypeId) {
      sql += ' AND gr.game_type_id = ?';
      params.push(filters.gameTypeId);
    }
    
    if (filters.status) {
      sql += ' AND gr.status = ?';
      params.push(filters.status);
    }
    
    if (filters.search) {
      sql += ' AND (gr.name LIKE ? OR gr.room_code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    sql += ' ORDER BY gr.created_at DESC';
    
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    const [rows] = await query(sql, params);
    
    return rows;
  } catch (error) {
    console.error('获取房间列表失败:', error);
    throw error;
  }
}

export async function getRoomById(roomId, connection = null) {
  const db = connection || { query };
  try {
    // 兼容 ID 和 Room Code
    let roomSql = `SELECT gr.*, gt.code as game_code, gt.name as game_name, gt.category, gt.min_players, gt.max_players as max_game_players,
              u.username, u.nickname, u.avatar as creator_avatar
       FROM game_rooms gr
       JOIN game_types gt ON gr.game_type_id = gt.id
       JOIN users u ON gr.creator_id = u.id
       WHERE `;
    
    const params = [];
    if (!isNaN(parseInt(roomId))) {
      roomSql += `gr.id = ? OR gr.room_code = ?`;
      params.push(parseInt(roomId), roomId);
    } else {
      roomSql += `gr.room_code = ?`;
      params.push(roomId);
    }

    const [rooms] = await db.query(roomSql, params);
    
    if (!rooms || rooms.length === 0) {
      throw new Error('房间不存在');
    }
    
    const room = rooms[0];
    const actualRoomId = room.id;
    
    const [players] = await db.query(
      `SELECT grp.*, u.username, u.nickname, u.avatar, IFNULL(gc.balance, 0) as total_chips
       FROM game_room_players grp
       JOIN users u ON grp.user_id = u.id
       LEFT JOIN game_chips gc ON grp.user_id = gc.user_id
       WHERE grp.room_id = ?
       ORDER BY grp.seat_number`,
      [actualRoomId]
    );

    const creatorInRoom = (players || []).some(
      p => String(p.user_id) === String(room.creator_id)
    );

    if (!creatorInRoom && players && players.length > 0) {
      const newCreatorId = players[0].user_id;
      await db.query(
        'UPDATE game_rooms SET creator_id = ?, empty_at = NULL, last_active_at = NOW() WHERE id = ?',
        [newCreatorId, actualRoomId]
      );
      room.creator_id = newCreatorId;
    }
    
    return {
      ...room,
      players
    };
  } catch (error) {
    console.error('获取房间详情失败:', error);
    throw error;
  }
}

export async function updateRoomSettings(userId, roomId, settings) {
  try {
    const [rooms] = await query(
      'SELECT * FROM game_rooms WHERE id = ? AND creator_id = ?',
      [roomId, userId]
    );
    
    if (!rooms || rooms.length === 0) {
      throw new Error('无权修改房间设置');
    }
    
    await query(
      'UPDATE game_rooms SET settings = ? WHERE id = ?',
      [JSON.stringify(settings), roomId]
    );
    
    return { success: true };
  } catch (error) {
    console.error('更新房间设置失败:', error);
    throw error;
  }
}

export async function setPlayerReady(userId, roomId, isReady) {
  try {
    const [result] = await query(
      'UPDATE game_room_players SET is_ready = ? WHERE room_id = ? AND user_id = ?',
      [isReady, roomId, userId]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('不在房间中');
    }
    
    return { success: true, isReady };
  } catch (error) {
    console.error('设置准备状态失败:', error);
    throw error;
  }
}

export async function kickPlayer(creatorId, roomId, userIdToKick) {
  try {
    const [rooms] = await query(
      'SELECT * FROM game_rooms WHERE id = ? AND creator_id = ?',
      [roomId, creatorId]
    );
    
    if (!rooms || rooms.length === 0) {
      throw new Error('无权踢出玩家');
    }
    
    await query(
      'DELETE FROM game_room_players WHERE room_id = ? AND user_id = ?',
      [roomId, userIdToKick]
    );
    
    // 使用 COUNT(*) 强制同步人数
    await query(
      `UPDATE game_rooms 
       SET current_players = (SELECT COUNT(*) FROM game_room_players WHERE room_id = ?),
           last_active_at = NOW() 
       WHERE id = ?`,
      [roomId, roomId]
    );
    
    return { success: true };
  } catch (error) {
    console.error('踢出玩家失败:', error);
    throw error;
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
