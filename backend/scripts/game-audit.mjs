import mysql from 'mysql2/promise';
import assert from 'node:assert/strict';
import { config } from '../config.js';

const LIMIT = Math.max(1, Number(process.env.LIMIT || 200));
const FAIL_ON = (process.env.FAIL_ON || 'error').toLowerCase(); // error | warn | none

const HOUSE_LIKE = new Set(['blackjack', 'touzi_bao', 'erbaban']);

function severityRank(level) {
  if (level === 'error') return 3;
  if (level === 'warn') return 2;
  return 1;
}

function shouldFail(level) {
  if (FAIL_ON === 'none') return false;
  if (FAIL_ON === 'warn') return severityRank(level) >= severityRank('warn');
  return severityRank(level) >= severityRank('error');
}

function fmt(n) {
  return Number(n || 0).toString();
}

async function main() {
  const pool = await mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: config.database.charset || 'utf8mb4'
  });

  const [games] = await pool.query(
    `SELECT gr.id, gr.room_id, gr.game_type_id, gr.winner_id, gr.total_pot, gr.status, gr.created_at,
            gt.code AS game_code
     FROM game_records gr
     JOIN game_types gt ON gr.game_type_id = gt.id
     ORDER BY gr.id DESC
     LIMIT ?`,
    [LIMIT]
  );

  const anomalies = [];
  const participants = new Set();

  for (const g of games) {
    const gameId = Number(g.id);
    const gameCode = String(g.game_code || '');

    const [prs] = await pool.query(
      `SELECT user_id, chips_change, final_chips, position
       FROM game_player_records
       WHERE game_id = ?`,
      [gameId]
    );

    const [txs] = await pool.query(
      `SELECT user_id, amount, type
       FROM chip_transactions
       WHERE related_type = 'game' AND related_id = ? AND type IN ('game_win','game_loss')`,
      [gameId]
    );

    for (const r of prs) participants.add(Number(r.user_id));
    for (const t of txs) participants.add(Number(t.user_id));

    const txSum = txs.reduce((s, t) => s + Number(t.amount || 0), 0);
    const betSum = txs.filter((t) => t.type === 'game_loss').reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
    const payoutSum = txs.filter((t) => t.type === 'game_win').reduce((s, t) => s + Number(t.amount || 0), 0);

    const isHouseLike = HOUSE_LIKE.has(gameCode);

    if (String(g.status) === 'finished') {
      const pos1 = prs.filter((r) => Number(r.position) === 1);
      if (pos1.length !== 1) {
        anomalies.push({
          level: 'error',
          gameId,
          gameCode,
          msg: `finished 但 position=1 记录数=${pos1.length}`
        });
      } else if (String(pos1[0].user_id) !== String(g.winner_id)) {
        anomalies.push({
          level: 'error',
          gameId,
          gameCode,
          msg: `winner_id 不匹配：game_records=${g.winner_id} player_records=${pos1[0].user_id}`
        });
      }

      if (!g.winner_id) {
        anomalies.push({ level: 'error', gameId, gameCode, msg: 'finished 但 winner_id 为 NULL' });
      }

      if (prs.length < 2) {
        anomalies.push({ level: 'warn', gameId, gameCode, msg: `finished 但玩家记录数=${prs.length}` });
      }
    }

    if (String(g.status) === 'aborted' && prs.length > 0) {
      anomalies.push({ level: 'warn', gameId, gameCode, msg: `aborted 但仍写入玩家记录数=${prs.length}` });
    }

    if (betSum > 0) {
      if (!isHouseLike && txSum !== 0) {
        anomalies.push({
          level: 'warn',
          gameId,
          gameCode,
          msg: `资金不闭合 txSum=${fmt(txSum)} betSum=${fmt(betSum)} payoutSum=${fmt(payoutSum)}`
        });
      }

      if (payoutSum > betSum) {
        anomalies.push({
          level: isHouseLike ? 'warn' : 'error',
          gameId,
          gameCode,
          msg: `疑似筹码通胀 payoutSum(${fmt(payoutSum)}) > betSum(${fmt(betSum)})`
        });
      }

      if (Number(g.total_pot || 0) > 0 && Math.abs(Number(g.total_pot || 0) - betSum) > 0) {
        anomalies.push({
          level: 'warn',
          gameId,
          gameCode,
          msg: `total_pot(${fmt(g.total_pot)}) 与 betSum(${fmt(betSum)}) 不一致`
        });
      }
    }
  }

  const participantIds = Array.from(participants);
  if (participantIds.length > 0) {
    const [balances] = await pool.query(
      `SELECT user_id, balance FROM game_chips WHERE user_id IN (${participantIds.map(() => '?').join(',')})`,
      participantIds
    );
    const balanceMap = new Map(balances.map((r) => [Number(r.user_id), Number(r.balance || 0)]));

    const [latestTx] = await pool.query(
      `SELECT t.user_id, t.balance_after
       FROM chip_transactions t
       JOIN (
         SELECT user_id, MAX(id) AS max_id
         FROM chip_transactions
         WHERE user_id IN (${participantIds.map(() => '?').join(',')})
         GROUP BY user_id
       ) x ON x.user_id = t.user_id AND x.max_id = t.id`,
      participantIds
    );

    for (const r of latestTx) {
      const uid = Number(r.user_id);
      const after = Number(r.balance_after || 0);
      const bal = Number(balanceMap.get(uid) || 0);
      if (after !== bal) {
        anomalies.push({
          level: 'warn',
          gameId: null,
          gameCode: null,
          msg: `余额快照不一致 user=${uid} latestTx=${after} game_chips=${bal}`
        });
      }
    }
  }

  const counts = {
    error: anomalies.filter((a) => a.level === 'error').length,
    warn: anomalies.filter((a) => a.level === 'warn').length
  };

  process.stdout.write(`game-audit: checked=${games.length} anomalies=${JSON.stringify(counts)}\n`);
  for (const a of anomalies.slice(0, 50)) {
    const g = a.gameId ? `game=${a.gameId}` : 'game=NA';
    const c = a.gameCode ? `code=${a.gameCode}` : 'code=NA';
    process.stdout.write(`[${a.level}] ${g} ${c} ${a.msg}\n`);
  }

  if (anomalies.some((a) => shouldFail(a.level))) {
    throw new Error(`game-audit failed: ${counts.error} errors, ${counts.warn} warnings`);
  }

  await pool.end();
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
