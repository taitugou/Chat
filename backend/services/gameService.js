import { query } from '../database/connection.js';

export async function getGameTypes(category = null) {
  try {
    let sql = 'SELECT * FROM game_types WHERE is_active = TRUE';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    sql += ' ORDER BY sort_order ASC';
    
    const [rows] = await query(sql, params);
    
    return rows;
  } catch (error) {
    console.error('获取游戏类型失败:', error);
    throw error;
  }
}

export async function getGameTypeById(id) {
  try {
    const [rows] = await query(
      'SELECT * FROM game_types WHERE id = ? AND is_active = TRUE',
      [id]
    );
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('获取游戏类型失败:', error);
    throw error;
  }
}

export async function createGameRecord(roomId, gameTypeId, gameData) {
  try {
    const [result] = await query(
      `INSERT INTO game_records (room_id, game_type_id, total_pot, game_data, status, started_at)
       VALUES (?, ?, 0, ?, 'playing', NOW())`,
      [roomId, gameTypeId, JSON.stringify(gameData || {})]
    );
    
    return result.insertId;
  } catch (error) {
    console.error('创建游戏记录失败:', error);
    throw error;
  }
}

export async function updateGameRecord(gameId, updates) {
  try {
    const setClause = [];
    const params = [];
    
    if (updates.winnerId !== undefined) {
      setClause.push('winner_id = ?');
      params.push(updates.winnerId);
    }
    
    if (updates.totalPot !== undefined) {
      setClause.push('total_pot = ?');
      params.push(updates.totalPot);
    }
    
    if (updates.gameData !== undefined) {
      setClause.push('game_data = ?');
      params.push(JSON.stringify(updates.gameData));
    }
    
    if (updates.status !== undefined) {
      setClause.push('status = ?');
      params.push(updates.status);
    }
    
    if (updates.status === 'finished' || updates.status === 'aborted') {
      setClause.push('finished_at = NOW()');
    }
    
    if (setClause.length === 0) {
      return;
    }
    
    params.push(gameId);
    
    await query(
      `UPDATE game_records SET ${setClause.join(', ')} WHERE id = ?`,
      params
    );
    
    return { success: true };
  } catch (error) {
    console.error('更新游戏记录失败:', error);
    throw error;
  }
}

export async function createPlayerRecord(gameId, userId, playerData) {
  try {
    const { chipsChange, finalChips, position, handData } = playerData;
    
    const [result] = await query(
      `INSERT INTO game_player_records (game_id, user_id, chips_change, final_chips, position, hand_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [gameId, userId, chipsChange, finalChips, position, JSON.stringify(handData || {})]
    );
    
    return result.insertId;
  } catch (error) {
    console.error('创建玩家记录失败:', error);
    throw error;
  }
}

export async function getGameRecords(userId, filters = {}) {
  try {
    let sql = `SELECT gr.*, gt.name as game_name, gr.room_code,
                      u.username, u.nickname, u.avatar as winner_avatar
               FROM game_records gr
               JOIN game_types gt ON gr.game_type_id = gt.id
               JOIN game_rooms gr2 ON gr.room_id = gr2.id
               LEFT JOIN users u ON gr.winner_id = u.id
               WHERE 1=1`;
    const params = [];
    
    if (filters.userId) {
      sql += ' AND EXISTS (SELECT 1 FROM game_player_records gpr WHERE gpr.game_id = gr.id AND gpr.user_id = ?)';
      params.push(filters.userId);
    }
    
    if (filters.roomId) {
      sql += ' AND gr.room_id = ?';
      params.push(filters.roomId);
    }
    
    if (filters.status) {
      sql += ' AND gr.status = ?';
      params.push(filters.status);
    }
    
    sql += ' ORDER BY gr.created_at DESC';
    
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    const [rows] = await query(sql, params);
    
    return rows;
  } catch (error) {
    console.error('获取游戏记录失败:', error);
    throw error;
  }
}

export async function getGameRecordById(gameId) {
  try {
    const [games] = await query(
      `SELECT gr.*, gt.name as game_name, gr2.room_code, gr2.name as room_name,
              u.username, u.nickname, u.avatar as winner_avatar
       FROM game_records gr
       JOIN game_types gt ON gr.game_type_id = gt.id
       JOIN game_rooms gr2 ON gr.room_id = gr2.id
       LEFT JOIN users u ON gr.winner_id = u.id
       WHERE gr.id = ?`,
      [gameId]
    );
    
    if (!games || games.length === 0) {
      throw new Error('游戏记录不存在');
    }
    
    const game = games[0];
    
    const [players] = await query(
      `SELECT gpr.*, u.username, u.nickname, u.avatar
       FROM game_player_records gpr
       JOIN users u ON gpr.user_id = u.id
       WHERE gpr.game_id = ?
       ORDER BY gpr.position ASC`,
      [gameId]
    );
    
    return {
      ...game,
      players
    };
  } catch (error) {
    console.error('获取游戏记录详情失败:', error);
    throw error;
  }
}

export async function getGameStatistics(userId, gameTypeId = null) {
  try {
    let sql = `SELECT 
                COUNT(*) as total_games,
                SUM(CASE WHEN gpr.position = 1 THEN 1 ELSE 0 END) as total_wins,
                SUM(CASE WHEN gpr.chips_change > 0 THEN gpr.chips_change ELSE 0 END) as total_chips_earned,
                SUM(CASE WHEN gpr.chips_change < 0 THEN ABS(gpr.chips_change) ELSE 0 END) as total_chips_lost,
                MAX(CASE WHEN gpr.chips_change > 0 THEN gpr.chips_change ELSE 0 END) as max_win,
                MAX(CASE WHEN gpr.chips_change < 0 THEN ABS(gpr.chips_change) ELSE 0 END) as max_loss
               FROM game_player_records gpr
               JOIN game_records gr ON gpr.game_id = gr.id
               WHERE gpr.user_id = ?`;
    const params = [userId];
    
    if (gameTypeId) {
      sql += ' AND gr.game_type_id = ?';
      params.push(gameTypeId);
    }
    
    const [rows] = await query(sql, params);
    
    const stats = rows[0];
    stats.win_rate = stats.total_games > 0 ? (stats.total_wins / stats.total_games * 100).toFixed(2) : 0;
    
    return stats;
  } catch (error) {
    console.error('获取游戏统计失败:', error);
    throw error;
  }
}

export async function getWinRateRanking({ limit = 20, gameTypeId = null } = {}) {
  try {
    let sql = `SELECT 
                u.id as user_id,
                u.username,
                u.nickname,
                u.avatar,
                COUNT(*) as total_games,
                SUM(CASE WHEN gpr.position = 1 THEN 1 ELSE 0 END) as total_wins,
                ROUND(SUM(CASE WHEN gpr.position = 1 THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as win_rate
              FROM game_player_records gpr
              JOIN game_records gr ON gpr.game_id = gr.id
              JOIN users u ON gpr.user_id = u.id
              WHERE gr.status = 'finished'`;
    const params = [];

    if (gameTypeId) {
      sql += ' AND gr.game_type_id = ?';
      params.push(gameTypeId);
    }

    sql += ` GROUP BY gpr.user_id
             HAVING total_games > 0
             ORDER BY win_rate DESC, total_games DESC
             LIMIT ?`;
    params.push(Number(limit) || 20);

    const [rows] = await query(sql, params);
    return rows;
  } catch (error) {
    console.error('获取胜率排行榜失败:', error);
    throw error;
  }
}

export async function getEarningsRanking({ limit = 20, gameTypeId = null } = {}) {
  try {
    let sql = `SELECT 
                u.id as user_id,
                u.username,
                u.nickname,
                u.avatar,
                SUM(CASE WHEN gpr.chips_change > 0 THEN gpr.chips_change ELSE 0 END) as total_earned,
                MAX(CASE WHEN gpr.chips_change > 0 THEN gpr.chips_change ELSE 0 END) as max_win
              FROM game_player_records gpr
              JOIN game_records gr ON gpr.game_id = gr.id
              JOIN users u ON gpr.user_id = u.id
              WHERE gr.status = 'finished'`;
    const params = [];

    if (gameTypeId) {
      sql += ' AND gr.game_type_id = ?';
      params.push(gameTypeId);
    }

    sql += ` GROUP BY gpr.user_id
             HAVING total_earned > 0
             ORDER BY total_earned DESC, max_win DESC
             LIMIT ?`;
    params.push(Number(limit) || 20);

    const [rows] = await query(sql, params);
    return rows;
  } catch (error) {
    console.error('获取赢取排行榜失败:', error);
    throw error;
  }
}

export async function updateGameStatistics(userId, gameTypeId, chipsChange, position) {
  try {
    const [existing] = await query(
      'SELECT id FROM game_statistics WHERE user_id = ? AND (game_type_id = ? OR game_type_id IS NULL)',
      [userId, gameTypeId]
    );
    
    const totalGames = 1;
    const totalWins = position === 1 ? 1 : 0;
    const totalChipsEarned = chipsChange > 0 ? chipsChange : 0;
    const totalChipsLost = chipsChange < 0 ? Math.abs(chipsChange) : 0;
    const maxWin = chipsChange > 0 ? chipsChange : 0;
    const maxLoss = chipsChange < 0 ? Math.abs(chipsChange) : 0;
    const winRate = position === 1 ? 100 : 0;
    
    if (existing && existing.length > 0) {
      await query(
        `UPDATE game_statistics 
         SET total_games = total_games + ?,
             total_wins = total_wins + ?,
             total_chips_earned = total_chips_earned + ?,
             total_chips_lost = total_chips_lost + ?,
             max_win = GREATEST(max_win, ?),
             max_loss = GREATEST(max_loss, ?),
             win_rate = ?
         WHERE id = ?`,
        [totalGames, totalWins, totalChipsEarned, totalChipsLost, maxWin, maxLoss, winRate, existing[0].id]
      );
    } else {
      await query(
        `INSERT INTO game_statistics (user_id, game_type_id, total_games, total_wins, 
                                   total_chips_earned, total_chips_lost, max_win, max_loss, win_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, gameTypeId, totalGames, totalWins, totalChipsEarned, totalChipsLost, maxWin, maxLoss, winRate]
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error('更新游戏统计失败:', error);
    throw error;
  }
}
