import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getUserChips,
  getChipTransactions,
  getChipsRanking,
  dailyCheckin,
  getCheckinStatus
} from '../services/chipsService.js';

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const chips = await getUserChips(userId);
    res.json({ chips });
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await getChipTransactions(userId, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/ranking', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const ranking = await getChipsRanking(limit);
    res.json({ ranking });
  } catch (error) {
    next(error);
  }
});

router.post('/checkin', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await dailyCheckin(userId);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message === '今日已签到') {
      res.status(400).json({ success: false, message: error.message });
    } else {
      next(error);
    }
  }
});

router.get('/checkin/status', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const status = await getCheckinStatus(userId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

export default router;
