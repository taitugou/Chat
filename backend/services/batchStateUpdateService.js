const BATCH_WINDOW_MS = 50;
const MAX_BATCH_SIZE = 20;
const COMPRESSION_THRESHOLD = 5;

const pendingBatches = new Map();
const stateVersion = new Map();
const stateUpdateQueue = new Map();
const compressionCache = new Map();
const UPDATE_TYPES = {
  PLAYER_ACTION: 'player_action',
  GAME_STATE: 'game_state',
  TIMER_UPDATE: 'timer_update',
  SCORE_UPDATE: 'score_update',
  CHAT_MESSAGE: 'chat_message',
  SYSTEM_NOTIFICATION: 'system_notification'
};

export class BatchStateUpdateService {
  constructor(options = {}) {
    this.batchWindow = options.batchWindow ?? BATCH_WINDOW_MS;
    this.maxBatchSize = options.maxBatchSize ?? MAX_BATCH_SIZE;
    this.compressionThreshold = options.compressionThreshold ?? COMPRESSION_THRESHOLD;
    this.enableCompression = options.enableCompression !== false;
    this.enableDeduplication = options.enableDeduplication !== false;
    this.processingBatches = new Map();
    this.batchStats = {
      totalBatches: 0,
      totalUpdates: 0,
      compressedBatches: 0,
      dedupedUpdates: 0,
      avgBatchSize: 0,
      avgProcessingTime: 0
    };
  }

  queueUpdate(roomId, updateType, payload, options = {}) {
    const id = parseInt(roomId);
    const priority = options.priority ?? 5;

    if (!stateUpdateQueue.has(id)) {
      stateUpdateQueue.set(id, {
        updates: [],
        lastFlushTime: Date.now()
      });
    }

    const queue = stateUpdateQueue.get(id);

    if (this.enableDeduplication) {
      const existingIndex = queue.updates.findIndex(
        u => u.type === updateType && this.isPayloadEqual(u.payload, payload)
      );

      if (existingIndex !== -1) {
        queue.updates[existingIndex].count = (queue.updates[existingIndex].count || 1) + 1;
        this.batchStats.dedupedUpdates++;
        return { queued: false, reason: 'deduplicated', count: queue.updates[existingIndex].count };
      }
    }

    const update = {
      type: updateType,
      payload: this.sanitizePayload(payload),
      priority,
      timestamp: Date.now(),
      count: 1,
      metadata: options.metadata || {}
    };

    queue.updates.push(update);
    queue.updates.sort((a, b) => b.priority - a.priority);

    if (queue.updates.length >= this.maxBatchSize) {
      this.flushQueue(id);
    } else {
      this.scheduleFlush(id);
    }

    return { queued: true, position: queue.updates.length };
  }

  scheduleFlush(roomId) {
    const id = parseInt(roomId);

    if (this.processingBatches.has(id)) {
      return;
    }

    const queue = stateUpdateQueue.get(id);
    if (!queue || queue.updates.length === 0) return;

    const timerId = `batch_flush_${id}_${Date.now()}`;
    const timer = setTimeout(() => {
      this.flushQueue(id);
    }, this.batchWindow);

    queue.flushTimer = timer;

    if (!pendingBatches.has(id)) {
      pendingBatches.set(id, new Set());
    }
  }

  async flushQueue(roomId) {
    const id = parseInt(roomId);
    const queue = stateUpdateQueue.get(id);

    if (!queue || queue.updates.length === 0) {
      this.processingBatches.delete(id);
      return null;
    }

    if (queue.flushTimer) {
      clearTimeout(queue.flushTimer);
      queue.flushTimer = null;
    }

    this.processingBatches.set(id, true);

    const startTime = Date.now();
    const updates = queue.updates.splice(0, this.maxBatchSize);

    queue.lastFlushTime = Date.now();

    const batch = {
      roomId: id,
      updates,
      timestamp: startTime,
      sequence: this.batchStats.totalBatches,
      version: this.incrementVersion(id)
    };

    if (this.enableCompression && updates.length >= this.compressionThreshold) {
      this.compressBatch(batch);
    }

    const processedBatch = await this.processBatch(batch);
    const processingTime = Date.now() - startTime;

    this.batchStats.totalBatches++;
    this.batchStats.totalUpdates += processedBatch.updates.length;

    this.updateAvgStats(processingTime, processedBatch.updates.length);

    this.processingBatches.delete(id);

    if (queue.updates.length > 0) {
      this.scheduleFlush(id);
    }

    return processedBatch;
  }

  compressBatch(batch) {
    const compressed = {
      ...batch,
      compression: {
        originalSize: JSON.stringify(batch.updates).length,
        applied: true,
        techniques: []
      }
    };

    const updates = batch.updates;
    const typeGroups = new Map();

    for (const update of updates) {
      if (!typeGroups.has(update.type)) {
        typeGroups.set(update.type, []);
      }
      typeGroups.get(update.type).push(update.payload);
    }

    if (typeGroups.size < updates.length) {
      compressed.updates = [];
      compressed.compression.techniques.push('type_grouping');

      for (const [type, payloads] of typeGroups) {
        compressed.updates.push({
          type,
          payloads,
          isGrouped: true,
          count: payloads.length
        });
      }
    }

    const playerActionUpdates = updates.filter(u => u.type === UPDATE_TYPES.PLAYER_ACTION);
    if (playerActionUpdates.length > 3) {
      compressed.compression.techniques.push('player_action_dedup');

      const actionGroups = new Map();
      for (const update of playerActionUpdates) {
        const key = update.metadata?.actionType || 'generic';
        if (!actionGroups.has(key)) {
          actionGroups.set(key, []);
        }
        actionGroups.get(key).push(update.metadata?.userId);
      }

      compressed.compression.playerActionGroups = Object.fromEntries(actionGroups);
    }

    const latestPayloads = new Map();
    for (const update of updates) {
      const key = `${update.type}_${JSON.stringify(update.payload)}`;
      latestPayloads.set(key, update);
    }

    compressed.updates = Array.from(latestPayloads.values());
    compressed.compression.removedDuplicates = updates.length - compressed.updates.length;

    if (compressed.compression.removedDuplicates > 0) {
      compressed.compression.techniques.push('exact_dedup');
    }

    batch.compressedBatch = compressed;
    this.batchStats.compressedBatches++;

    return compressed;
  }

  decompressBatch(compressedBatch) {
    if (!compressedBatch?.compression?.applied) {
      return compressedBatch;
    }

    const decompressed = {
      ...compressedBatch,
      updates: [],
      compression: {
        ...compressedBatch.compression,
        decompressed: true,
        decompressTime: Date.now()
      }
    };

    for (const update of compressedBatch.updates) {
      if (update.isGrouped && update.payloads) {
        for (const payload of update.payloads) {
          decompressed.updates.push({
            type: update.type,
            payload,
            decompressed: true
          });
        }
      } else {
        decompressed.updates.push(update);
      }
    }

    return decompressed;
  }

  async processBatch(batch) {
    const compressedBatch = batch.compressedBatch || batch;

    const compressedUpdates = compressedBatch.updates || [];
    const updates = [];

    for (const update of compressedUpdates) {
      if (update.isGrouped && update.payloads) {
        for (const payload of update.payloads) {
          updates.push({
            type: update.type,
            payload,
            version: batch.version
          });
        }
      } else {
        updates.push({
          type: update.type,
          payload: update.payload,
          version: batch.version
        });
      }
    }

    const stateHash = this.computeStateHash(updates);
    const cacheKey = `${batch.roomId}_${stateHash}`;

    if (compressionCache.has(cacheKey)) {
      const cached = compressionCache.get(cacheKey);
      cached.lastUsed = Date.now();
      return {
        ...batch,
        updates: cached.updates,
        fromCache: true
      };
    }

    const result = {
      ...batch,
      updates,
      stateHash,
      processedAt: Date.now()
    };

    compressionCache.set(cacheKey, {
      updates,
      stateHash,
      createdAt: Date.now(),
      lastUsed: Date.now()
    });

    this.cleanupCache(batch.roomId);

    return result;
  }

  computeStateHash(updates) {
    const str = JSON.stringify(updates.map(u => `${u.type}_${JSON.stringify(u.payload)}`).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  incrementVersion(roomId) {
    const current = stateVersion.get(roomId) || 0;
    const next = current + 1;
    stateVersion.set(roomId, next);
    return next;
  }

  getVersion(roomId) {
    return stateVersion.get(roomId) || 0;
  }

  isPayloadEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every(key => this.isPayloadEqual(a[key], b[key]));
    }

    return a === b;
  }

  sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };
    delete sanitized.token;
    delete sanitized.password;
    delete sanitized.secret;

    for (const key of Object.keys(sanitized)) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizePayload(sanitized[key]);
      }
    }

    return sanitized;
  }

  cleanupCache(roomId = null) {
    const now = Date.now();
    const maxCacheAge = 5 * 60 * 1000;
    const maxCacheSize = 1000;

    if (roomId) {
      const cacheKeys = Array.from(compressionCache.keys())
        .filter(key => key.startsWith(`${roomId}_`));

      for (const key of cacheKeys) {
        const entry = compressionCache.get(key);
        if (now - entry.lastUsed > maxCacheAge) {
          compressionCache.delete(key);
        }
      }
    } else {
      if (compressionCache.size > maxCacheSize) {
        const entries = Array.from(compressionCache.entries())
          .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

        const toRemove = entries.slice(0, Math.floor(maxCacheSize * 0.2));
        for (const [key] of toRemove) {
          compressionCache.delete(key);
        }
      }

      for (const [key, entry] of compressionCache) {
        if (now - entry.lastUsed > maxCacheAge) {
          compressionCache.delete(key);
        }
      }
    }
  }

  updateAvgStats(processingTime, updateCount) {
    const totalBatches = this.batchStats.totalBatches;
    const prevAvgSize = this.batchStats.avgBatchSize;
    const prevAvgTime = this.batchStats.avgProcessingTime;

    this.batchStats.avgBatchSize = (prevAvgSize * (totalBatches - 1) + updateCount) / totalBatches;
    this.batchStats.avgProcessingTime = (prevAvgTime * (totalBatches - 1) + processingTime) / totalBatches;
  }

  getStats() {
    return {
      ...this.batchStats,
      pendingBatches: pendingBatches.size,
      activeRooms: stateUpdateQueue.size,
      cachedStates: compressionCache.size,
      currentVersions: Object.fromEntries(stateVersion)
    };
  }

  getQueueStatus(roomId) {
    const id = parseInt(roomId);
    const queue = stateUpdateQueue.get(id);
    const processing = this.processingBatches.has(id);

    return {
      pending: queue?.updates.length || 0,
      processing,
      version: this.getVersion(id),
      lastFlushTime: queue?.lastFlushTime || null,
      scheduledFlush: !!queue?.flushTimer
    };
  }

  async forceFlushAll() {
    const roomIds = Array.from(stateUpdateQueue.keys());
    const results = [];

    for (const roomId of roomIds) {
      const result = await this.flushQueue(roomId);
      if (result) {
        results.push({ roomId, batch: result });
      }
    }

    return results;
  }

  clearQueue(roomId) {
    const id = parseInt(roomId);
    const queue = stateUpdateQueue.get(id);

    if (queue?.flushTimer) {
      clearTimeout(queue.flushTimer);
    }

    stateUpdateQueue.delete(id);
    stateVersion.delete(id);
    this.processingBatches.delete(id);

    console.log(`[BatchStateUpdate] 清理队列: ${roomId}`);
  }

  clearAll() {
    for (const [, queue] of stateUpdateQueue) {
      if (queue.flushTimer) {
        clearTimeout(queue.flushTimer);
      }
    }

    stateUpdateQueue.clear();
    stateVersion.clear();
    this.processingBatches.clear();
    compressionCache.clear();
    pendingBatches.clear();

    console.log('[BatchStateUpdate] 清理所有队列');
  }
}

let batchServiceInstance = null;

export function getBatchStateUpdateService(options = {}) {
  if (!batchServiceInstance) {
    batchServiceInstance = new BatchStateUpdateService(options);
  }
  return batchServiceInstance;
}

export function queueBatchUpdate(roomId, updateType, payload, options = {}) {
  const service = getBatchStateUpdateService();
  return service.queueUpdate(roomId, updateType, payload, options);
}

export function flushBatchQueue(roomId) {
  const service = getBatchStateUpdateService();
  return service.flushQueue(roomId);
}

export function getBatchStats() {
  const service = getBatchStateUpdateService();
  return service.getStats();
}

export { UPDATE_TYPES };
