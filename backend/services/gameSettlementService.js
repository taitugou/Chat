import { query, transaction } from '../database/connection.js';
import { addChips, deductChips, getUserChips, CHIP_TRANSACTION_TYPES } from './chipsService.js';
import { getGame, deleteGame } from './gameRegistry.js';
import { getOrCreateRoomLock } from './gameOperationLock.js';

const MAX_RETRY_COUNT = 3;
const SETTLEMENT_LOCK_TIMEOUT = 10000;

export class GameSettlementError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'GameSettlementError';
    this.code = code;
    this.details = details;
  }
}

export async function settleGame(io, roomId, game, resultsData, options = {}) {
  const lockId = `settle_${roomId}_${Date.now()}`;
  const lock = getOrCreateRoomLock(roomId);
  
  const hasExternalLock = options.lockContext && options.lockContext.isValid();
  
  let context;
  if (hasExternalLock) {
    context = options.lockContext;
  } else {
    context = await lock.acquire(lockId, 100);
    if (!context.isValid()) {
      throw new GameSettlementError(
        '结算锁获取失败，可能正在结算中',
        'SETTLEMENT_LOCK_FAILED'
      );
    }
  }

  try {
    const result = await executeSettlement(roomId, game, resultsData, options);

    io.to(`game_room:${roomId}`).emit('game:finished', {
      gameId: game.gameId,
      winnerId: result.winnerId,
      results: result.results,
      totalPot: result.totalPot,
      settledAt: new Date().toISOString()
    });

    return result;
  } finally {
    if (!hasExternalLock) {
      try {
        lock.releaseOperation(lockId);
      } catch (e) {
      }
    }
  }
}

async function executeSettlement(roomId, game, resultsData, options = {}) {
  const { winnerId, totalPot, results, reason = 'normal' } = resultsData;

  return await transaction(async (connection) => {
    const gameId = game.gameId;

    const [existingRecord] = await connection.query(
      `SELECT id, status FROM game_records WHERE id = ? FOR UPDATE`,
      [gameId]
    );

    if (!existingRecord || existingRecord.length === 0) {
      throw new GameSettlementError(
        '游戏记录不存在',
        'GAME_RECORD_NOT_FOUND',
        { gameId }
      );
    }

    if (existingRecord[0].status === 'finished') {
      console.warn(`游戏 ${gameId} 已经结算过，跳过重复结算`);
      return {
        gameId,
        winnerId,
        totalPot,
        results,
        alreadySettled: true
      };
    }

    if (existingRecord[0].status === 'aborted') {
      throw new GameSettlementError(
        '游戏已中止，无法结算',
        'GAME_ALREADY_ABORTED',
        { gameId }
      );
    }

    const processedResults = [];
    const playerRecordPromises = [];

    for (const result of results) {
      const { userId, chipsChange, position, handData, totalSpent = 0 } = result;

      if (chipsChange === 0) {
        processedResults.push({
          ...result,
          netChange: 0,
          finalBalance: await getUserChipsAfterSettlement(connection, userId)
        });
        continue;
      }

      let newBalance;
      if (chipsChange > 0) {
        newBalance = await addChipsWithConnection(connection, userId, chipsChange, CHIP_TRANSACTION_TYPES.GAME_WIN, `游戏胜利 - 排名 #${position}`, gameId, 'game');
      } else {
        const absLoss = Math.abs(chipsChange);
        await deductChipsWithConnection(connection, userId, absLoss, CHIP_TRANSACTION_TYPES.GAME_LOSS, `游戏失利 - 排名 #${position}`, gameId, 'game');
        const [chips] = await connection.query(
          `SELECT balance FROM game_chips WHERE user_id = ?`,
          [userId]
        );
        newBalance = chips[0]?.balance || 0;
      }

      const netChange = chipsChange - totalSpent;

      playerRecordPromises.push(
        connection.query(
          `INSERT INTO game_player_records (game_id, user_id, chips_change, final_chips, position, hand_data, net_change)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [gameId, userId, chipsChange, newBalance, position, JSON.stringify(handData || {}), netChange]
        )
      );

      processedResults.push({
        ...result,
        netChange,
        finalBalance: newBalance
      });
    }

    if (playerRecordPromises.length > 0) {
      await Promise.all(playerRecordPromises);
    }

    await connection.query(
      `UPDATE game_records
       SET winner_id = ?, total_pot = ?, status = 'finished', finished_at = NOW(), game_data = JSON_SET(COALESCE(game_data, '{}'), '$.settlement_reason', ?)
       WHERE id = ?`,
      [winnerId || null, totalPot, reason, gameId]
    );

    console.log(`[gameSettlement] 游戏 ${gameId} 结算完成 - 奖池: ${totalPot}, 胜利者: ${winnerId}`);

    return {
      gameId,
      winnerId,
      totalPot,
      results: processedResults,
      reason,
      settledAt: new Date().toISOString()
    };
  });
}

async function getUserChipsAfterSettlement(connection, userId) {
  const [chips] = await connection.query(
    `SELECT balance FROM game_chips WHERE user_id = ?`,
    [userId]
  );
  return chips[0]?.balance || 0;
}

async function addChipsWithConnection(connection, userId, amount, type, description, relatedId, relatedType) {
  await connection.query(
    `INSERT INTO game_chips (user_id, balance, total_earned)
     VALUES (?, 0, 0)
     ON DUPLICATE KEY UPDATE balance = balance + ?`,
    [userId, amount]
  );

  const [chips] = await connection.query(
    `SELECT balance FROM game_chips WHERE user_id = ?`,
    [userId]
  );
  const newBalance = chips[0].balance;

  await connection.query(
    `INSERT INTO chip_transactions (user_id, amount, balance_after, type, description, related_id, related_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, amount, newBalance, type, description, relatedId, relatedType]
  );

  return newBalance;
}

async function deductChipsWithConnection(connection, userId, amount, type, description, relatedId, relatedType) {
  const [chips] = await connection.query(
    `SELECT balance FROM game_chips WHERE user_id = ? FOR UPDATE`,
    [userId]
  );

  const currentBalance = chips[0]?.balance || 0;
  if (currentBalance < amount) {
    throw new GameSettlementError(
      `用户 ${userId} 筹码不足，需要 ${amount}，实际 ${currentBalance}`,
      'INSUFFICIENT_CHIPS',
      { userId, required: amount, actual: currentBalance }
    );
  }

  const newBalance = currentBalance - amount;

  await connection.query(
    `UPDATE game_chips SET balance = ?, total_spent = total_spent + ? WHERE user_id = ?`,
    [newBalance, amount, userId]
  );

  await connection.query(
    `INSERT INTO chip_transactions (user_id, amount, balance_after, type, description, related_id, related_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, -amount, newBalance, type, description, relatedId, relatedType]
  );

  return newBalance;
}

export async function abortGame(connection, gameId, reason = 'aborted', details = {}) {
  const [existing] = await connection.query(
    `SELECT id, status FROM game_records WHERE id = ? FOR UPDATE`,
    [gameId]
  );

  if (!existing || existing.length === 0) {
    throw new GameSettlementError('游戏记录不存在', 'GAME_RECORD_NOT_FOUND');
  }

  if (existing[0].status === 'finished') {
    throw new GameSettlementError('游戏已结束，无法中止', 'GAME_ALREADY_FINISHED');
  }

  await connection.query(
    `UPDATE game_records
     SET status = 'aborted',
         aborted_at = NOW(),
         game_data = JSON_SET(COALESCE(game_data, '{}'), '$.abort_reason', ?, '$.abort_details', ?)
     WHERE id = ?`,
    [reason, JSON.stringify(details), gameId]
  );

  return { success: true, gameId, reason };
}

export async function recoverAbortedGame(roomId, gameId) {
  const game = getGame(parseInt(roomId));
  if (!game) {
    throw new GameSettlementError('游戏实例不存在或已清除', 'GAME_INSTANCE_NOT_FOUND');
  }

  return await transaction(async (connection) => {
    const [records] = await connection.query(
      `SELECT * FROM game_records WHERE id = ? FOR UPDATE`,
      [gameId]
    );

    if (records[0].status !== 'aborted') {
      throw new GameSettlementError('只有已中止的游戏才能恢复', 'GAME_NOT_ABORTED');
    }

    await connection.query(
      `UPDATE game_records SET status = 'playing', aborted_at = NULL WHERE id = ?`,
      [gameId]
    );

    return { success: true, gameId, restoredAt: new Date().toISOString() };
  });
}

export async function validateSettlementIntegrity(gameId) {
  const [records] = await query(
    `SELECT gr.*, COUNT(gpr.id) as player_count
     FROM game_records gr
     LEFT JOIN game_player_records gpr ON gr.id = gpr.game_id
     WHERE gr.id = ?
     GROUP BY gr.id`,
    [gameId]
  );

  if (!records || records.length === 0) {
    return { valid: false, error: '游戏记录不存在' };
  }

  const record = records[0];
  const expectedPot = record.player_count * (record.base_bet || 0);

  if (Math.abs(record.total_pot - expectedPot) > 1) {
    return {
      valid: false,
      error: '奖池金额异常',
      details: {
        expected: expectedPot,
        actual: record.total_pot,
        difference: record.total_pot - expectedPot
      }
    };
  }

  const [chipTransactions] = await query(
    `SELECT SUM(CASE WHEN type = 'game_win' THEN amount ELSE 0 END) as total_wins,
            SUM(CASE WHEN type = 'game_loss' THEN ABS(amount) ELSE 0 END) as total_losses
     FROM chip_transactions
     WHERE related_id = ? AND related_type = 'game'`,
    [gameId]
  );

  const wins = chipTransactions[0]?.total_wins || 0;
  const losses = chipTransactions[0]?.total_losses || 0;

  if (Math.abs(wins - losses) > 1) {
    return {
      valid: false,
      error: '筹码流动不平衡',
      details: { totalWins: wins, totalLosses: losses, difference: wins - losses }
    };
  }

  return {
    valid: true,
    details: {
      playerCount: record.player_count,
      totalPot: record.total_pot,
      expectedPot,
      totalWins: wins,
      totalLosses: losses
    }
  };
}

export async function getSettlementReport(gameId) {
  const [gameRecord] = await query(
    `SELECT gr.*, gt.name as game_type_name
     FROM game_records gr
     JOIN game_types gt ON gr.game_type_id = gt.id
     WHERE gr.id = ?`,
    [gameId]
  );

  if (!gameRecord || gameRecord.length === 0) {
    throw new GameSettlementError('游戏记录不存在', 'GAME_RECORD_NOT_FOUND');
  }

  const [players] = await query(
    `SELECT gpr.*, u.username, u.nickname, u.avatar
     FROM game_player_records gpr
     JOIN users u ON gpr.user_id = u.id
     WHERE gpr.game_id = ?
     ORDER BY gpr.position ASC`,
    [gameId]
  );

  const [transactions] = await query(
    `SELECT ct.*, u.username, u.nickname
     FROM chip_transactions ct
     JOIN users u ON ct.user_id = u.id
     WHERE ct.related_id = ? AND ct.related_type = 'game'
     ORDER BY ct.created_at ASC`,
    [gameId]
  );

  const integrity = await validateSettlementIntegrity(gameId);

  return {
    game: gameRecord[0],
    players,
    transactions,
    integrity,
    generatedAt: new Date().toISOString()
  };
}
