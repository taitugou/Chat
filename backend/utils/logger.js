import { query } from '../database/connection.js';

export async function logOperation(data) {
  try {
    const {
      user_id,
      username,
      action,
      module,
      description,
      request_method,
      request_url,
      request_params,
      response_status,
      ip_address,
      user_agent,
      execution_time,
      status = 'success',
      error_message
    } = data;

    await query(
      `INSERT INTO operation_logs (
        user_id, username, action, module, description,
        request_method, request_url, request_params, response_status,
        ip_address, user_agent, execution_time, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        username,
        action,
        module,
        description,
        request_method,
        request_url,
        request_params ? JSON.stringify(request_params) : null,
        response_status,
        ip_address,
        user_agent,
        execution_time,
        status,
        error_message
      ]
    );
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

export async function logSystem(level, module, message, data = null, stackTrace = null) {
  try {
    await query(
      `INSERT INTO system_logs (level, module, message, data, stack_trace)
       VALUES (?, ?, ?, ?, ?)`,
      [
        level,
        module,
        message,
        data ? JSON.stringify(data) : null,
        stackTrace
      ]
    );
  } catch (error) {
    console.error('记录系统日志失败:', error);
  }
}

export async function logSecurityAudit(data) {
  try {
    const {
      audit_type,
      user_id,
      username,
      action,
      resource_type,
      resource_id,
      details,
      risk_level = 'low',
      ip_address,
      user_agent,
      status = 'success'
    } = data;

    await query(
      `INSERT INTO security_audits (
        audit_type, user_id, username, action, resource_type, resource_id,
        details, risk_level, ip_address, user_agent, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        audit_type,
        user_id,
        username,
        action,
        resource_type,
        resource_id,
        details ? JSON.stringify(details) : null,
        risk_level,
        ip_address,
        user_agent,
        status
      ]
    );
  } catch (error) {
    console.error('记录安全审计失败:', error);
  }
}

export async function getOperationLogs(filters = {}) {
  try {
    const {
      user_id,
      action,
      module,
      status,
      start_date,
      end_date,
      page = 1,
      limit = 20,
      show_invisible = false
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (!show_invisible) {
      conditions.push('is_visible = 1');
    }

    if (user_id) {
      conditions.push('user_id = ?');
      params.push(user_id);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (module) {
      conditions.push('module = ?');
      params.push(module);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (start_date) {
      conditions.push('created_at >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('created_at <= ?');
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [logs] = await query(
      `SELECT * FROM operation_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM operation_logs ${whereClause}`,
      params
    );

    return {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0]?.total || 0,
        totalPages: Math.ceil((countResult[0]?.total || 0) / parseInt(limit))
      }
    };
  } catch (error) {
    console.error('获取操作日志失败:', error);
    throw error;
  }
}

export async function getSystemLogs(filters = {}) {
  try {
    const {
      level,
      module,
      start_date,
      end_date,
      page = 1,
      limit = 20,
      show_invisible = false
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (!show_invisible) {
      conditions.push('is_visible = 1');
    }

    if (level) {
      conditions.push('level = ?');
      params.push(level);
    }
    if (module) {
      conditions.push('module = ?');
      params.push(module);
    }
    if (start_date) {
      conditions.push('created_at >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('created_at <= ?');
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [logs] = await query(
      `SELECT * FROM system_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM system_logs ${whereClause}`,
      params
    );

    return {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0]?.total || 0,
        totalPages: Math.ceil((countResult[0]?.total || 0) / parseInt(limit))
      }
    };
  } catch (error) {
    console.error('获取系统日志失败:', error);
    throw error;
  }
}

export async function getSecurityAudits(filters = {}) {
  try {
    const {
      audit_type,
      user_id,
      risk_level,
      status,
      start_date,
      end_date,
      page = 1,
      limit = 20,
      show_invisible = false
    } = filters;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (!show_invisible) {
      conditions.push('is_visible = 1');
    }

    if (audit_type) {
      conditions.push('audit_type = ?');
      params.push(audit_type);
    }
    if (user_id) {
      conditions.push('user_id = ?');
      params.push(user_id);
    }
    if (risk_level) {
      conditions.push('risk_level = ?');
      params.push(risk_level);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (start_date) {
      conditions.push('created_at >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('created_at <= ?');
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [audits] = await query(
      `SELECT * FROM security_audits ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM security_audits ${whereClause}`,
      params
    );

    return {
      audits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0]?.total || 0,
        totalPages: Math.ceil((countResult[0]?.total || 0) / parseInt(limit))
      }
    };
  } catch (error) {
    console.error('获取安全审计失败:', error);
    throw error;
  }
}

export async function logLoginHistory(data) {
  try {
    const {
      user_id,
      username,
      ip_address,
      location,
      device_type,
      browser,
      user_agent,
      status = 'success',
      failure_reason
    } = data;

    await query(
      `INSERT INTO login_history (
        user_id, username, ip_address, location, device_type,
        browser, user_agent, status, failure_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        username,
        ip_address,
        location,
        device_type,
        browser,
        user_agent,
        status,
        failure_reason
      ]
    );
  } catch (error) {
    console.error('记录登录历史失败:', error);
  }
}

export async function updateLoginLogout(userId) {
  try {
    await query(
      `UPDATE login_history 
       SET logout_time = NOW()
       WHERE user_id = ? AND logout_time IS NULL
       ORDER BY login_time DESC
       LIMIT 1`,
      [userId]
    );
  } catch (error) {
    console.error('更新登出时间失败:', error);
  }
}
