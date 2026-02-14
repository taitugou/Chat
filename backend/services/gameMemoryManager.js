const GAME_TTL_MS = 2 * 60 * 60 * 1000;
const HISTORY_MAX_LENGTH = 100;
const CLEANUP_INTERVAL_MS = 60000;
const MAX_CACHED_STATES = 50;

const gameInstances = new Map();
const gameTimers = new Map();
const gameHistory = new Map();
const stateCache = new Map();
const playerSessions = new Map();
const resourcePools = new Map();

let cleanupInterval = null;
let memoryMonitorInterval = null;
let isShuttingDown = false;

export class GameMemoryManager {
  constructor(options = {}) {
    this.gameTTL = options.gameTTL || GAME_TTL_MS;
    this.historyMaxLength = options.historyMaxLength || HISTORY_MAX_LENGTH;
    this.cleanupInterval = options.cleanupInterval || CLEANUP_INTERVAL_MS;
    this.maxCachedStates = options.maxCachedStates || MAX_CACHED_STATES;
    this.enableAutoCleanup = options.enableAutoCleanup !== false;
  }

  registerGame(roomId, game) {
    if (isShuttingDown) {
      console.warn('[GameMemoryManager] 系统正在关闭，拒绝注册新游戏');
      return false;
    }

    const id = parseInt(roomId);
    
    if (gameInstances.has(id)) {
      console.warn(`[GameMemoryManager] 游戏实例已存在，覆盖: ${roomId}`);
      this.unregisterGame(id, true);
    }

    const entry = {
      game,
      registeredAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      stateChanges: 0,
      timerCount: 0,
      memoryEstimate: this.estimateGameMemory(game)
    };

    gameInstances.set(id, entry);
    gameHistory.set(id, {
      actions: [],
      stateSnapshots: [],
      events: [],
      errors: [],
      startTime: Date.now()
    });

    console.log(`[GameMemoryManager] 注册游戏: ${roomId}, 预计内存: ${entry.memoryEstimate}KB`);
    return true;
  }

  unregisterGame(roomId, force = false) {
    const id = parseInt(roomId);
    
    if (!gameInstances.has(id)) {
      return false;
    }

    const entry = gameInstances.get(id);
    
    this.clearAllTimers(id);
    
    if (entry.game && typeof entry.game.destroy === 'function') {
      try {
        entry.game.destroy();
      } catch (e) {
        console.error(`[GameMemoryManager] 销毁游戏实例失败:`, e);
      }
    }

    gameInstances.delete(id);
    gameHistory.delete(id);
    stateCache.delete(id);

    console.log(`[GameMemoryManager] 注销游戏: ${roomId}`);
    return true;
  }

  accessGame(roomId) {
    const id = parseInt(roomId);
    
    if (!gameInstances.has(id)) {
      return null;
    }

    const entry = gameInstances.get(id);
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;

    return entry.game;
  }

  getGameInfo(roomId) {
    const id = parseInt(roomId);
    
    if (!gameInstances.has(id)) {
      return null;
    }

    const entry = gameInstances.get(id);
    return {
      roomId: id,
      registeredAt: entry.registeredAt,
      lastAccessedAt: entry.lastAccessedAt,
      accessCount: entry.accessCount,
      stateChanges: entry.stateChanges,
      timerCount: entry.timerCount,
      memoryEstimate: entry.memoryEstimate,
      age: Date.now() - entry.registeredAt,
      idleTime: Date.now() - entry.lastAccessedAt
    };
  }

  registerTimer(roomId, timerId, timer, type = 'generic') {
    const id = parseInt(roomId);
    
    if (!gameTimers.has(id)) {
      gameTimers.set(id, new Map());
    }

    const timerMap = gameTimers.get(id);
    
    if (timerMap.has(timerId)) {
      this.clearTimer(id, timerId);
    }

    timerMap.set(timerId, {
      timer,
      type,
      createdAt: Date.now(),
      lastTriggeredAt: null,
      triggerCount: 0
    });

    const entry = gameInstances.get(id);
    if (entry) {
      entry.timerCount++;
    }

    return true;
  }

  clearTimer(roomId, timerId) {
    const id = parseInt(roomId);
    
    if (!gameTimers.has(id)) {
      return false;
    }

    const timerMap = gameTimers.get(id);
    
    if (!timerMap.has(timerId)) {
      return false;
    }

    const timerData = timerMap.get(timerId);
    
    if (timerData.timer) {
      clearTimeout(timerData.timer);
      if (typeof timerData.timer.unref === 'function') {
        try {
          timerData.timer.unref();
        } catch (e) {}
      }
    }

    timerMap.delete(timerId);

    const entry = gameInstances.get(id);
    if (entry && entry.timerCount > 0) {
      entry.timerCount--;
    }

    return true;
  }

  clearAllTimers(roomId) {
    const id = parseInt(roomId);
    
    if (!gameTimers.has(id)) {
      return;
    }

    const timerMap = gameTimers.get(id);
    
    for (const [timerId, timerData] of timerMap) {
      try {
        if (timerData.timer) {
          clearTimeout(timerData.timer);
          if (typeof timerData.timer.unref === 'function') {
            try {
              timerData.timer.unref();
            } catch (e) {}
          }
        }
      } catch (e) {
        console.error(`[GameMemoryManager] 清除计时器失败: ${timerId}`, e);
      }
    }

    timerMap.clear();
    gameTimers.delete(id);

    const entry = gameInstances.get(id);
    if (entry) {
      entry.timerCount = 0;
    }
  }

  recordAction(roomId, action, payload) {
    const id = parseInt(roomId);
    const history = gameHistory.get(id);
    
    if (!history) {
      return false;
    }

    history.actions.push({
      action,
      payload: this.sanitizePayload(payload),
      timestamp: Date.now()
    });

    if (history.actions.length > this.historyMaxLength) {
      history.actions = history.actions.slice(-this.historyMaxLength);
    }

    return true;
  }

  recordStateSnapshot(roomId, state) {
    const id = parseInt(roomId);
    const history = gameHistory.get(id);
    
    if (!history) {
      return false;
    }

    history.stateSnapshots.push({
      state: this.sanitizeState(state),
      timestamp: Date.now()
    });

    const entry = gameInstances.get(id);
    if (entry) {
      entry.stateChanges++;
    }

    if (history.stateSnapshots.length > this.maxCachedStates) {
      history.stateSnapshots = history.stateSnapshots.slice(-this.maxCachedStates);
    }

    stateCache.set(id, {
      state: history.stateSnapshots[history.stateSnapshots.length - 1],
      timestamp: Date.now()
    });

    return true;
  }

  recordEvent(roomId, eventType, data) {
    const id = parseInt(roomId);
    const history = gameHistory.get(id);
    
    if (!history) {
      return false;
    }

    history.events.push({
      type: eventType,
      data,
      timestamp: Date.now()
    });

    if (history.events.length > this.historyMaxLength) {
      history.events = history.events.slice(-this.historyMaxLength);
    }

    return true;
  }

  recordError(roomId, error) {
    const id = parseInt(roomId);
    const history = gameHistory.get(id);
    
    if (!history) {
      return false;
    }

    history.errors.push({
      message: error.message,
      stack: error.stack,
      type: error.type || 'unknown',
      timestamp: Date.now()
    });

    if (history.errors.length > 50) {
      history.errors = history.errors.slice(-50);
    }

    return true;
  }

  getGameHistory(roomId, options = {}) {
    const id = parseInt(roomId);
    const history = gameHistory.get(id);
    
    if (!history) {
      return null;
    }

    return {
      actions: options.actions !== false ? history.actions.slice(-(options.actionLimit || 100)) : [],
      stateSnapshots: options.states !== false ? history.stateSnapshots.slice(-(options.stateLimit || 20)) : [],
      events: options.events !== false ? history.events.slice(-(options.eventLimit || 100)) : [],
      errors: history.errors.slice(-(options.errorLimit || 50)),
      summary: {
        totalActions: history.actions.length,
        totalStateChanges: history.stateSnapshots.length,
        totalEvents: history.events.length,
        errorCount: history.errors.length,
        startTime: history.startTime,
        duration: Date.now() - history.startTime
      }
    };
  }

  estimateGameMemory(game) {
    if (!game) return 0;

    let estimate = 0;

    try {
      if (game.hands && typeof game.hands === 'object') {
        const handKeys = Object.keys(game.hands);
        for (const key of handKeys) {
          const hand = game.hands[key];
          if (Array.isArray(hand)) {
            estimate += hand.length * 100;
          }
        }
      }

      if (game.board && Array.isArray(game.board)) {
        estimate += game.board.length * game.board[0]?.length * 50 || 0;
      }

      if (game.playerBets && typeof game.playerBets === 'object') {
        estimate += Object.keys(game.playerBets).length * 100;
      }

      if (game.playerIds && Array.isArray(game.playerIds)) {
        estimate += game.playerIds.length * 50;
      }

      estimate += 500;
    } catch (e) {
      estimate = 1000;
    }

    return Math.round(estimate / 1024);
  }

  sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;

    for (const key of Object.keys(sanitized)) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizePayload(sanitized[key]);
      }
    }

    return sanitized;
  }

  sanitizeState(state) {
    if (!state || typeof state !== 'object') {
      return state;
    }

    const sanitized = { ...state };
    delete sanitized.hands;
    delete sanitized.privateState;

    return sanitized;
  }

  async cleanupIdleGames() {
    if (isShuttingDown) return [];

    const now = Date.now();
    const idleThreshold = this.gameTTL;
    const cleaned = [];

    for (const [roomId, entry] of gameInstances) {
      const idleTime = now - entry.lastAccessedAt;

      if (idleTime > idleThreshold) {
        console.log(`[GameMemoryManager] 清理空闲游戏: ${roomId}, 空闲时间: ${Math.round(idleTime / 60000)}分钟`);
        
        this.recordEvent(roomId, 'auto_cleanup', {
          idleTime,
          accessCount: entry.accessCount,
          stateChanges: entry.stateChanges
        });

        this.unregisterGame(roomId);
        cleaned.push(roomId);
      }
    }

    return cleaned;
  }

  async cleanupOldHistory() {
    for (const [roomId, history] of gameHistory) {
      const entry = gameInstances.get(roomId);
      
      if (!entry) {
        gameHistory.delete(roomId);
        continue;
      }

      const maxAge = this.gameTTL;
      const now = Date.now();

      if (history.actions.length > this.historyMaxLength) {
        history.actions = history.actions.slice(-this.historyMaxLength);
      }

      if (history.events.length > this.historyMaxLength) {
        history.events = history.events.slice(-this.historyMaxLength);
      }

      const recentStates = history.stateSnapshots.filter(
        s => now - s.timestamp < maxAge
      );

      if (recentStates.length < history.stateSnapshots.length) {
        history.stateSnapshots = recentStates;
      }
    }
  }

  startAutoCleanup() {
    if (!this.enableAutoCleanup || cleanupInterval) {
      return;
    }

    console.log(`[GameMemoryManager] 启动自动清理服务，间隔: ${this.cleanupInterval}ms`);

    cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanupIdleGames();
        if (cleaned.length > 0) {
          console.log(`[GameMemoryManager] 自动清理完成: ${cleaned.length} 个游戏`);
        }
        await this.cleanupOldHistory();
      } catch (e) {
        console.error('[GameMemoryManager] 自动清理失败:', e);
      }
    }, this.cleanupInterval);

    if (typeof cleanupInterval.unref === 'function') {
      cleanupInterval.unref();
    }
  }

  stopAutoCleanup() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
      console.log('[GameMemoryManager] 停止自动清理服务');
    }
  }

  startMemoryMonitoring(intervalMs = 30000) {
    if (memoryMonitorInterval) {
      return;
    }

    memoryMonitorInterval = setInterval(() => {
      const stats = this.getMemoryStats();
      this.logMemoryStats(stats);
    }, intervalMs);

    if (typeof memoryMonitorInterval.unref === 'function') {
      memoryMonitorInterval.unref();
    }

    console.log(`[GameMemoryManager] 启动内存监控，间隔: ${intervalMs}ms`);
  }

  stopMemoryMonitoring() {
    if (memoryMonitorInterval) {
      clearInterval(memoryMonitorInterval);
      memoryMonitorInterval = null;
      console.log('[GameMemoryManager] 停止内存监控');
    }
  }

  getMemoryStats() {
    const stats = {
      timestamp: Date.now(),
      gameCount: gameInstances.size,
      timerCount: 0,
      historyCount: gameHistory.size,
      cachedStates: stateCache.size,
      totalActions: 0,
      totalStateSnapshots: 0,
      totalEvents: 0,
      totalErrors: 0,
      memoryUsage: {
        games: 0,
        timers: 0,
        history: 0
      },
      idleGames: [],
      oldGames: []
    };

    const now = Date.now();
    const idleThreshold = 30 * 60 * 1000;
    const oldThreshold = 60 * 60 * 1000;

    for (const [roomId, entry] of gameInstances) {
      stats.timerCount += entry.timerCount;
      stats.memoryUsage.games += entry.memoryEstimate;

      const idleTime = now - entry.lastAccessedAt;
      if (idleTime > idleThreshold) {
        stats.idleGames.push({
          roomId,
          idleTime: Math.round(idleTime / 60000)
        });
      }

      const age = now - entry.registeredAt;
      if (age > oldThreshold) {
        stats.oldGames.push({
          roomId,
          age: Math.round(age / 3600000)
        });
      }
    }

    for (const [roomId, history] of gameHistory) {
      stats.totalActions += history.actions.length;
      stats.totalStateSnapshots += history.stateSnapshots.length;
      stats.totalEvents += history.events.length;
      stats.totalErrors += history.errors.length;
    }

    stats.memoryUsage.history = Math.round(
      (stats.totalActions + stats.totalEvents) * 0.1
    );

    return stats;
  }

  logMemoryStats(stats) {
    const idlePercent = stats.idleGames.length / Math.max(1, stats.gameCount) * 100;
    const errorPercent = stats.totalErrors / Math.max(1, stats.totalActions) * 100;

    console.log(`[GameMemoryManager] 内存统计: 游戏=${stats.gameCount}, 计时器=${stats.timerCount}, 错误率=${errorPercent.toFixed(2)}%`);

    if (stats.idleGames.length > 0) {
      console.warn(`[GameMemoryManager] 警告: ${stats.idleGames.length} 个游戏空闲超过30分钟`);
    }

    if (stats.oldGames.length > 0) {
      console.warn(`[GameMemoryManager] 警告: ${stats.oldGames.length} 个游戏运行超过1小时`);
    }
  }

  getResourcePool(name) {
    if (!resourcePools.has(name)) {
      resourcePools.set(name, {
        available: [],
        inUse: new Map(),
        config: {
          maxSize: 10,
          create: null,
          destroy: null
        }
      });
    }
    return resourcePools.get(name);
  }

  configureResourcePool(name, config) {
    const pool = this.getResourcePool(name);
    pool.config = { ...pool.config, ...config };
  }

  acquireFromPool(name) {
    const pool = this.getResourcePool(name);
    
    if (pool.available.length > 0) {
      return pool.available.pop();
    }

    if (pool.config.create) {
      return pool.config.create();
    }

    return {};
  }

  returnToPool(name, resource) {
    const pool = this.getResourcePool(name);
    
    if (pool.available.length < pool.config.maxSize) {
      pool.available.push(resource);
      return true;
    }

    if (pool.config.destroy) {
      pool.config.destroy(resource);
    }

    return false;
  }

  async shutdown() {
    if (isShuttingDown) return;

    console.log('[GameMemoryManager] 开始关闭...');
    isShuttingDown = true;

    this.stopAutoCleanup();
    this.stopMemoryMonitoring();

    for (const [roomId] of gameInstances) {
      this.unregisterGame(roomId);
    }

    gameInstances.clear();
    gameTimers.clear();
    gameHistory.clear();
    stateCache.clear();
    playerSessions.clear();

    for (const [name, pool] of resourcePools) {
      if (pool.config.destroy) {
        for (const resource of pool.available) {
          pool.config.destroy(resource);
        }
      }
    }

    resourcePools.clear();

    console.log('[GameMemoryManager] 关闭完成');
  }

  static getInstance(options = {}) {
    if (!globalGameMemoryManager) {
      globalGameMemoryManager = new GameMemoryManager(options);
    }
    return globalGameMemoryManager;
  }
}

let globalGameMemoryManager = null;

export function getGameMemoryManager() {
  return GameMemoryManager.getInstance();
}

export function registerGame(roomId, game) {
  const manager = getGameMemoryManager();
  return manager.registerGame(roomId, game);
}

export function unregisterGame(roomId, force = false) {
  const manager = getGameMemoryManager();
  return manager.unregisterGame(roomId, force);
}

export function accessGame(roomId) {
  const manager = getGameMemoryManager();
  return manager.accessGame(roomId);
}

export function registerTimer(roomId, timerId, timer, type) {
  const manager = getGameMemoryManager();
  return manager.registerTimer(roomId, timerId, timer, type);
}

export function clearTimer(roomId, timerId) {
  const manager = getGameMemoryManager();
  return manager.clearTimer(roomId, timerId);
}

export function clearAllTimers(roomId) {
  const manager = getGameMemoryManager();
  return manager.clearAllTimers(roomId);
}

export function recordGameAction(roomId, action, payload) {
  const manager = getGameMemoryManager();
  return manager.recordAction(roomId, action, payload);
}

export function recordStateSnapshot(roomId, state) {
  const manager = getGameMemoryManager();
  return manager.recordStateSnapshot(roomId, state);
}

export function getGameMemoryStats() {
  const manager = getGameMemoryManager();
  return manager.getMemoryStats();
}

process.on('SIGTERM', async () => {
  console.log('[GameMemoryManager] 收到 SIGTERM 信号');
  const manager = getGameMemoryManager();
  await manager.shutdown();
});

process.on('SIGINT', async () => {
  console.log('[GameMemoryManager] 收到 SIGINT 信号');
  const manager = getGameMemoryManager();
  await manager.shutdown();
});
