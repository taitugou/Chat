-- Super Admin System Database Tables
-- Created: 2026-01-01

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  role_id INT NOT NULL,
  assigned_by BIGINT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uk_user_role (user_id, role_id),
  INDEX idx_user_id (user_id),
  INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Operation Logs Table
CREATE TABLE IF NOT EXISTS operation_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  username VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  request_method VARCHAR(10),
  request_url VARCHAR(500),
  request_params JSON,
  response_status INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  execution_time INT,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_module (module),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. System Logs Table
CREATE TABLE IF NOT EXISTS system_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  level VARCHAR(20) NOT NULL,
  module VARCHAR(50),
  message TEXT NOT NULL,
  data JSON,
  stack_trace TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_level (level),
  INDEX idx_module (module),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. System Configs Table
CREATE TABLE IF NOT EXISTS system_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT,
  config_type VARCHAR(20) DEFAULT 'string',
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Login History Table
CREATE TABLE IF NOT EXISTS login_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  username VARCHAR(100) NOT NULL,
  login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_time TIMESTAMP NULL,
  ip_address VARCHAR(45),
  location VARCHAR(100),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'success',
  failure_reason VARCHAR(200),
  INDEX idx_user_id (user_id),
  INDEX idx_login_time (login_time),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  activity_data JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_activity_type (activity_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Statistics Table
CREATE TABLE IF NOT EXISTS statistics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stat_date DATE NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  stat_key VARCHAR(100) NOT NULL,
  stat_value BIGINT DEFAULT 0,
  stat_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stat (stat_date, stat_type, stat_key),
  INDEX idx_stat_date (stat_date),
  INDEX idx_stat_type (stat_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. System Notifications Table
CREATE TABLE IF NOT EXISTS system_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  type VARCHAR(20) DEFAULT 'info',
  target_type VARCHAR(20) DEFAULT 'all',
  target_id BIGINT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  INDEX idx_target (target_type, target_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Scheduled Tasks Table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_name VARCHAR(100) NOT NULL UNIQUE,
  task_type VARCHAR(50) NOT NULL,
  task_handler VARCHAR(200),
  cron_expression VARCHAR(100),
  task_params JSON,
  status VARCHAR(20) DEFAULT 'active',
  last_run_at TIMESTAMP NULL,
  next_run_at TIMESTAMP NULL,
  run_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_next_run_at (next_run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Data Backups Table
CREATE TABLE IF NOT EXISTS data_backups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  backup_name VARCHAR(200) NOT NULL,
  backup_type VARCHAR(50) NOT NULL,
  backup_path VARCHAR(500),
  backup_size BIGINT,
  status VARCHAR(20) DEFAULT 'pending',
  tables JSON,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  error_message TEXT,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Security Audits Table
CREATE TABLE IF NOT EXISTS security_audits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  audit_type VARCHAR(50) NOT NULL,
  user_id BIGINT,
  username VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id BIGINT,
  details JSON,
  risk_level VARCHAR(20) DEFAULT 'low',
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_audit_type (audit_type),
  INDEX idx_risk_level (risk_level),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default roles
INSERT INTO roles (name, display_name, description, permissions, is_system) VALUES
('super_admin', 'Super Admin', 'Full system access', JSON_ARRAY('*'), TRUE),
('admin', 'Admin', 'Most management permissions', JSON_ARRAY('user:*', 'post:*', 'comment:*', 'stats:*', 'monitor:*'), TRUE),
('moderator', 'Moderator', 'Content moderation permissions', JSON_ARRAY('post:read', 'post:delete', 'comment:read', 'comment:delete'), TRUE),
('user', 'User', 'Basic user permissions', JSON_ARRAY('user:read', 'post:create', 'post:read', 'comment:create'), TRUE)
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name);

-- Insert default system configs
INSERT INTO system_configs (config_key, config_value, config_type, description, is_public, category) VALUES
('site_name', 'TTG Chat', 'string', 'Site name', TRUE, 'general'),
('site_description', 'TTG Chat - Social Chat Platform', 'string', 'Site description', TRUE, 'general'),
('maintenance_mode', 'false', 'boolean', 'Maintenance mode', FALSE, 'system'),
('max_upload_size', '10485760', 'number', 'Max upload file size in bytes', FALSE, 'upload'),
('allowed_file_types', '["jpg","jpeg","png","gif","mp4","webm"]', 'json', 'Allowed file types', FALSE, 'upload'),
('user_registration_enabled', 'true', 'boolean', 'Allow user registration', FALSE, 'user'),
('default_user_level', '1', 'number', 'Default user level', FALSE, 'user'),
('points_enabled', 'true', 'boolean', 'Enable points system', FALSE, 'points'),
('points_checkin_reward', '10', 'number', 'Check-in points reward', FALSE, 'points'),
('api_rate_limit_enabled', 'true', 'boolean', 'Enable API rate limiting', FALSE, 'security'),
('api_rate_limit_max', '100', 'number', 'API rate limit max requests', FALSE, 'security'),
('session_timeout', '604800', 'number', 'Session timeout in seconds', FALSE, 'security')
ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);

-- Create indexes for better query performance
CREATE INDEX idx_operation_logs_user_created ON operation_logs(user_id, created_at);
CREATE INDEX idx_system_logs_level_created ON system_logs(level, created_at);
CREATE INDEX idx_security_audits_risk_created ON security_audits(risk_level, created_at);
