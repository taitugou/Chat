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
  if (String(sql).includes('user_blacklist')) return [[]];
  if (String(sql).includes('INSERT INTO messages')) return [{ insertId: 123 }];
  return [[]];
});

vi.mock('../database/connection.js', () => ({ query }));
vi.mock('../utils/mentionHelper.js', () => ({
  processMentions: vi.fn(async () => {}),
  cleanupMentions: vi.fn(async () => {})
}));

describe('chat send (http fallback)', () => {
  it('validates required fields', async () => {
    const { default: chatRoutes } = await import('../routes/chat.js');
    const app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);

    await request(app).post('/api/chat/send').send({ receiverId: 2 }).expect(400);
    await request(app).post('/api/chat/send').send({ content: 'hi' }).expect(400);
  });

  it('inserts a private message', async () => {
    const { default: chatRoutes } = await import('../routes/chat.js');
    const app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);

    const res = await request(app)
      .post('/api/chat/send')
      .send({ receiverId: 2, content: 'hello', messageType: 'text', isSnapchat: false })
      .expect(201);

    expect(res.body.messageId).toBe(123);
    expect(query).toHaveBeenCalled();
  });
});

