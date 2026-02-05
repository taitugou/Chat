import { parentPort } from 'worker_threads';
import { initDatabase } from '../database/connection.js';
import { query } from '../database/connection.js';
import { calculateMatchScore } from '../utils/matchAlgorithm.js';

let initialized = false;
async function ensureInit() {
  if (initialized) return;
  await initDatabase();
  initialized = true;
}

parentPort.on('message', async (msg) => {
  const { id, type, payload } = msg || {};
  if (type !== 'match') {
    parentPort.postMessage({ id, ok: false, error: 'Unknown task type' });
    return;
  }
  try {
    await ensureInit();
    const { userId, criteria = {} } = payload || {};

    const [blacklistRows] = await query(
      'SELECT blocked_id FROM user_blacklist WHERE blocker_id = ?',
      [userId]
    );
    const blockedIds = (blacklistRows || []).map(b => b.blocked_id);
    blockedIds.push(userId);

    let sql = `SELECT id FROM users WHERE id NOT IN (${blockedIds.map(() => '?').join(',')}) AND status = 'active'`;
    const params = [...blockedIds];

    if (criteria.gender) {
      sql += ' AND gender = ?';
      params.push(criteria.gender);
    }

    const [candidates] = await query(sql, params);

    if (!candidates || candidates.length === 0) {
      parentPort.postMessage({ id, ok: true, data: { ok: false, reason: 'no_candidates' } });
      return;
    }

    const scores = [];
    for (const c of candidates) {
      const score = await calculateMatchScore(userId, c.id);
      scores.push({ userId: c.id, score });
    }

    scores.sort((a, b) => b.score - a.score);
    const topCandidate = scores[0];

    if (!topCandidate || topCandidate.score <= 30) {
      parentPort.postMessage({ id, ok: true, data: { ok: false, reason: 'no_good_match' } });
      return;
    }

    const [users] = await query(
      'SELECT id, username, nickname, avatar FROM users WHERE id = ?',
      [topCandidate.userId]
    );
    if (!users || users.length === 0) {
      parentPort.postMessage({ id, ok: true, data: { ok: false, reason: 'user_missing' } });
      return;
    }

    await query(
      'INSERT INTO match_history (user_id, matched_user_id, created_at) VALUES (?, ?, NOW())',
      [userId, topCandidate.userId]
    );

    parentPort.postMessage({
      id,
      ok: true,
      data: {
        ok: true,
        user: users[0],
        score: topCandidate.score
      }
    });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: error.message });
  }
});

