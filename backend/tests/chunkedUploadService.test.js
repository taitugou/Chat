import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  initChunkedUploadSession,
  writeChunk,
  finalizeChunkedUpload
} from '../services/chunkedUploadService.js';

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

describe('chunkedUploadService', () => {
  it('assembles chunks into final file and cleans tmp session', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ttg-chat-chunked-'));
    process.env.CHUNK_UPLOAD_TMP_DIR = tmpRoot;

    const totalSize = 3 * 1024 * 1024 + 123;
    const payload = crypto.randomBytes(totalSize);
    const fileHash = sha256Hex(payload);
    const chunkSize = 1024 * 1024;
    const totalChunks = Math.ceil(totalSize / chunkSize);

    const meta = await initChunkedUploadSession({
      senderId: 1,
      receiverId: 2,
      messageType: 'file',
      fileName: 'hello.bin',
      fileSize: totalSize,
      mimeType: 'application/octet-stream',
      totalChunks,
      chunkSize,
      fileHash,
      isSnapchat: false,
      snapchatDuration: 0
    });

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(totalSize, start + chunkSize);
      await writeChunk(meta.uploadId, i, payload.subarray(start, end));
    }

    const out = await finalizeChunkedUpload(meta.uploadId);
    expect(out.fileUrl).toMatch(new RegExp(`${fileHash}\\.bin$`));
    expect(await exists(out.storedPath)).toBe(true);

    const disk = await fs.readFile(out.storedPath);
    expect(disk.length).toBe(totalSize);
    expect(sha256Hex(disk)).toBe(fileHash);

    await fs.rm(out.storedPath, { force: true });
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });
});
