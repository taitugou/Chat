import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';
import {
  addPoints,
  deductPoints,
  getUserPoints,
  getPointsRecords,
  getPointsRanking,
  POINTS_REWARDS
} from '../services/pointsService.js';

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const points = await getUserPoints(userId);
    res.json({ points });
  } catch (error) {
    next(error);
  }
});

router.get('/records', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await getPointsRecords(userId, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/ranking', authenticate, cacheMiddleware(60), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const ranking = await getPointsRanking(userId, limit);
    res.json({ ranking });
  } catch (error) {
    next(error);
  }
});

router.get('/rules', cacheMiddleware(3600), (req, res) => {
  res.json({ rules: POINTS_REWARDS });
});

export default router;
