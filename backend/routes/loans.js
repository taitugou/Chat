import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createLoan,
  repayLoan,
  getLoans,
  calculateLoanInterest,
  getLoanSummary,
  getDebtRanking
} from '../services/loanService.js';

const router = express.Router();

router.post('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, loanType, roomId, gameId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '借贷金额必须大于0' });
    }
    
    if (amount > 10000000) {
      return res.status(400).json({ success: false, message: '单次借贷金额不能超过1000万' });
    }
    
    if (!['outside', 'inside'].includes(loanType)) {
      return res.status(400).json({ success: false, message: '无效的借贷类型' });
    }
    
    if (loanType === 'inside' && (!roomId || !gameId)) {
      return res.status(400).json({ success: false, message: '局内借贷必须提供房间ID和游戏ID' });
    }
    
    const result = await createLoan(userId, amount, loanType, roomId, gameId);
    res.json({ 
      success: true, 
      ...result,
      message: `成功借贷 ${amount} 筹码，日利率5%，请按时还款`
    });
  } catch (error) {
    if (error.message.includes('超过限制') || error.message.includes('超过额度')) {
      res.status(400).json({ success: false, message: error.message });
    } else if (error.message.includes('必须大于0')) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      next(error);
    }
  }
});

router.post('/:loanId/repay', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { loanId } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '还款金额必须大于0' });
    }
    
    if (amount > 100000000) {
      return res.status(400).json({ success: false, message: '单次还款金额不能超过1亿' });
    }
    
    const result = await repayLoan(userId, loanId, amount);
    res.json({ 
      success: true, 
      ...result,
      message: result.isFullyRepaid ? '已全额还清贷款' : `成功还款 ${amount}，剩余应还 ${result.remainingAmount}`
    });
  } catch (error) {
    if (error.message === '借贷记录不存在或已结清' || error.message === '还款金额超过应还金额') {
      res.status(400).json({ success: false, message: error.message });
    } else if (error.message.includes('必须大于0')) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      next(error);
    }
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;
    const loans = await getLoans(userId, status);
    res.json({ loans });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const summary = await getLoanSummary(userId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/ranking/debt', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const ranking = await getDebtRanking(limit);
    res.json({ ranking });
  } catch (error) {
    next(error);
  }
});

router.post('/calculate-interest', authenticate, async (req, res, next) => {
  try {
    const result = await calculateLoanInterest();
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
