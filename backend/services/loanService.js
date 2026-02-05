import { query, transaction } from '../database/connection.js';
import { addChips, deductChips, CHIP_TRANSACTION_TYPES } from './chipsService.js';

export async function createLoan(userId, amount, loanType, roomId = null, gameId = null) {
  return await transaction(async (connection) => {
    // 检查粉丝数以确定最大借贷额度
    let maxLoan = 0;
    try {
      const [followStats] = await connection.query(
        'SELECT COUNT(*) as follower_count FROM user_follows WHERE following_id = ?',
        [userId]
      );
      const followerCount = followStats[0]?.follower_count || 0;
      maxLoan = followerCount * 1000;
    } catch (error) {
      console.warn('获取粉丝数失败，借贷额度受限:', error);
      maxLoan = 0;
    }

    // 检查当前已借贷总额 (Credit Limit)
    const [loanStats] = await connection.query(
      'SELECT SUM(amount) as total_borrowed FROM game_loans WHERE user_id = ? AND status = "active"',
      [userId]
    );
    const currentBorrowed = Number(loanStats[0]?.total_borrowed || 0);

    if (currentBorrowed + amount > maxLoan) {
      throw new Error(`借贷总额超过限制。当前已借 ${currentBorrowed}，此次申请 ${amount}，总额度 ${maxLoan} (粉丝数 ${maxLoan/1000 || 0})`);
    }

    if (amount <= 0) {
      throw new Error('借贷金额必须大于0');
    }

    // 利率改为每天5%
    const interestRate = 5; 
    // 初始应还 = 本金 (利息按天计算)
    const totalRepayment = amount;
    
    const dueDate = null; // 不再设死板的到期日，而是按天计息
    
    const [result] = await connection.query(
      `INSERT INTO game_loans (user_id, amount, interest_rate, loan_type, room_id, game_id, 
                              status, total_repayment, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())`,
      [userId, amount, interestRate, loanType, roomId, gameId, totalRepayment, dueDate]
    );
    
    await addChips(userId, amount, CHIP_TRANSACTION_TYPES.LOAN, `${loanType === 'outside' ? '局外' : '局内'}借贷`, result.insertId, 'loan');
    
    return {
      loanId: result.insertId,
      amount,
      interestRate,
      totalRepayment,
      dueDate,
      loanType
    };
  });
}

export async function repayLoan(userId, loanId, amount) {
  return await transaction(async (connection) => {
    const [loans] = await connection.query(
      'SELECT * FROM game_loans WHERE id = ? AND user_id = ? AND status = "active"',
      [loanId, userId]
    );
    
    if (!loans || loans.length === 0) {
      throw new Error('借贷记录不存在或已结清');
    }
    
    const loan = loans[0];
    
    // 动态计算应还总额：本金 * (1 + 0.05 * 天数)
    const now = new Date();
    const createdAt = new Date(loan.created_at);
    // 计算天数，不满一天按一天算
    let days = Math.ceil((now - createdAt) / (24 * 60 * 60 * 1000));
    if (days < 1) days = 1;
    
    let currentTotalRepayment;
    if (loan.interest_rate === 5) {
        const interest = Math.floor(loan.amount * 0.05 * days);
        currentTotalRepayment = loan.amount + interest;
    } else {
        // 旧逻辑兼容
        currentTotalRepayment = loan.total_repayment;
    }

    // 更新数据库中的 total_repayment 以保持一致性
    if (currentTotalRepayment !== loan.total_repayment) {
        await connection.query(
            'UPDATE game_loans SET total_repayment = ? WHERE id = ?',
            [currentTotalRepayment, loanId]
        );
        loan.total_repayment = currentTotalRepayment;
    }

    const remainingAmount = loan.total_repayment - loan.repaid_amount;
    
    if (amount > remainingAmount) {
      throw new Error(`还款金额超过应还金额 (当前应还 ${remainingAmount})`);
    }
    
    await deductChips(userId, amount, CHIP_TRANSACTION_TYPES.REPAY, `偿还借贷 #${loanId}`, loanId, 'loan');
    
    const newRepaidAmount = loan.repaid_amount + amount;
    const isFullyRepaid = newRepaidAmount >= loan.total_repayment;
    
    await connection.query(
      `UPDATE game_loans 
       SET repaid_amount = ?, status = ?, repaid_at = NOW()
       WHERE id = ?`,
      [newRepaidAmount, isFullyRepaid ? 'repaid' : 'active', loanId]
    );
    
    return {
      loanId,
      repaidAmount: newRepaidAmount,
      remainingAmount: remainingAmount - amount,
      isFullyRepaid
    };
  });
}

export async function getLoans(userId, status = null) {
  try {
    // 先更新所有 active 借贷的利息
    const [activeLoans] = await query(
        `SELECT id, amount, created_at, interest_rate, total_repayment 
         FROM game_loans 
         WHERE user_id = ? AND status = 'active' AND interest_rate = 5`,
        [userId]
    );

    const now = new Date();
    for (const loan of activeLoans) {
        const createdAt = new Date(loan.created_at);
        let days = Math.ceil((now - createdAt) / (24 * 60 * 60 * 1000));
        if (days < 1) days = 1;
        
        const interest = Math.floor(loan.amount * 0.05 * days);
        const newTotalRepayment = loan.amount + interest;
        
        if (newTotalRepayment !== loan.total_repayment) {
            await query(
                'UPDATE game_loans SET total_repayment = ? WHERE id = ?',
                [newTotalRepayment, loan.id]
            );
        }
    }

    let sql = `SELECT gl.*, gt.name as game_name, gr.name as room_name
              FROM game_loans gl
              LEFT JOIN game_types gt ON gl.game_id IS NOT NULL AND gt.id = (SELECT game_type_id FROM game_rooms WHERE id = gl.room_id)
              LEFT JOIN game_rooms gr ON gl.room_id IS NOT NULL AND gr.id = gl.room_id
              WHERE gl.user_id = ?`;
    const params = [userId];
    
    if (status) {
      sql += ' AND gl.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY gl.created_at DESC';
    
    const [rows] = await query(sql, params);
    
    return rows;
  } catch (error) {
    console.error('获取借贷记录失败:', error);
    throw error;
  }
}

export async function calculateLoanInterest() {
  return await transaction(async (connection) => {
    const now = new Date();
    
    const [activeLoans] = await connection.query(
      `SELECT * FROM game_loans 
       WHERE loan_type = 'outside' AND status = 'active' 
       AND due_date < NOW()`
    );
    
    for (const loan of activeLoans) {
      const dueDate = new Date(loan.due_date);
      const overdueDays = Math.floor((now - dueDate) / (24 * 60 * 60 * 1000)) + 1;
      
      if (overdueDays > loan.overdue_days) {
        const interestAmount = Math.floor(loan.amount * 0.25);
        const newTotalRepayment = loan.total_repayment + interestAmount;
        
        await connection.query(
          `UPDATE game_loans 
           SET overdue_days = ?, total_repayment = ?
           WHERE id = ?`,
          [overdueDays, newTotalRepayment, loan.id]
        );
      }
    }
    
    return { processed: activeLoans.length };
  });
}

export async function getDebtRanking(limit = 20) {
  try {
    const safeLimit = Number(limit) || 20;
    const [rows] = await query(
      `SELECT 
        u.id as user_id,
        u.username,
        u.nickname,
        u.avatar,
        SUM(
          (
            CASE 
              WHEN gl.interest_rate = 5 THEN 
                gl.amount + FLOOR(gl.amount * 0.05 * (TIMESTAMPDIFF(DAY, gl.created_at, NOW()) + 1))
              ELSE gl.total_repayment
            END
          ) - gl.repaid_amount
        ) as total_debt,
        COUNT(*) as active_loans
       FROM game_loans gl
       JOIN users u ON gl.user_id = u.id
       WHERE gl.status = 'active'
       GROUP BY gl.user_id
       HAVING total_debt > 0
       ORDER BY total_debt DESC
       LIMIT ?`,
      [safeLimit]
    );

    return rows;
  } catch (error) {
    console.error('获取欠款排行榜失败:', error);
    throw error;
  }
}

export async function getLoanSummary(userId) {
  try {
    const [summary] = await query(
      `SELECT 
        COUNT(*) as total_loans,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_loans,
        SUM(CASE WHEN status = 'repaid' THEN 1 ELSE 0 END) as repaid_loans,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_loans,
        SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as total_active_amount,
        SUM(
          CASE 
            WHEN status = 'active' THEN 
              CASE 
                WHEN interest_rate = 5 THEN 
                  amount + FLOOR(amount * 0.05 * (TIMESTAMPDIFF(DAY, created_at, NOW()) + 1)) - repaid_amount
                ELSE total_repayment - repaid_amount
              END
            ELSE 0 
          END
        ) as total_remaining_repayment
       FROM game_loans
       WHERE user_id = ?`,
      [userId]
    );
    
    return summary[0];
  } catch (error) {
    console.error('获取借贷汇总失败:', error);
    throw error;
  }
}
