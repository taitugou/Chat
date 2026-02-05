import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let worker = null;
let requestId = 1;
const pending = new Map();

function ensureWorker() {
  if (worker && worker.threadId) return;
  worker = new Worker(join(__dirname, '../workers/matchWorker.js'), { execArgv: [] });

  worker.on('message', (msg) => {
    const { id, ok, data, error } = msg || {};
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.resolve(data);
    else p.reject(new Error(error || 'Worker task failed'));
  });

  worker.on('error', (err) => {
    // Reject all pending tasks
    for (const [, p] of pending) {
      p.reject(err);
    }
    pending.clear();
    worker = null;
  });

  worker.on('exit', (code) => {
    worker = null;
  });
}

export function runMatchTask(payload) {
  ensureWorker();
  const id = requestId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type: 'match', payload });
  });
}

