import express from 'express';
import request from 'supertest';
import { vi } from 'vitest';

vi.mock('../middleware/auth.js', () => {
  return {
    authenticate: (req, _res, next) => {
      req.user = { id: 1, isAdmin: false, vipLevel: 'none' };
      next();
    }
  };
});

const query = vi.fn(async (sql) => {
  const s = String(sql);
  if (s.includes('user_blacklist')) return [[]];
  if (s.includes('INSERT INTO messages')) return [{ insertId: 77 }];
  if (s.includes('SELECT * FROM messages WHERE id = ?')) {
    return [[{ id: 77, sender_id: 1, receiver_id: 2, message_type: 'file', content: 'big.iso', file_url: null, file_size: 42, created_at: new Date().toISOString() }]];
  }
  return [[]];
});

vi.mock('../database/connection.js', () => ({ query }));

describe('chat p2p meta', () => {
  it('creates placeholder message and emits', async () => {
    const { default: chatRoutes } = await import('../routes/chat.js');
    const app = express();
    app.use(express.json());
    const emit = vi.fn();
    app.use((req, _res, next) => {
      req.io = { to: () => ({ emit }) };
      next();
    });
    app.use('/api/chat', chatRoutes);

    const res = await request(app)
      .post('/api/chat/send-p2p-file-meta')
      .send({ receiverId: 2, messageType: 'file', fileName: 'big.iso', fileSize: 42, mimeType: 'application/octet-stream' })
      .expect(201);

    expect(res.body?.data?.id).toBe(77);
    expect(emit).toHaveBeenCalled();
  });
});

