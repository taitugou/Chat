import { getRedisClient } from '../database/redis.js';
import { query } from '../database/connection.js';
import { processMentions } from '../utils/mentionHelper.js';

const QUEUE_KEY = 'queue:messages';

export async function enqueueMessage(messagePayload) {
  const redis = getRedisClient();
  await redis.lpush(QUEUE_KEY, JSON.stringify({
    ...messagePayload,
    enqueued_at: Date.now()
  }));
}

export function startMessageConsumer(io) {
  const redis = getRedisClient();
  async function drain() {
    try {
      while (true) {
        const raw = await redis.rpop(QUEUE_KEY);
        if (!raw) break;
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          continue;
        }
        const {
          sender_id, receiver_id = null, group_id = null, conversation_id,
          message_type = 'text', content = '', is_snapchat = 0, snapchat_duration = 0
        } = msg;

        try {
          const [result] = await query(
            `INSERT INTO messages (sender_id, receiver_id, group_id, conversation_id, message_type, content, 
                                   is_snapchat, snapchat_duration, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [sender_id, receiver_id, group_id, conversation_id, message_type, content, is_snapchat ? 1 : 0, snapchat_duration || 0]
          );
          const messageId = result.insertId;
          // async mention processing for text
          if (message_type === 'text') {
            try {
              await processMentions({
                content,
                chatMessageId: messageId,
                userId: sender_id,
                io
              });
            } catch {}
          }
          // Optionally notify persistence success
          if (receiver_id) {
            io.to(`user:${receiver_id}`).emit('message:persisted', { tempId: msg.temp_id, id: messageId });
          }
          if (sender_id) {
            io.to(`user:${sender_id}`).emit('message:persisted', { tempId: msg.temp_id, id: messageId });
          }
        } catch (err) {
          // If DB write fails, push back to queue for retry
          await redis.rpush(QUEUE_KEY, raw);
          break;
        }
      }
    } catch (e) {
      // swallow and retry next tick
    }
  }
  // Run every second
  setInterval(drain, 1000);
}
