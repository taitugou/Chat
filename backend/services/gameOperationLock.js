const operationLocks = new Map();
const operationHistory = new Map();
const REQUEST_COOLDOWN_MS = 1000;
const MAX_OPERATIONS_PER_MINUTE = 60;
const OPERATION_HISTORY_WINDOW = 60000;

const DEFAULT_LOCK_TIMEOUT_MS = 5000;

export class GameOperationLock {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.timeout = options.timeout ?? DEFAULT_LOCK_TIMEOUT_MS;
    this.queue = [];
    this.currentOperation = null;
    this.timeoutTimer = null;
    this.isReleased = false;
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
  }

  async acquire(operationId, priority = 0, metadata = {}) {
    if (this.isReleased) {
      this.isReleased = false;
      this.queue = [];
      this.currentOperation = null;
    }

    const now = Date.now();
    const roomHistory = operationHistory.get(this.roomId) || { operations: [] };

    roomHistory.operations = roomHistory.operations.filter(t => now - t.time < OPERATION_HISTORY_WINDOW);
    const recentOps = roomHistory.operations.filter(t => t.id === operationId);

    if (recentOps.length >= MAX_OPERATIONS_PER_MINUTE) {
      throw new Error('操作过于频繁，请稍后再试');
    }

    roomHistory.operations.push({
      id: operationId,
      time: now,
      metadata
    });
    operationHistory.set(this.roomId, roomHistory);

    return new Promise((resolve, reject) => {
      const acquireOp = {
        operationId,
        priority,
        timestamp: now,
        metadata,
        resolve,
        reject: (reason) => {
          this.queue = this.queue.filter(op => op !== acquireOp);
          reject(reason);
        }
      };

      this.queue.push(acquireOp);
      this.queue.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      this.processQueue();
    });
  }

  processQueue() {
    if (this.isReleased) {
      this.isReleased = false;
      this.currentOperation = null;
    }
    if (this.currentOperation || this.queue.length === 0) {
      return;
    }

    const nextOp = this.queue.shift();
    if (!nextOp) return;

    this.currentOperation = nextOp;

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }

    this.timeoutTimer = setTimeout(() => {
      console.warn(`[GameOperationLock] 操作 ${nextOp.operationId} 超时，强制释放锁`);
      this.release();
    }, this.timeout);

    nextOp.resolve(this.createLockContext(nextOp.operationId));
  }

  createLockContext(operationId) {
    return {
      operationId,
      roomId: this.roomId,
      isValid: () => !this.isReleased && this.currentOperation?.operationId === operationId,
      release: () => this.releaseOperation(operationId),
      getMetadata: () => {
        const op = this.currentOperation;
        return op?.operationId === operationId ? op.metadata : null;
      }
    };
  }

  releaseOperation(operationId) {
    if (this.currentOperation?.operationId !== operationId) {
      console.warn(`[GameOperationLock] 尝试释放非当前操作: ${operationId}`);
      return;
    }

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    this.currentOperation = null;
    this.processQueue();
  }

  release() {
    if (this.isReleased) return;
    this.isReleased = true;

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    const pendingOps = [...this.queue];
    this.queue = [];

    for (const op of pendingOps) {
      try {
        op.reject(new Error('游戏操作锁已释放'));
      } catch (e) {
        console.error('[GameOperationLock] 清理等待操作失败:', e);
      }
    }

    this.currentOperation = null;
  }

  isLocked() {
    return this.currentOperation !== null || this.queue.length > 0;
  }

  getWaitingCount() {
    return this.queue.length;
  }

  getQueueStatus() {
    return {
      isLocked: this.isLocked(),
      currentOperation: this.currentOperation?.operationId || null,
      waitingCount: this.queue.length,
      queue: this.queue.map(op => ({
        operationId: op.operationId,
        priority: op.priority,
        waitingSince: Date.now() - op.timestamp
      }))
    };
  }
}

const roomLocks = new Map();

export function getRoomLock(roomId) {
  const id = parseInt(roomId);
  if (!roomLocks.has(id)) {
    roomLocks.set(id, new GameOperationLock(id));
  }
  return roomLocks.get(id);
}

export function hasRoomLock(roomId) {
  return roomLocks.has(parseInt(roomId));
}

export function deleteRoomLock(roomId) {
  const id = parseInt(roomId);
  const lock = roomLocks.get(id);
  if (lock) {
    lock.release();
    roomLocks.delete(id);
  }
}

export function getOrCreateRoomLock(roomId) {
  return getRoomLock(roomId);
}

export async function tryAcquireOperation(roomId, operationId, options = {}) {
  const lock = getRoomLock(roomId);
  return lock.acquire(operationId, options.priority ?? 0, options.metadata);
}

export async function withGameLock(roomId, operationId, operation, options = {}) {
  const lock = getRoomLock(roomId);
  const context = await lock.acquire(operationId, options.priority ?? 0, options.metadata);

  try {
    const startTime = Date.now();
    const result = await operation(context);
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      console.warn(`[GameOperationLock] 操作 ${operationId} 执行时间较长: ${duration}ms`);
    }

    return result;
  } finally {
    context.release();
  }
}

export function cleanupAllLocks() {
  for (const [roomId, lock] of roomLocks) {
    try {
      lock.release();
    } catch (e) {
      console.error(`[GameOperationLock] 清理房间 ${roomId} 锁失败:`, e);
    }
  }
  roomLocks.clear();
}

export function getLockStats() {
  const stats = {
    totalLocks: roomLocks.size,
    lockedRooms: [],
    queuedOperations: 0,
    totalOperationsLastMinute: 0
  };

  let totalOps = 0;
  for (const [roomId, history] of operationHistory) {
    const now = Date.now();
    const recentOps = history.operations.filter(t => now - t.time < OPERATION_HISTORY_WINDOW);
    totalOps += recentOps.length;
  }

  stats.totalOperationsLastMinute = totalOps;

  for (const [roomId, lock] of roomLocks) {
    if (lock.isLocked()) {
      stats.lockedRooms.push({
        roomId,
        isLocked: true,
        waitingCount: lock.getWaitingCount(),
        queueStatus: lock.getQueueStatus()
      });
      stats.queuedOperations += lock.getWaitingCount();
    }
  }

  return stats;
}

export function isOperationCooldown(roomId, operationId) {
  const roomHistory = operationHistory.get(roomId);
  if (!roomHistory) return false;

  const now = Date.now();
  const recentOps = roomHistory.operations.filter(
    t => t.id === operationId && now - t.time < REQUEST_COOLDOWN_MS
  );

  return recentOps.length > 0;
}

export function getRecentOperations(roomId, windowMs = 5000) {
  const roomHistory = operationHistory.get(roomId);
  if (!roomHistory) return [];

  const now = Date.now();
  return roomHistory.operations.filter(t => now - t.time < windowMs);
}

export function clearOperationHistory(roomId = null) {
  if (roomId) {
    operationHistory.delete(roomId);
  } else {
    operationHistory.clear();
  }
}
