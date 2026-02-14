import { getBatchStateUpdateService, UPDATE_TYPES } from './batchStateUpdateService.js';
import { getGameMemoryManager } from './gameMemoryManager.js';
import { getRoomLock, clearOperationHistory } from './gameOperationLock.js';

const DEFAULT_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BACKOFF_MULTIPLIER = 2;
const STATE_SYNC_TIMEOUT = 10000;
const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 5000;

const socketConnections = new Map();
const pendingOperations = new Map();
const connectionState = new Map();
const stateSyncQueue = new Map();
const heartbeatTimers = new Map();
const reconnectTimers = new Map();

export class SocketErrorRecoveryService {
  constructor(options = {}) {
    this.reconnectDelay = options.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? MAX_RECONNECT_ATTEMPTS;
    this.backoffMultiplier = options.backoffMultiplier ?? RECONNECT_BACKOFF_MULTIPLIER;
    this.stateSyncTimeout = options.stateSyncTimeout ?? STATE_SYNC_TIMEOUT;
    this.heartbeatInterval = options.heartbeatInterval ?? HEARTBEAT_INTERVAL;
    this.connectionTimeout = options.connectionTimeout ?? CONNECTION_TIMEOUT;
    this.enableAutoReconnect = options.enableAutoReconnect !== false;
    this.enableStateRecovery = options.enableStateRecovery !== false;
    this.enableHeartbeat = options.enableHeartbeat !== false;
  }

  registerConnection(socketId, connectionInfo) {
    const state = {
      socketId,
      userId: connectionInfo.userId,
      roomId: connectionInfo.roomId,
      status: 'connecting',
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      reconnectAttempts: 0,
      lastReconnectAt: null,
      stateVersion: 0,
      pendingOps: [],
      errorCount: 0,
      lastError: null,
      metadata: connectionInfo.metadata || {}
    };

    socketConnections.set(socketId, state);
    connectionState.set(connectionInfo.userId, socketId);

    this.setupHeartbeat(socketId);
    this.monitorConnection(socketId);

    console.log(`[SocketRecovery] 注册连接: ${socketId}, 用户: ${connectionInfo.userId}, 房间: ${connectionInfo.roomId}`);

    return state;
  }

  async connect(socketId, connectionInfo) {
    const state = socketConnections.get(socketId);
    if (!state) {
      throw new Error('连接未注册');
    }

    try {
      state.status = 'connecting';

      const connected = await this.establishConnection(socketId, connectionInfo);

      if (connected) {
        state.status = 'connected';
        state.reconnectAttempts = 0;
        state.lastConnectedAt = Date.now();

        this.startHeartbeat(socketId);
        this.notifyStateRecovery(socketId, 'reconnected');

        console.log(`[SocketRecovery] 连接成功: ${socketId}`);

        return { success: true, state: 'connected' };
      } else {
        throw new Error('连接建立失败');
      }
    } catch (error) {
      state.status = 'error';
      state.lastError = {
        message: error.message,
        timestamp: Date.now(),
        type: 'connection'
      };
      state.errorCount++;

      return this.handleConnectionError(socketId, error);
    }
  }

  async establishConnection(socketId, connectionInfo) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('连接超时')), this.connectionTimeout);
    });

    const connectPromise = this.doEstablishConnection(socketId, connectionInfo);

    return Promise.race([timeoutPromise, connectPromise]);
  }

  async doEstablishConnection(socketId, connectionInfo) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 100);
    });
  }

  handleConnectionError(socketId, error) {
    const state = socketConnections.get(socketId);
    if (!state) {
      return { success: false, error: '连接状态丢失', code: 'STATE_LOST' };
    }

    if (!this.enableAutoReconnect) {
      return {
        success: false,
        error: error.message,
        code: 'CONNECTION_FAILED',
        recoverable: false
      };
    }

    if (state.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[SocketRecovery] ${socketId} 达到最大重连次数`);

      return {
        success: false,
        error: '达到最大重连次数',
        code: 'MAX_RECONNECT_EXCEEDED',
        recoverable: false
      };
    }

    const delay = this.calculateReconnectDelay(state.reconnectAttempts);

    state.reconnectAttempts++;
    state.status = 'reconnecting';
    state.lastReconnectAt = Date.now();

    const timerId = `reconnect_${socketId}_${Date.now()}`;
    const timer = setTimeout(async () => {
      await this.attemptReconnect(socketId);
    }, delay);

    reconnectTimers.set(timerId, { socketId, timer });

    return {
      success: false,
      error: error.message,
      code: 'RECONNECT_SCHEDULED',
      recoverable: true,
      reconnectAt: Date.now() + delay,
      attempt: state.reconnectAttempts
    };
  }

  calculateReconnectDelay(attempt) {
    const baseDelay = this.reconnectDelay * Math.pow(this.backoffMultiplier, attempt);
    const jitter = Math.random() * baseDelay * 0.1;
    return Math.min(baseDelay + jitter, 30000);
  }

  async attemptReconnect(socketId) {
    const state = socketConnections.get(socketId);
    if (!state) {
      return { success: false, error: '连接状态丢失' };
    }

    console.log(`[SocketRecovery] 尝试重连: ${socketId}, 尝试次数: ${state.reconnectAttempts}`);

    try {
      const result = await this.connect(socketId, {
        userId: state.userId,
        roomId: state.roomId,
        metadata: state.metadata
      });

      if (result.success) {
        console.log(`[SocketRecovery] 重连成功: ${socketId}`);

        if (this.enableStateRecovery) {
          await this.recoverState(socketId);
        }

        return { success: true, state: 'reconnected' };
      } else if (result.code === 'MAX_RECONNECT_EXCEEDED') {
        await this.handlePermanentFailure(socketId);
        return result;
      }
    } catch (error) {
      console.error(`[SocketRecovery] 重连异常: ${socketId}`, error.message);
    }

    return { success: false, state: 'reconnecting' };
  }

  async recoverState(socketId) {
    const state = socketConnections.get(socketId);
    if (!state || !this.enableStateRecovery) {
      return { recovered: false, reason: 'no_state' };
    }

    const manager = getGameMemoryManager();
    const gameHistory = manager.getGameHistory(state.roomId);

    if (!gameHistory) {
      return { recovered: false, reason: 'no_history' };
    }

    const lastSnapshot = gameHistory.stateSnapshots[gameHistory.stateSnapshots.length - 1];

    if (!lastSnapshot) {
      return { recovered: false, reason: 'no_snapshot' };
    }

    const recoveryInfo = {
      socketId,
      roomId: state.roomId,
      lastState: lastSnapshot.state,
      lastUpdate: lastSnapshot.timestamp,
      version: state.stateVersion
    };

    state.pendingStateRecovery = recoveryInfo;

    const syncQueue = stateSyncQueue.get(socketId) || [];
    syncQueue.push({
      type: 'state_recovery',
      payload: recoveryInfo,
      timestamp: Date.now()
    });
    stateSyncQueue.set(socketId, syncQueue);

    console.log(`[SocketRecovery] 状态恢复已排队: ${socketId}, 版本: ${state.stateVersion}`);

    return {
      recovered: true,
      pending: true,
      lastState: lastSnapshot.state,
      version: state.stateVersion
    };
  }

  async handleStateSync(socketId, syncData) {
    const state = socketConnections.get(socketId);
    if (!state) {
      return { success: false, error: '连接状态丢失' };
    }

    try {
      const { serverState, operationsSince } = syncData;

      const manager = getGameMemoryManager();
      const localHistory = manager.getGameHistory(state.roomId);

      const missingOps = [];
      if (operationsSince) {
        const lastLocalOp = localHistory?.actions?.length || 0;
        for (let i = lastLocalOp; i < operationsSince; i++) {
          missingOps.push(i);
        }
      }

      const mergedState = this.mergeStates(
        state.lastKnownState,
        serverState,
        localHistory?.actions?.slice(-100) || []
      );

      state.lastKnownState = mergedState;
      state.stateVersion++;
      state.lastSyncAt = Date.now();

      if (missingOps.length > 0) {
        await this.replayOperations(socketId, missingOps);
      }

      return {
        success: true,
        version: state.stateVersion,
        merged: true
      };
    } catch (error) {
      console.error(`[SocketRecovery] 状态同步失败: ${socketId}`, error.message);

      return {
        success: false,
        error: error.message,
        recoverable: true
      };
    }
  }

  mergeStates(localState, serverState, operations) {
    if (!serverState) {
      return localState;
    }

    const merged = { ...localState, ...serverState };

    for (const op of operations) {
      try {
        if (op.action === 'bet' && op.payload?.amount) {
          merged.playerBets = {
            ...merged.playerBets,
            [op.payload.userId]: (merged.playerBets?.[op.payload.userId] || 0) + op.payload.amount
          };
        }

        if (op.action === 'fold' && op.payload?.userId) {
          merged.playerStatus = {
            ...merged.playerStatus,
            [op.payload.userId]: 'folded'
          };
        }
      } catch (e) {}
    }

    return merged;
  }

  async replayOperations(socketId, operationIds) {
    const state = socketConnections.get(socketId);
    if (!state) return;

    const manager = getGameMemoryManager();
    const gameHistory = manager.getGameHistory(state.roomId);

    if (!gameHistory?.actions) return;

    for (const opId of operationIds) {
      const op = gameHistory.actions[opId];
      if (op) {
        await this.applyOperation(socketId, op);
      }
    }

    console.log(`[SocketRecovery] 重放操作完成: ${socketId}, ${operationIds.length} 个操作`);
  }

  async applyOperation(socketId, operation) {
    const batchService = getBatchStateUpdateService();

    return batchService.queueUpdate(
      socketId,
      UPDATE_TYPES.PLAYER_ACTION,
      operation.payload,
      { metadata: { operationId: operation.action } }
    );
  }

  setupHeartbeat(socketId) {
    const timer = setInterval(() => {
      this.sendHeartbeat(socketId);
    }, this.heartbeatInterval);

    heartbeatTimers.set(socketId, timer);
  }

  startHeartbeat(socketId) {
    const timer = heartbeatTimers.get(socketId);
    if (timer) {
      timer.refresh();
    }
  }

  sendHeartbeat(socketId) {
    const state = socketConnections.get(socketId);
    if (!state || state.status !== 'connected') {
      return;
    }

    const heartbeat = {
      type: 'heartbeat',
      socketId,
      timestamp: Date.now(),
      clientTime: Date.now(),
      sequence: state.stateVersion
    };

    state.lastActivityAt = Date.now();

    console.log(`[SocketRecovery] 发送心跳: ${socketId}`);
  }

  handleHeartbeatResponse(socketId, response) {
    const state = socketConnections.get(socketId);
    if (!state) return;

    const latency = Date.now() - response.clientTime;
    state.lastHeartbeatAt = Date.now();
    state.heartbeatLatency = latency;

    if (response.serverTime) {
      state.timeOffset = response.serverTime - Date.now();
    }

    if (latency > 5000) {
      console.warn(`[SocketRecovery] 心跳延迟过高: ${socketId}, ${latency}ms`);
    }
  }

  monitorConnection(socketId) {
    const monitorTimer = setInterval(() => {
      const state = socketConnections.get(socketId);
      if (!state) {
        clearInterval(monitorTimer);
        return;
      }

      const inactiveTime = Date.now() - state.lastActivityAt;

      if (state.status === 'connected' && inactiveTime > this.heartbeatInterval * 3) {
        console.warn(`[SocketRecovery] 连接长时间无活动: ${socketId}, ${Math.round(inactiveTime / 1000)}s`);
        this.handleInactivity(socketId);
      }

      if (state.status === 'error' && state.errorCount > 10) {
        console.error(`[SocketRecovery] 连接错误过多: ${socketId}, ${state.errorCount} 次`);
        this.handlePermanentFailure(socketId);
      }
    }, this.heartbeatInterval);

    state.monitorTimer = monitorTimer;
  }

  handleInactivity(socketId) {
    const state = socketConnections.get(socketId);
    if (!state) return;

    this.sendHeartbeat(socketId);

    if (Date.now() - state.lastHeartbeatAt > this.heartbeatInterval * 2) {
      console.warn(`[SocketRecovery] 连接可能断开，重新连接: ${socketId}`);
      this.handleConnectionError(socketId, new Error('心跳超时'));
    }
  }

  handlePermanentFailure(socketId) {
    const state = socketConnections.get(socketId);
    if (!state) return;

    state.status = 'failed';
    state.failedAt = Date.now();

    this.cleanupConnection(socketId, true);

    console.error(`[SocketRecovery] 连接永久失败: ${socketId}, 用户: ${state.userId}`);
  }

  async disconnect(socketId, reason = 'client_disconnect') {
    const state = socketConnections.get(socketId);
    if (!state) return;

    state.status = 'disconnecting';
    state.disconnectReason = reason;
    state.disconnectedAt = Date.now();

    console.log(`[SocketRecovery] 断开连接: ${socketId}, 原因: ${reason}`);

    return this.cleanupConnection(socketId);
  }

  cleanupConnection(socketId, permanent = false) {
    const state = socketConnections.get(socketId);
    if (!state) return;

    if (state.monitorTimer) {
      clearInterval(state.monitorTimer);
    }

    const heartbeatTimer = heartbeatTimers.get(socketId);
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimers.delete(socketId);
    }

    const timers = Array.from(reconnectTimers.values())
      .filter(t => t.socketId === socketId);

    for (const { timer } of timers) {
      clearTimeout(timer);
    }

    reconnectTimers.forEach((value, key) => {
      if (value.socketId === socketId) {
        reconnectTimers.delete(key);
      }
    });

    pendingOperations.delete(socketId);
    stateSyncQueue.delete(socketId);

    if (permanent) {
      connectionState.delete(state.userId);
    }

    socketConnections.delete(socketId);

    clearOperationHistory(socketId);

    console.log(`[SocketRecovery] 清理连接: ${socketId}`);
  }

  registerPendingOperation(socketId, operation) {
    const ops = pendingOperations.get(socketId) || [];
    const opRecord = {
      ...operation,
      registeredAt: Date.now(),
      attempts: 0
    };
    ops.push(opRecord);
    pendingOperations.set(socketId, ops);

    return opRecord;
  }

  completePendingOperation(socketId, operationId) {
    const ops = pendingOperations.get(socketId);
    if (!ops) return false;

    const index = ops.findIndex(op => op.id === operationId);
    if (index !== -1) {
      ops.splice(index, 1);
      return true;
    }

    return false;
  }

  retryPendingOperations(socketId) {
    const ops = pendingOperations.get(socketId);
    if (!ops || ops.length === 0) return 0;

    const now = Date.now();
    const toRetry = ops.filter(op => now - op.registeredAt > 5000);

    for (const op of toRetry) {
      op.attempts++;
      op.lastRetryAt = now;
    }

    console.log(`[SocketRecovery] 重试待处理操作: ${socketId}, ${toRetry.length} 个`);

    return toRetry.length;
  }

  notifyStateRecovery(socketId, event) {
    const state = socketConnections.get(socketId);
    if (!state) return;

    const notification = {
      type: 'state_recovery_notification',
      event,
      socketId,
      timestamp: Date.now(),
      details: {
        roomId: state.roomId,
        reconnectAttempts: state.reconnectAttempts,
        lastConnectedAt: state.lastConnectedAt
      }
    };

    console.log(`[SocketRecovery] 状态恢复通知: ${socketId}, ${event}`);
  }

  getConnectionState(socketId) {
    return socketConnections.get(socketId) || null;
  }

  getConnectionByUserId(userId) {
    const socketId = connectionState.get(userId);
    return socketId ? socketConnections.get(socketId) : null;
  }

  getStats() {
    const stats = {
      totalConnections: socketConnections.size,
      byStatus: {},
      pendingOperations: 0,
      reconnectTimers: reconnectTimers.size,
      heartbeatTimers: heartbeatTimers.size
    };

    for (const state of socketConnections.values()) {
      stats.byStatus[state.status] = (stats.byStatus[state.status] || 0) + 1;
    }

    for (const ops of pendingOperations.values()) {
      stats.pendingOperations += ops.length;
    }

    return stats;
  }

  async shutdown() {
    console.log('[SocketRecovery] 关闭服务...');

    for (const socketId of socketConnections.keys()) {
      await this.disconnect(socketId, 'server_shutdown');
    }

    for (const timer of heartbeatTimers.values()) {
      clearInterval(timer);
    }
    heartbeatTimers.clear();

    for (const { timer } of reconnectTimers.values()) {
      clearTimeout(timer);
    }
    reconnectTimers.clear();

    socketConnections.clear();
    connectionState.clear();
    pendingOperations.clear();
    stateSyncQueue.clear();

    console.log('[SocketRecovery] 服务已关闭');
  }
}

let recoveryServiceInstance = null;

export function getSocketErrorRecoveryService(options = {}) {
  if (!recoveryServiceInstance) {
    recoveryServiceInstance = new SocketErrorRecoveryService(options);
  }
  return recoveryServiceInstance;
}

export function registerSocketConnection(socketId, connectionInfo) {
  const service = getSocketErrorRecoveryService();
  return service.registerConnection(socketId, connectionInfo);
}

export async function connectSocket(socketId, connectionInfo) {
  const service = getSocketErrorRecoveryService();
  return service.connect(socketId, connectionInfo);
}

export async function disconnectSocket(socketId, reason) {
  const service = getSocketErrorRecoveryService();
  return service.disconnect(socketId, reason);
}

export function getSocketStats() {
  const service = getSocketErrorRecoveryService();
  return service.getStats();
}

process.on('SIGTERM', async () => {
  const service = getSocketErrorRecoveryService();
  await service.shutdown();
});

process.on('SIGINT', async () => {
  const service = getSocketErrorRecoveryService();
  await service.shutdown();
});
