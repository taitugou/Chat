import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

const stateSyncHistory = ref([]);
const MAX_SYNC_HISTORY = 50;
const SYNC_DEBOUNCE_MS = 50;

export const useGameStateStore = defineStore('gameState', () => {
  const stateSnapshot = ref({});
  const pendingUpdates = ref(new Map());
  const lastSyncTime = ref(Date.now());
  const syncInProgress = ref(false);
  const localOptimisticState = ref({});
  const actionLog = ref([]);
  const errorQueue = ref([]);

  const isStale = computed(() => {
    return Date.now() - lastSyncTime.value > 5000;
  });

  const pendingCount = computed(() => pendingUpdates.value.size);

  const recentStates = computed(() => {
    return stateSyncHistory.value.slice(-10);
  });

  function recordStateUpdate(update, source = 'server') {
    const timestamp = Date.now();
    const entry = {
      timestamp,
      update,
      source,
      latency: source === 'server' ? timestamp - lastSyncTime.value : 0
    };
    
    stateSyncHistory.value.push(entry);
    if (stateSyncHistory.value.length > MAX_SYNC_HISTORY) {
      stateSyncHistory.value.shift();
    }
    
    lastSyncTime.value = timestamp;
  }

  function applyServerUpdate(update) {
    if (!update || typeof update !== 'object') return false;

    const newState = update.gameState || update;
    
    const optimisticKey = generateStateHash(localOptimisticState.value);
    const serverKey = generateStateHash(newState);
    
    if (optimisticKey === serverKey) {
      pendingUpdates.value.delete(optimisticKey);
    }

    stateSnapshot.value = deepMerge(stateSnapshot.value, newState);
    recordStateUpdate(update, 'server');
    
    return true;
  }

  function applyOptimisticUpdate(action, payload) {
    const currentState = stateSnapshot.value;
    const optimisticState = generateOptimisticState(currentState, action, payload);
    
    if (optimisticState) {
      localOptimisticState.value = optimisticState;
      const hash = generateStateHash(optimisticState);
      pendingUpdates.value.set(hash, { action, payload, timestamp: Date.now() });
      
      stateSnapshot.value = optimisticState;
      recordStateUpdate({ action, payload }, 'optimistic');
      
      return true;
    }
    
    return false;
  }

  function generateOptimisticState(currentState, action, payload) {
    if (!currentState || typeof currentState !== 'object') return null;
    
    const newState = { ...currentState };
    
    switch (action) {
      case 'bet':
      case 'raise':
      case 'call':
        if (payload?.amount) {
          const userId = payload.userId || payload.targetId;
          if (userId) {
            newState.playerBets = {
              ...(newState.playerBets || {}),
              [userId]: (Number(newState.playerBets?.[userId]) || 0) + Number(payload.amount)
            };
            newState.pot = (Number(newState.pot) || 0) + Number(payload.amount);
          }
        }
        break;
        
      case 'fold':
        if (payload?.userId) {
          newState.playerStatus = {
            ...(newState.playerStatus || {}),
            [payload.userId]: 'folded'
          };
        }
        break;
        
      case 'play':
        if (payload?.cardIds && payload?.userId) {
          newState.playedCards = [
            ...(newState.playedCards || []),
            { userId: payload.userId, cards: payload.cardIds, timestamp: Date.now() }
          ];
        }
        break;
        
      case 'discard':
      case 'place':
        if (payload?.userId) {
          newState.lastAction = {
            type: action,
            userId: payload.userId,
            data: payload,
            timestamp: Date.now()
          };
        }
        break;
    }
    
    return newState;
  }

  function generateStateHash(state) {
    if (!state) return 'empty';
    const str = JSON.stringify(state, Object.keys(state).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  function deepMerge(target, source) {
    if (!target || typeof target !== 'object') return source;
    if (!source || typeof source !== 'object') return target;
    
    const result = Array.isArray(target) ? [...target] : { ...target };
    
    for (const key of Object.keys(source)) {
      const targetValue = result[key];
      const sourceValue = source[key];
      
      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }
    
    return result;
  }

  function addLog(text) {
    actionLog.value.unshift({
      id: `${Date.now()}-${Math.random()}`,
      text,
      timestamp: Date.now()
    });
    
    if (actionLog.value.length > 100) {
      actionLog.value = actionLog.value.slice(0, 100);
    }
  }

  function queueError(error) {
    errorQueue.value.push({
      error,
      timestamp: Date.now(),
      retryCount: 0
    });
    
    if (errorQueue.value.length > 20) {
      errorQueue.value.shift();
    }
  }

  function clearPendingUpdates() {
    pendingUpdates.value.clear();
    localOptimisticState.value = {};
  }

  function resetState() {
    stateSnapshot.value = {};
    pendingUpdates.value.clear();
    localOptimisticState.value = {};
    actionLog.value = [];
    errorQueue.value = [];
    stateSyncHistory.value = [];
    lastSyncTime.value = Date.now();
  }

  function getStateDiff(state1, state2) {
    const diff = {};
    const allKeys = new Set([...Object.keys(state1 || {}), ...Object.keys(state2 || {})]);
    
    for (const key of allKeys) {
      const val1 = state1?.[key];
      const val2 = state2?.[key];
      
      if (val1 !== val2) {
        diff[key] = {
          from: val1,
          to: val2
        };
      }
    }
    
    return diff;
  }

  function getSyncStats() {
    return {
      lastSyncTime: lastSyncTime.value,
      isStale: isStale.value,
      pendingCount: pendingCount.value,
      historyLength: stateSyncHistory.value.length,
      recentStates: recentStates.value.length
    };
  }

  return {
    stateSnapshot,
    pendingUpdates,
    lastSyncTime,
    syncInProgress,
    localOptimisticState,
    actionLog,
    errorQueue,
    isStale,
    pendingCount,
    recentStates,
    recordStateUpdate,
    applyServerUpdate,
    applyOptimisticUpdate,
    addLog,
    queueError,
    clearPendingUpdates,
    resetState,
    getStateDiff,
    getSyncStats
  };
});

export function createGameStateSynchronizer(handlers = {}) {
  const store = useGameStateStore();
  let updateTimeout = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;

  const handlers = {
    onStateUpdate: handlers.onStateUpdate || (() => {}),
    onError: handlers.onError || ((err) => console.error('Game state sync error:', err)),
    onReconnecting: handlers.onReconnecting || (() => {}),
    onReconnected: handlers.onReconnected || (() => {}),
    onStale: handlers.onStale || (() => {})
  };

  function handleServerUpdate(data) {
    const update = data.gameState || data;
    const previousState = store.stateSnapshot;
    
    const merged = store.applyServerUpdate(update);
    
    if (merged) {
      const diff = store.getStateDiff(previousState, store.stateSnapshot);
      handlers.onStateUpdate({
        newState: store.stateSnapshot,
        previousState,
        diff,
        timestamp: Date.now()
      });
    }
  }

  function sendOptimisticAction(action, payload) {
    try {
      const applied = store.applyOptimisticUpdate(action, payload);
      
      if (applied) {
        store.addLog(`本地执行: ${action}`);
        
        if (updateTimeout) clearTimeout(updateTimeout);
        
        updateTimeout = setTimeout(() => {
          handlers.onError(new Error('Action timeout - waiting for server confirmation'));
        }, 5000);
      }
      
      return applied;
    } catch (error) {
      store.queueError(error);
      handlers.onError(error);
      return false;
    }
  }

  function handleReconnecting() {
    reconnectAttempts++;
    handlers.onReconnecting({ attempts: reconnectAttempts });
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      handlers.onError(new Error('Maximum reconnection attempts reached'));
    }
  }

  function handleReconnected() {
    reconnectAttempts = 0;
    handlers.onReconnected();
    store.clearPendingUpdates();
  }

  function handleStaleState() {
    if (store.isStale) {
      handlers.onStale({
        lastSync: store.lastSyncTime,
        duration: Date.now() - store.lastSyncTime
      });
    }
  }

  function syncWithServer(fetchFn) {
    return new Promise((resolve, reject) => {
      fetchFn()
        .then((response) => {
          handleServerUpdate(response.data || response);
          resolve(store.stateSnapshot);
        })
        .catch((error) => {
          handlers.onError(error);
          reject(error);
        });
    });
  }

  function cleanup() {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
      updateTimeout = null;
    }
    store.resetState();
  }

  function getStats() {
    return {
      ...store.getSyncStats(),
      reconnectAttempts,
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
    };
  }

  return {
    store,
    handleServerUpdate,
    sendOptimisticAction,
    handleReconnecting,
    handleReconnected,
    handleStaleState,
    syncWithServer,
    cleanup,
    getStats
  };
}

export function useOptimisticActions() {
  const gameStateStore = useGameStateStore();
  const pendingActions = ref(new Map());
  const actionResults = ref(new Map());

  function createOptimisticAction(actionType) {
    const actionId = `${actionType}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    return {
      id: actionId,
      type: actionType,
      status: 'pending',
      timestamp: Date.now(),
      
      start(payload) {
        this.status = 'pending';
        pendingActions.value.set(actionId, {
          ...this,
          payload,
          startTime: Date.now()
        });
        
        const applied = gameStateStore.applyOptimisticUpdate(actionType, payload);
        
        if (applied) {
          this.status = 'applied';
        } else {
          this.status = 'failed';
          pendingActions.value.delete(actionId);
        }
        
        return this;
      },
      
      confirm(serverResponse) {
        this.status = 'confirmed';
        this.serverResponse = serverResponse;
        actionResults.value.set(actionId, { ...this });
        pendingActions.value.delete(actionId);
        return this;
      },
      
      reject(error) {
        this.status = 'rejected';
        this.error = error;
        gameStateStore.queueError(error);
        pendingActions.value.delete(actionId);
        return this;
      },
      
      rollback() {
        this.status = 'rolled_back';
        gameStateStore.clearPendingUpdates();
        pendingActions.value.delete(actionId);
        return this;
      }
    };
  }

  function getPendingActions() {
    return Array.from(pendingActions.value.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  function clearOldActions(maxAge = 60000) {
    const now = Date.now();
    for (const [id, action] of pendingActions.value) {
      if (now - action.startTime > maxAge) {
        pendingActions.value.delete(id);
      }
    }
  }

  return {
    pendingActions: computed(() => getPendingActions()),
    actionResults: computed(() => Array.from(actionResults.value.values())),
    createOptimisticAction,
    clearOldActions
  };
}
