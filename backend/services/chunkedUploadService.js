import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isValidSha256Hex(v) {
  return typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
}

function messageTypeToDir(messageType) {
  if (messageType === 'image') return { diskDir: path.join(__dirname, '../uploads/images'), urlPrefix: '/uploads/images' };
  if (messageType === 'video') return { diskDir: path.join(__dirname, '../uploads/videos'), urlPrefix: '/uploads/videos' };
  if (messageType === 'audio') return { diskDir: path.join(__dirname, '../uploads/audio'), urlPrefix: '/uploads/audio' };
  return { diskDir: path.join(__dirname, '../uploads/files'), urlPrefix: '/uploads/files' };
}

function getTmpRoot() {
  const override = process.env.CHUNK_UPLOAD_TMP_DIR;
  if (override && typeof override === 'string') return override;
  return path.join(__dirname, '../uploads/tmp/chunked');
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function sessionDir(uploadId) {
  return path.join(getTmpRoot(), uploadId);
}

function metaPath(uploadId) {
  return path.join(sessionDir(uploadId), 'meta.json');
}

function chunkPath(uploadId, index) {
  return path.join(sessionDir(uploadId), `chunk_${index}`);
}

export async function initChunkedUploadSession(meta) {
  const {
    senderId,
    receiverId,
    messageType,
    fileName,
    fileSize,
    mimeType,
    totalChunks,
    chunkSize,
    fileHash,
    isSnapchat,
    snapchatDuration
  } = meta || {};

  if (!Number.isFinite(senderId) || senderId <= 0) throw new Error('senderId无效');
  if (!Number.isFinite(receiverId) || receiverId <= 0) throw new Error('receiverId无效');
  if (typeof fileName !== 'string' || !fileName.trim()) throw new Error('fileName无效');

  const normalizedType = new Set(['image', 'video', 'audio', 'file']).has(messageType) ? messageType : 'file';
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) throw new Error('fileSize无效');

  const tChunks = Number(totalChunks);
  const cSize = Number(chunkSize);
  if (!Number.isFinite(tChunks) || tChunks <= 0) throw new Error('totalChunks无效');
  if (!Number.isFinite(cSize) || cSize <= 0) throw new Error('chunkSize无效');

  const uploadId = uuidv4();
  const dir = sessionDir(uploadId);
  await ensureDir(dir);

  const cleanHash = typeof fileHash === 'string' ? fileHash.trim().toLowerCase() : '';
  const storedMeta = {
    uploadId,
    senderId,
    receiverId,
    messageType: normalizedType,
    fileName: fileName.trim(),
    fileSize: Math.floor(size),
    mimeType: typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'application/octet-stream',
    totalChunks: Math.floor(tChunks),
    chunkSize: Math.floor(cSize),
    fileHash: isValidSha256Hex(cleanHash) ? cleanHash : null,
    isSnapchat: !!isSnapchat,
    snapchatDuration: Number.isFinite(Number(snapchatDuration)) ? Math.max(0, Math.floor(Number(snapchatDuration))) : 0,
    createdAt: Date.now()
  };

  await fs.writeFile(metaPath(uploadId), JSON.stringify(storedMeta), 'utf8');
  return storedMeta;
}

export async function getChunkedUploadMeta(uploadId) {
  const raw = await fs.readFile(metaPath(uploadId), 'utf8');
  return JSON.parse(raw);
}

export async function listReceivedChunks(uploadId) {
  const dir = sessionDir(uploadId);
  try {
    const names = await fs.readdir(dir);
    const out = [];
    for (const n of names) {
      const m = /^chunk_(\d+)$/.exec(n);
      if (m) out.push(Number(m[1]));
    }
    out.sort((a, b) => a - b);
    return out;
  } catch {
    return [];
  }
}

export async function writeChunk(uploadId, index, buffer) {
  const meta = await getChunkedUploadMeta(uploadId);
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0 || idx >= meta.totalChunks) throw new Error('index无效');
  if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) throw new Error('chunk为空');

  const dir = sessionDir(uploadId);
  await ensureDir(dir);
  const target = chunkPath(uploadId, idx);
  const tmp = `${target}.tmp_${process.pid}_${Date.now()}`;
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, target);
  return { ok: true };
}

export async function finalizeChunkedUpload(uploadId) {
  const meta = await getChunkedUploadMeta(uploadId);
  const received = await listReceivedChunks(uploadId);
  if (received.length !== meta.totalChunks) throw new Error('分片不完整');

  const { diskDir, urlPrefix } = messageTypeToDir(meta.messageType);
  await ensureDir(diskDir);

  const ext = path.extname(meta.fileName || '').toLowerCase();
  const filename = meta.fileHash ? `${meta.fileHash}${ext}` : `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
  const outPath = path.join(diskDir, filename);

  await new Promise((resolve, reject) => {
    const ws = fssync.createWriteStream(outPath, { flags: 'w' });
    ws.on('error', reject);
    const writeNext = async (i) => {
      if (i >= meta.totalChunks) {
        ws.end();
        resolve();
        return;
      }
      const rp = chunkPath(uploadId, i);
      const rs = fssync.createReadStream(rp);
      rs.on('error', reject);
      rs.on('end', () => {
        writeNext(i + 1).catch(reject);
      });
      rs.pipe(ws, { end: false });
    };
    writeNext(0).catch(reject);
  });

  const fileUrl = `${urlPrefix}/${filename}`;
  const session = sessionDir(uploadId);
  await fs.rm(session, { recursive: true, force: true });

  return {
    fileUrl,
    storedFilename: filename,
    storedPath: outPath,
    fileSize: meta.fileSize,
    messageType: meta.messageType,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    senderId: meta.senderId,
    receiverId: meta.receiverId,
    isSnapchat: meta.isSnapchat,
    snapchatDuration: meta.snapchatDuration
  };
}

