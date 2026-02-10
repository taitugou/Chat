import express from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
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
  if (String(sql).includes('INSERT INTO messages')) return [{ insertId: 99 }];
  if (String(sql).includes('SELECT * FROM messages WHERE id = ?')) {
    return [[{ id: 99, sender_id: 1, receiver_id: 2, message_type: 'file', content: 'x.bin', file_url: '/uploads/files/x.bin', file_size: 123, created_at: new Date().toISOString() }]];
  }
  return [[]];
});

vi.mock('../database/connection.js', () => ({ query }));

describe('chat chunked upload routes', () => {
  it('uploads chunks and completes into a message', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ttg-chat-route-chunked-'));
    process.env.CHUNK_UPLOAD_TMP_DIR = tmpRoot;

    const { default: chatRoutes } = await import('../routes/chat.js');

    const app = express();
    app.use(express.json());
    const emit = vi.fn();
    app.use((req, _res, next) => {
      req.io = { to: () => ({ emit }) };
      next();
    });
    app.use('/api/chat', chatRoutes);

    const totalSize = 2 * 1024 * 1024 + 10;
    const payload = crypto.randomBytes(totalSize);
    const chunkSize = 1024 * 1024;
    const totalChunks = Math.ceil(totalSize / chunkSize);

    const initRes = await request(app)
      .post('/api/chat/send-file-chunked/init')
      .send({
        receiverId: 2,
        messageType: 'file',
        fileName: 'x.bin',
        fileSize: totalSize,
        mimeType: 'application/octet-stream',
        totalChunks,
        chunkSize
      })
      .expect(201);

    const uploadId = initRes.body.uploadId;
    expect(typeof uploadId).toBe('string');

    const uploads = [];
    for (let i = totalChunks - 1; i >= 0; i--) {
      const start = i * chunkSize;
      const end = Math.min(totalSize, start + chunkSize);
      uploads.push(
        request(app)
          .put(`/api/chat/send-file-chunked/${encodeURIComponent(uploadId)}/chunk?index=${i}`)
          .set('Content-Type', 'application/octet-stream')
          .send(payload.subarray(start, end))
          .expect(200)
      );
    }
    await Promise.all(uploads);

    const completeRes = await request(app)
      .post(`/api/chat/send-file-chunked/${encodeURIComponent(uploadId)}/complete`)
      .expect(201);

    expect(completeRes.body?.data?.id).toBe(99);
    expect(emit).toHaveBeenCalled();

    await fs.rm(tmpRoot, { recursive: true, force: true });
  });
});
