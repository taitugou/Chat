import { query } from '../database/connection.js';

const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication', 
  AUTHORIZATION: 'authorization',
  DATABASE: 'database',
  GAME_LOGIC: 'game_logic',
  TRANSACTION: 'transaction',
  SOCKET: 'socket',
  NETWORK: 'network',
  EXTERNAL_SERVICE: 'external_service',
  UNKNOWN: 'unknown'
};

const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

const ERROR_STATUS = {
  NEW: 'new',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  IGNORED: 'ignored'
};

const errorLogs = new Map();
const MAX_CACHED_LOGS = 1000;
const ERROR_AGGREGATION_WINDOW_MS = 60000;

class GameErrorAggregator {
  constructor() {
    this.errorCounts = new Map();
    this.errorTimes = new Map();
    this.alertThresholds = new Map();
    this.alertCallbacks = new Map();
  }

  registerAlert(category, threshold, callback) {
    this.alertThresholds.set(category, {
      count: threshold.count || 10,
      windowMs: threshold.windowMs || ERROR_AGGREGATION_WINDOW_MS,
      callback
    });
    this.alertCallbacks.set(category, callback);
  }

  recordError(error, context = {}) {
    const errorKey = this.generateErrorKey(error);
    const now = Date.now();
    
    if (!this.errorTimes.has(errorKey)) {
      this.errorTimes.set(errorKey, []);
    }
    
    const times = this.errorTimes.get(errorKey);
    times.push(now);
    
    while (times.length > 0 && now - times[0] > ERROR_AGGREGATION_WINDOW_MS) {
      times.shift();
    }
    
    const count = times.length;
    this.errorCounts.set(errorKey, {
      error,
      count,
      lastOccurrence: now,
      context
    });
    
    this.checkAlerts(errorKey, count, context);
    
    if (errorLogs.size >= MAX_CACHED_LOGS) {
      const oldestKey = errorLogs.keys().next().value;
      errorLogs.delete(oldestKey);
    }
    
    return { errorKey, count, isAlert: count > (this.alertThresholds.get(errorKey)?.count || 10) };
  }

  generateErrorKey(error) {
    if (typeof error === 'string') {
      return `${ERROR_CATEGORIES.UNKNOWN}:${error.substring(0, 100)}`;
    }
    
    const code = error.code || error.name || 'UNKNOWN';
    const message = error.message || String(error).substring(0, 200);
    return `${code}:${message}`;
  }

  checkAlerts(errorKey, count, context) {
    const threshold = this.alertThresholds.get(errorKey);
    if (!threshold) return;
    
    if (count >= threshold.count) {
      const alert = {
        errorKey,
        count,
        threshold: threshold.count,
        context,
        timestamp: Date.now()
      };
      
      if (threshold.callback) {
        try {
          threshold.callback(alert);
        } catch (e) {
          console.error('Error alert callback failed:', e);
        }
      }
    }
  }

  getErrorStats(category = null) {
    const stats = {
      totalErrors: 0,
      byCategory: {},
      recentErrors: [],
      topErrors: []
    };
    
    for (const [key, data] of this.errorCounts) {
      stats.totalErrors += data.count;
      
      const cat = data.error.category || this.categorizeError(data.error);
      if (!stats.byCategory[cat]) {
        stats.byCategory[cat] = { count: 0, errors: [] };
      }
      stats.byCategory[cat].count += data.count;
      stats.byCategory[cat].errors.push({
        key,
        count: data.count,
        lastOccurrence: data.lastOccurrence
      });
    }
    
    for (const cat of Object.keys(stats.byCategory)) {
      stats.byCategory[cat].errors.sort((a, b) => b.count - a.count);
      stats.topErrors.push(...stats.byCategory[cat].errors.slice(0, 5));
    }
    
    stats.topErrors.sort((a, b) => b.count - a.count);
    stats.topErrors = stats.topErrors.slice(0, 10);
    
    return stats;
  }

  categorizeError(error) {
    if (error.category) return error.category;
    
    const msg = String(error.message || '').toLowerCase();
    const code = String(error.code || '').toLowerCase();
    
    if (msg.includes('validation') || msg.includes('不合法') || msg.includes('无效')) {
      return ERROR_CATEGORIES.VALIDATION;
    }
    if (msg.includes('auth') || msg.includes('登录') || msg.includes('权限')) {
      return ERROR_CATEGORIES.AUTHENTICATION;
    }
    if (msg.includes('database') || msg.includes('sql') || msg.includes('mysql')) {
      return ERROR_CATEGORIES.DATABASE;
    }
    if (msg.includes('transaction') || msg.includes('事务') || msg.includes('deadlock')) {
      return ERROR_CATEGORIES.TRANSACTION;
    }
    if (msg.includes('socket') || msg.includes('connection') || msg.includes('断开')) {
      return ERROR_CATEGORIES.SOCKET;
    }
    if (msg.includes('game') || msg.includes('游戏') || msg.includes('结算')) {
      return ERROR_CATEGORIES.GAME_LOGIC;
    }
    
    return ERROR_CATEGORIES.UNKNOWN;
  }

  clear() {
    this.errorCounts.clear();
    this.errorTimes.clear();
  }
}

export const errorAggregator = new GameErrorAggregator();

errorAggregator.registerAlert(
  ERROR_CATEGORIES.DATABASE,
  { count: 5, windowMs: 60000 },
  (alert) => {
    console.error('[ERROR_MONITOR] 数据库错误预警:', alert);
    notifyAdmins('database_error_alert', alert);
  }
);

errorAggregator.registerAlert(
  ERROR_CATEGORIES.TRANSACTION,
  { count: 3, windowMs: 60000 },
  (alert) => {
    console.error('[ERROR_MONITOR] 事务错误预警:', alert);
    notifyAdmins('transaction_error_alert', alert);
  }
);

errorAggregator.registerAlert(
  ERROR_CATEGORIES.GAME_LOGIC,
  { count: 10, windowMs: 60000 },
  (alert) => {
    console.warn('[ERROR_MONITOR] 游戏逻辑错误预警:', alert);
  }
);

async function notifyAdmins(type, data) {
  try {
    await query(
      `INSERT INTO system_notifications (type, title, content, is_read, created_at)
       VALUES (?, ?, ?, FALSE, NOW())`,
      [
        type,
        `系统告警: ${type}`,
        JSON.stringify({
          message: `${type} 告警`,
          timestamp: new Date().toISOString(),
          details: data
        })
      ]
    );
  } catch (e) {
    console.error('Failed to send admin notification:', e);
  }
}

export function logGameError(error, context = {}) {
  const categorizedError = {
    ...error,
    category: errorAggregator.categorizeError(error),
    severity: determineSeverity(error),
    context: {
      ...context,
      userAgent: context.userAgent || 'unknown',
      timestamp: new Date().toISOString(),
      stackTrace: error.stack
    }
  };

  errorAggregator.recordError(categorizedError, context);

  const logEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    ...categorizedError,
    loggedAt: new Date().toISOString()
  };

  errorLogs.set(logEntry.id, logEntry);

  return logEntry;
}

function determineSeverity(error) {
  const code = error.code || '';
  const message = error.message || '';
  
  const criticalPatterns = [
    'deadlock', 'transaction', 'rollback', 'fatal', 'critical',
    '数据库连接失败', '事务死锁', '资金异常'
  ];
  
  const warningPatterns = [
    'timeout', 'retry', 'deprecated', 'performance',
    '超时', '重试', '性能警告'
  ];
  
  for (const pattern of criticalPatterns) {
    if (code.toLowerCase().includes(pattern) || message.toLowerCase().includes(pattern)) {
      return ERROR_SEVERITY.CRITICAL;
    }
  }
  
  for (const pattern of warningPatterns) {
    if (code.toLowerCase().includes(pattern) || message.toLowerCase().includes(pattern)) {
      return ERROR_SEVERITY.WARNING;
    }
  }
  
  return ERROR_SEVERITY.ERROR;
}

export async function getErrorLogs(filters = {}) {
  const { category, severity, status, startDate, endDate, limit = 100 } = filters;
  
  let sql = `
    SELECT el.*, 
           u.username, u.nickname
    FROM error_logs el
    LEFT JOIN users u ON el.user_id = u.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (category) {
    sql += ' AND el.category = ?';
    params.push(category);
  }
  
  if (severity) {
    sql += ' AND el.severity = ?';
    params.push(severity);
  }
  
  if (status) {
    sql += ' AND el.status = ?';
    params.push(status);
  }
  
  if (startDate) {
    sql += ' AND el.created_at >= ?';
    params.push(new Date(startDate));
  }
  
  if (endDate) {
    sql += ' AND el.created_at <= ?';
    params.push(new Date(endDate));
  }
  
  sql += ' ORDER BY el.created_at DESC LIMIT ?';
  params.push(Number(limit) || 100);
  
  try {
    const [rows] = await query(sql, params);
    return rows;
  } catch (error) {
    console.error('获取错误日志失败:', error);
    return [];
  }
}

export async function createErrorLog(error, context = {}) {
  try {
    const categorizedError = {
      ...error,
      category: errorAggregator.categorizeError(error),
      severity: determineSeverity(error),
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        stackTrace: error.stack
      }
    };

    const result = await query(
      `INSERT INTO error_logs 
       (error_code, error_message, category, severity, context, user_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        error.code || 'UNKNOWN',
        error.message || String(error),
        categorizedError.category,
        categorizedError.severity,
        JSON.stringify(categorizedError.context),
        context.userId || null,
        ERROR_STATUS.NEW
      ]
    );

    return { id: result.insertId, ...categorizedError };
  } catch (e) {
    console.error('保存错误日志失败:', e);
    return null;
  }
}

export async function updateErrorStatus(errorId, status, notes = '') {
  try {
    await query(
      `UPDATE error_logs SET status = ?, resolution_notes = ?, resolved_at = NOW() WHERE id = ?`,
      [status, notes, errorId]
    );
    return { success: true };
  } catch (error) {
    console.error('更新错误状态失败:', error);
    return { success: false, error };
  }
}

export async function getErrorStatistics(startDate, endDate) {
  try {
    const [categoryStats] = await query(
      `SELECT category, severity, COUNT(*) as count
       FROM error_logs
       WHERE created_at BETWEEN ? AND ?
       GROUP BY category, severity
       ORDER BY count DESC`,
      [new Date(startDate), new Date(endDate)]
    );

    const [trendStats] = await query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM error_logs
       WHERE created_at BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [new Date(startDate), new Date(endDate)]
    );

    const [topErrors] = await query(
      `SELECT error_code, error_message, category, COUNT(*) as occurrences
       FROM error_logs
       WHERE created_at BETWEEN ? AND ?
       GROUP BY error_code, error_message
       ORDER BY occurrences DESC
       LIMIT 10`,
      [new Date(startDate), new Date(endDate)]
    );

    return {
      byCategory: categoryStats,
      trend: trendStats,
      topErrors
    };
  } catch (error) {
    console.error('获取错误统计失败:', error);
    return null;
  }
}

export function withErrorLogging(operation, context = {}) {
  return async (...args) => {
    try {
      const result = await operation(...args);
      return result;
    } catch (error) {
      const logEntry = logGameError(error, {
        ...context,
        operation: operation.name || 'anonymous',
        arguments: args.length <= 3 ? args : '[arguments too long]'
      });

      throw {
        ...error,
        logId: logEntry?.id,
        logged: true
      };
    }
  };
}

export function createCircuitBreaker(name, options = {}) {
  const failureThreshold = options.failureThreshold || 5;
  const resetTimeout = options.resetTimeout || 30000;
  
  let failureCount = 0;
  let lastFailureTime = null;
  let state = 'CLOSED';

  return {
    name,
    
    getState() {
      return state;
    },
    
    async execute(operation) {
      if (state === 'OPEN') {
        if (Date.now() - lastFailureTime > resetTimeout) {
          state = 'HALF_OPEN';
          failureCount = 0;
        } else {
          throw new Error(`Circuit breaker ${name} is OPEN`);
        }
      }
      
      try {
        const result = await operation();
        
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failureCount = 0;
          console.log(`[CircuitBreaker] ${name} 已恢复正常`);
        }
        
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = Date.now();
        
        if (failureCount >= failureThreshold) {
          state = 'OPEN';
          console.error(`[CircuitBreaker] ${name} 已打开，连续失败 ${failureCount} 次`);
          
          logGameError(new Error(`Circuit breaker ${name} opened`), {
            failureCount,
            threshold: failureThreshold,
            lastFailureTime
          });
        }
        
        throw error;
      }
    },
    
    reset() {
      failureCount = 0;
      lastFailureTime = null;
      state = 'CLOSED';
    },
    
    getStats() {
      return {
        name,
        state,
        failureCount,
        lastFailureTime,
        threshold: failureThreshold
      };
    }
  };
}

export function createRateLimiter(windowMs = 60000, maxRequests = 100) {
  const requests = new Map();
  
  return {
    checkLimit(key) {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requests.has(key)) {
        requests.set(key, []);
      }
      
      const keyRequests = requests.get(key);
      const validRequests = keyRequests.filter(t => t > windowStart);
      requests.set(key, validRequests);
      
      if (validRequests.length >= maxRequests) {
        return { allowed: false, remaining: 0, resetTime: windowStart + windowMs };
      }
      
      validRequests.push(now);
      return { allowed: true, remaining: maxRequests - validRequests.length, resetTime: windowStart + windowMs };
    },
    
    getStats(key) {
      const now = Date.now();
      const windowStart = now - windowMs;
      const keyRequests = requests.get(key) || [];
      const count = keyRequests.filter(t => t > windowStart).length;
      
      return {
        current: count,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetTime: windowStart + windowMs
      };
    },
    
    clear() {
      requests.clear();
    }
  };
}

export const databaseRateLimiter = createRateLimiter(60000, 200);
export const socketRateLimiter = createRateLimiter(10000, 50);

export { ERROR_CATEGORIES, ERROR_SEVERITY, ERROR_STATUS };
