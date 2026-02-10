export type ParallelDownloadOptions = {
  chunkSize?: number;
  concurrency?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  onProgress?: (receivedBytes: number, totalBytes: number) => void;
};

async function headForSize(url: string, opts: ParallelDownloadOptions): Promise<{ size?: number; acceptRanges: boolean; contentType?: string }> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: opts.signal,
      headers: opts.headers
    });
    if (!res.ok) return { acceptRanges: false };
    const len = res.headers.get('content-length');
    const acceptRanges = (res.headers.get('accept-ranges') || '').toLowerCase().includes('bytes');
    const contentType = res.headers.get('content-type') || undefined;
    const size = len ? Number(len) : undefined;
    return { size: Number.isFinite(size) ? size : undefined, acceptRanges, contentType };
  } catch {
    return { acceptRanges: false };
  }
}

async function fetchWhole(url: string, opts: ParallelDownloadOptions, contentType?: string): Promise<Blob> {
  const res = await fetch(url, { signal: opts.signal, headers: opts.headers });
  if (!res.ok) throw new Error(`下载失败: ${res.status}`);
  const blob = await res.blob();
  if (!contentType) return blob;
  if (blob.type && blob.type !== 'application/octet-stream') return blob;
  return new Blob([blob], { type: contentType });
}

export async function downloadToBlobParallel(url: string, options: ParallelDownloadOptions = {}): Promise<{ blob: Blob; totalBytes?: number }> {
  const chunkSize = Math.max(256 * 1024, Math.min(8 * 1024 * 1024, Math.floor(options.chunkSize || 2 * 1024 * 1024)));
  const concurrency = Math.max(1, Math.min(8, Math.floor(options.concurrency || Math.max(2, Math.floor((navigator as any).hardwareConcurrency ? (navigator as any).hardwareConcurrency / 2 : 4)))));

  const head = await headForSize(url, options);
  if (!head.size || head.size <= chunkSize || !head.acceptRanges) {
    const blob = await fetchWhole(url, options, head.contentType);
    return { blob, totalBytes: head.size };
  }

  const total = head.size;
  const partsCount = Math.ceil(total / chunkSize);
  const buffers: ArrayBuffer[] = new Array(partsCount);
  let received = 0;

  let next = 0;
  const worker = async () => {
    while (true) {
      const idx = next;
      next++;
      if (idx >= partsCount) return;

      const start = idx * chunkSize;
      const end = Math.min(total - 1, start + chunkSize - 1);
      const res = await fetch(url, {
        method: 'GET',
        signal: options.signal,
        headers: {
          ...(options.headers || {}),
          Range: `bytes=${start}-${end}`
        }
      });

      if (res.status !== 206) {
        throw new Error('服务器不支持分段下载');
      }

      const ab = await res.arrayBuffer();
      buffers[idx] = ab;
      received += ab.byteLength;
      if (options.onProgress) options.onProgress(received, total);
    }
  };

  try {
    await Promise.all(new Array(concurrency).fill(0).map(() => worker()));
  } catch (e) {
    const blob = await fetchWhole(url, options, head.contentType);
    return { blob, totalBytes: head.size };
  }

  const blob = new Blob(buffers, { type: head.contentType || 'application/octet-stream' });
  return { blob, totalBytes: total };
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

