import { query, transaction } from '../database/connection.js';
import { getDateString } from '../utils/date.js';

export const CHIP_TRANSACTION_TYPES = {
  CHECKIN: 'checkin',
  GAME_WIN: 'game_win',
  GAME_LOSS: 'game_loss',
  LOAN: 'loan',
  REPAY: 'repay',
  PURCHASE: 'purchase',
  REFUND: 'refund',
  OTHER: 'other'
};

export async function getUserChips(userId) {
  try {
    const [rows] = await query(
      'SELECT * FROM game_chips WHERE user_id = ?',
      [userId]
    );
    
    if (rows && rows.length > 0) {
      return rows[0];
    }
    
    return {
      user_id: userId,
      balance: 0,
      total_earned: 0,
      total_spent: 0
    };
  } catch (error) {
    console.error('获取用户筹码失败:', error);
    throw error;
  }
}

export async function ensureUserChips(userId) {
  try {
    const [existing] = await query(
      'SELECT id FROM game_chips WHERE user_id = ?',
      [userId]
    );
    
    if (!existing || existing.length === 0) {
      await query(
        'INSERT INTO game_chips (user_id, balance, total_earned, total_spent) VALUES (?, 0, 0, 0)',
        [userId]
      );
    }
  } catch (error) {
    console.error('确保用户筹码记录失败:', error);
    throw error;
  }
}

export async function addChips(userId, amount, type, description = null, relatedId = null, relatedType = null) {
  return await transaction(async (connection) => {
    await ensureUserChips(userId);
    
    const [chips] = await connection.query(
      'SELECT balance FROM game_chips WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    
    const currentBalance = chips[0].balance;
    const newBalance = currentBalance + amount;
    
    await connection.query(
      'UPDATE game_chips SET balance = ?, total_earned = total_earned + ? WHERE user_id = ?',
      [newBalance, amount > 0 ? amount : 0, userId]
    );
    
    await connection.query(
      `INSERT INTO chip_transactions (user_id, amount, balance_after, type, description, related_id, related_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, amount, newBalance, type, description, relatedId, relatedType]
    );
    
    return newBalance;
  });
}

export async function deductChips(userId, amount, type, description = null, relatedId = null, relatedType = null) {
  return await transaction(async (connection) => {
    await ensureUserChips(userId);
    
    const [chips] = await connection.query(
      'SELECT balance FROM game_chips WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    
    const currentBalance = chips[0].balance;
    
    if (currentBalance < amount) {
      throw new Error('筹码不足');
    }
    
    const newBalance = currentBalance - amount;
    
    await connection.query(
      'UPDATE game_chips SET balance = ?, total_spent = total_spent + ? WHERE user_id = ?',
      [newBalance, amount, userId]
    );
    
    await connection.query(
      `INSERT INTO chip_transactions (user_id, amount, balance_after, type, description, related_id, related_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, -amount, newBalance, type, description, relatedId, relatedType]
    );
    
    return newBalance;
  });
}

export async function getChipTransactions(userId, page = 1, limit = 20) {
  try {
    const offset = (page - 1) * limit;
    
    const [rows] = await query(
      `SELECT ct.*, u.username, u.nickname, u.avatar
       FROM chip_transactions ct
       LEFT JOIN users u ON ct.user_id = u.id
       WHERE ct.user_id = ?
       ORDER BY ct.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    const [count] = await query(
      'SELECT COUNT(*) as total FROM chip_transactions WHERE user_id = ?',
      [userId]
    );
    
    return {
      transactions: rows,
      total: count[0].total,
      page,
      limit,
      totalPages: Math.ceil(count[0].total / limit)
    };
  } catch (error) {
    console.error('获取筹码流水失败:', error);
    throw error;
  }
}

export async function getChipsRanking(limit = 20) {
  try {
    const [rows] = await query(
      `SELECT gc.*, u.username, u.nickname, u.avatar
       FROM game_chips gc
       JOIN users u ON gc.user_id = u.id
       WHERE u.status = 'active'
       ORDER BY gc.balance DESC
       LIMIT ?`,
      [limit]
    );
    
    return rows;
  } catch (error) {
    console.error('获取筹码排行榜失败:', error);
    throw error;
  }
}

export async function dailyCheckin(userId) {
  return await transaction(async (connection) => {
    const today = getDateString();
    
    const [existing] = await connection.query(
      'SELECT id, consecutive_days FROM game_checkins WHERE user_id = ? AND checkin_date = ?',
      [userId, today]
    );
    
    if (existing && existing.length > 0) {
      throw new Error('今日已签到');
    }
    
    const [lastCheckin] = await connection.query(
      `SELECT checkin_date, consecutive_days 
       FROM game_checkins 
       WHERE user_id = ? 
       ORDER BY checkin_date DESC 
       LIMIT 1`,
      [userId]
    );
    
    let consecutiveDays = 1;
    let rewardChips = 1000;
    
    if (lastCheckin && lastCheckin.length > 0) {
      const lastDateStr = getDateString(new Date(lastCheckin[0].checkin_date));
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = getDateString(yesterdayDate);
      
      if (lastDateStr === yesterdayStr) {
        consecutiveDays = lastCheckin[0].consecutive_days + 1;
        rewardChips = 1000 + (consecutiveDays - 1) * 200;
      }
    }
    
    await connection.query(
      'INSERT INTO game_checkins (user_id, checkin_date, consecutive_days, reward_chips) VALUES (?, ?, ?, ?)',
      [userId, today, consecutiveDays, rewardChips]
    );
    
    const newBalance = await addChips(userId, rewardChips, CHIP_TRANSACTION_TYPES.CHECKIN, `每日签到奖励（连续${consecutiveDays}天）`);
    
    return {
      rewardChips,
      consecutiveDays,
      newBalance
    };
  });
}

export async function getCheckinStatus(userId) {
  try {
    const today = getDateString();
    
    const [todayCheckin] = await query(
      'SELECT * FROM game_checkins WHERE user_id = ? AND checkin_date = ?',
      [userId, today]
    );
    
    const [lastCheckin] = await query(
      `SELECT checkin_date, consecutive_days 
       FROM game_checkins 
       WHERE user_id = ? 
       ORDER BY checkin_date DESC 
       LIMIT 1`,
      [userId]
    );
    
    return {
      hasCheckedIn: todayCheckin && todayCheckin.length > 0,
      consecutiveDays: lastCheckin && lastCheckin.length > 0 ? lastCheckin[0].consecutive_days : 0
    };
  } catch (error) {
    console.error('获取签到状态失败:', error);
    throw error;
  }
}
