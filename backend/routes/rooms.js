import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query, transaction } from '../database/connection.js';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRooms,
  getRoomById,
  updateRoomSettings,
  setPlayerReady,
  kickPlayer
} from '../services/roomService.js';

export default function roomsRoutes(io) {
  const router = express.Router();

  router.post('/', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { gameTypeId, name, password, maxPlayers, minBet, maxBet, permission, settings } = req.body;
      
      if (!gameTypeId || !name || !maxPlayers) {
        return res.status(400).json({ success: false, message: '缺少必要参数' });
      }
      
      const room = await createRoom(userId, { 
        gameTypeId, 
        name, 
        password, 
        maxPlayers, 
        minBet, 
        maxBet, 
        permission,
        settings 
      });
      res.json({ success: true, room });
    } catch (error) {
      const message = error?.message || '';
      const isBadRequest =
        message.includes('无效的游戏类型') ||
        message.includes('人数限制') ||
        message.includes('房间名称长度') ||
        message.includes('筹码限制') ||
        message.includes('最低筹码限制不能高于最高筹码限制');
      if (isBadRequest) {
        return res.status(400).json({ success: false, message });
      }
      next(error);
    }
  });

  router.post('/join', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { roomCode, password } = req.body;
      
      if (!roomCode) {
        return res.status(400).json({ success: false, message: '房间代码不能为空' });
      }
      
      const room = await joinRoom(userId, roomCode, password);
      
      if (io) {
        io.to(`game_room:${room.id}`).emit('game:player_joined', {
          userId,
          roomId: room.id,
          room
        });
      }
      
      res.json({ success: true, room });
    } catch (error) {
      if (error.message === '房间不存在或已开始游戏' || 
          error.message === '房间已满' || 
          error.message === '房间密码错误' || 
          error.message === '该房间需要房主同意才能进入' ||
          error.message === '已在房间中') {
        res.status(400).json({ success: false, message: error.message });
      } else {
        next(error);
      }
    }
  });

  router.post('/:roomId/leave', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const result = await leaveRoom(userId, roomId);
      
      if (io) {
        io.to(`game_room:${roomId}`).emit('game:player_left', {
          userId,
          roomId: parseInt(roomId)
        });
      }
      
      res.json({ success: true, ...result });
    } catch (error) {
      if (error.message === '不在房间中') {
        res.status(400).json({ success: false, message: error.message });
      } else {
        next(error);
      }
    }
  });

  router.post('/leave-all', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const [playerRooms] = await query(
        'SELECT room_id FROM game_room_players WHERE user_id = ?',
        [userId]
      );
      
      let leftRooms = 0;
      for (const playerRoom of playerRooms) {
        try {
          await leaveRoom(userId, playerRoom.room_id);
          leftRooms++;
        } catch (e) {
          console.log(`离开房间 ${playerRoom.room_id} 失败:`, e.message);
        }
      }
      
      res.json({ success: true, leftRooms });
    } catch (error) {
      console.error('离开所有房间失败:', error);
      res.status(500).json({ success: false, message: '离开房间失败' });
    }
  });

  router.get('/', authenticate, async (req, res, next) => {
    try {
      const { gameTypeId, status, search, limit } = req.query;
      const rooms = await getRooms({ gameTypeId, status, search, limit });
      res.json({ rooms });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:roomId', authenticate, async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const room = await getRoomById(roomId);
      res.json({ room });
    } catch (error) {
      if (error.message === '房间不存在') {
        res.status(404).json({ success: false, message: error.message });
      } else {
        next(error);
      }
    }
  });

  router.put('/:roomId/settings', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { settings } = req.body;
      
      const result = await updateRoomSettings(userId, roomId, settings);
      res.json(result);
    } catch (error) {
      if (error.message === '无权修改房间设置') {
        res.status(403).json({ success: false, message: error.message });
      } else {
        next(error);
      }
    }
  });

  router.post('/:roomId/ready', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const { isReady } = req.body;
      
      await setPlayerReady(userId, roomId, isReady);
      
      if (io) {
        io.to(`game_room:${roomId}`).emit('game:player_ready', {
          userId,
          roomId: parseInt(roomId),
          isReady
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      if (error.message === '不在房间中') {
        res.status(400).json({ success: false, message: error.message });
      } else {
        next(error);
      }
    }
  });

  router.post('/:roomId/kick', authenticate, async (req, res, next) => {
    try {
      const creatorId = req.user.id;
      const { roomId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ success: false, message: '缺少玩家ID' });
      }
      
      const result = await kickPlayer(creatorId, roomId, userId);
      if (io) {
        const roomName = `game_room:${roomId}`;
        io.to(roomName).emit('game:player_left', { userId, roomId: parseInt(roomId) });
        const sockets = await io.in(roomName).fetchSockets();
        for (const s of sockets) {
          if (String(s.userId) === String(userId)) {
            s.emit('game:kicked', { roomId: parseInt(roomId) });
            s.leave(roomName);
          }
        }
      }
      res.json(result);
    } catch (error) {
      if (error.message === '无权踢出玩家') {
        res.status(403).json({ success: false, message: error.message });
      } else {
        next(error);
      }
    }
  });

  router.post('/:roomId/destroy', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;

      const result = await transaction(async (connection) => {
        const [rooms] = await connection.query(
          'SELECT * FROM game_rooms WHERE id = ? FOR UPDATE',
          [roomId]
        );

        if (!rooms || rooms.length === 0) {
          return { status: 404, body: { success: false, message: '房间不存在' } };
        }

        const room = rooms[0];

        if (String(room.creator_id) !== String(userId)) {
          return { status: 403, body: { success: false, message: '只有创建者可以销毁房间' } };
        }

        await connection.query('DELETE FROM game_room_players WHERE room_id = ?', [roomId]);
        await connection.query('DELETE FROM game_chat_messages WHERE room_id = ?', [roomId]);
        await connection.query('DELETE FROM game_rooms WHERE id = ?', [roomId]);

        return { status: 200, body: { success: true, message: '房间已销毁' } };
      });

      if (result.status !== 200) {
        return res.status(result.status).json(result.body);
      }

      if (io) {
        io.to(`game_room:${roomId}`).emit('game:room_destroyed', { roomId: parseInt(roomId) });
      }

      res.json(result.body);
    } catch (error) {
      console.error('销毁房间失败:', error);
      res.status(500).json({ success: false, message: '销毁房间失败' });
    }
  });

  router.get('/:roomId/chat', authenticate, async (req, res) => {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;
      const limitRaw = String(req.query.limit || '50');
      const limit = Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 50));

      const [check] = await query('SELECT id FROM game_room_players WHERE room_id = ? AND user_id = ? LIMIT 1', [roomId, userId]);
      if (!check || check.length === 0) {
        return res.status(403).json({ success: false, message: '无权查看该房间聊天记录' });
      }

      const [rows] = await query(
        `SELECT m.id, m.room_id, m.user_id, m.message_type, m.content, m.created_at,
                u.username, u.nickname, u.avatar
           FROM game_chat_messages m
           JOIN users u ON u.id = m.user_id
          WHERE m.room_id = ?
          ORDER BY m.id DESC
          LIMIT ?`,
        [roomId, limit]
      );

      const messages = Array.isArray(rows) ? rows.slice().reverse() : [];
      res.json({ success: true, messages });
    } catch (error) {
      console.error('获取房间聊天记录失败:', error);
      res.status(500).json({ success: false, message: '获取聊天记录失败' });
    }
  });

  return router;
}
