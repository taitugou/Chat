import api from './api';

export type ChunkedUploadOptions = {
  chunkSize?: number;
  concurrency?: number;
  fileHash?: string;
  isSnapchat?: boolean;
  snapchatDuration?: number;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
};

export async function sendChatFileChunked(params: {
  file: File;
  receiverId: number;
  messageType: 'image' | 'video' | 'audio' | 'file';
} & ChunkedUploadOptions) {
  const file = params.file;
  const chunkSize = Math.max(256 * 1024, Math.min(8 * 1024 * 1024, Math.floor(params.chunkSize || 2 * 1024 * 1024)));
  const concurrency = Math.max(1, Math.min(8, Math.floor(params.concurrency || Math.max(2, Math.floor((navigator as any).hardwareConcurrency ? (navigator as any).hardwareConcurrency / 2 : 4)))));
  const totalChunks = Math.ceil(file.size / chunkSize);

  const initResp = await api.post('/chat/send-file-chunked/init', {
    receiverId: params.receiverId,
    messageType: params.messageType,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks,
    chunkSize,
    fileHash: params.fileHash,
    isSnapchat: params.isSnapchat || false,
    snapchatDuration: params.snapchatDuration || 0
  });

  const uploadId = initResp.data?.uploadId;
  if (!uploadId || typeof uploadId !== 'string') {
    throw new Error('初始化分片上传失败');
  }

  let uploaded = 0;
  let next = 0;

  const worker = async () => {
    while (true) {
      const idx = next;
      next++;
      if (idx >= totalChunks) return;

      const start = idx * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      await api.put(`/chat/send-file-chunked/${encodeURIComponent(uploadId)}/chunk`, chunk, {
        params: { index: idx },
        headers: { 'Content-Type': 'application/octet-stream' }
      });

      uploaded += chunk.size;
      if (params.onProgress) params.onProgress(uploaded, file.size);
    }
  };

  await Promise.all(new Array(concurrency).fill(0).map(() => worker()));

  const completeResp = await api.post(`/chat/send-file-chunked/${encodeURIComponent(uploadId)}/complete`);
  const saved = completeResp.data?.data;
  if (!saved) throw new Error('完成分片上传失败');
  return saved;
}

