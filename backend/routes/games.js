import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getGameTypes,
  getGameTypeById,
  createGameRecord,
  updateGameRecord,
  createPlayerRecord,
  getGameRecords,
  getGameRecordById,
  getGameStatistics,
  updateGameStatistics,
  getWinRateRanking,
  getEarningsRanking
} from '../services/gameService.js';

const router = express.Router();

router.get('/types', authenticate, async (req, res, next) => {
  try {
    const { category } = req.query;
    const gameTypes = await getGameTypes(category);
    res.json({ gameTypes });
  } catch (error) {
    next(error);
  }
});

router.get('/types/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const gameType = await getGameTypeById(id);
    if (!gameType) {
      return res.status(404).json({ success: false, message: '游戏类型不存在' });
    }
    res.json({ gameType });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { roomId, gameTypeId, gameData } = req.body;
    
    if (!roomId || !gameTypeId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    const gameId = await createGameRecord(roomId, gameTypeId, gameData);
    res.json({ success: true, gameId });
  } catch (error) {
    next(error);
  }
});

router.put('/:gameId', authenticate, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const updates = req.body;
    const result = await updateGameRecord(gameId, updates);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:gameId/players', authenticate, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const { userId, chipsChange, finalChips, position, handData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }
    
    const recordId = await createPlayerRecord(gameId, userId, {
      chipsChange,
      finalChips,
      position,
      handData
    });
    res.json({ success: true, recordId });
  } catch (error) {
    next(error);
  }
});

router.get('/records', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { roomId, status, limit } = req.query;
    const records = await getGameRecords({ userId, roomId, status, limit });
    res.json({ records });
  } catch (error) {
    next(error);
  }
});

router.get('/records/:gameId', authenticate, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const record = await getGameRecordById(gameId);
    res.json({ record });
  } catch (error) {
    if (error.message === '游戏记录不存在') {
      res.status(404).json({ success: false, message: error.message });
    } else {
      next(error);
    }
  }
});

router.get('/statistics', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { gameTypeId } = req.query;
    const stats = await getGameStatistics(userId, gameTypeId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/leaderboard/win-rate', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const gameTypeId = req.query.gameTypeId ? parseInt(req.query.gameTypeId) : null;
    const ranking = await getWinRateRanking({ limit, gameTypeId });
    res.json({ ranking });
  } catch (error) {
    next(error);
  }
});

router.get('/leaderboard/earnings', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const gameTypeId = req.query.gameTypeId ? parseInt(req.query.gameTypeId) : null;
    const ranking = await getEarningsRanking({ limit, gameTypeId });
    res.json({ ranking });
  } catch (error) {
    next(error);
  }
});

export default router;
