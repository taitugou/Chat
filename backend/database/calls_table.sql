-- Calls Table for Voice/Video Call Monitoring
-- Created: 2026-02-12

CREATE TABLE IF NOT EXISTS calls (
  id INT PRIMARY KEY AUTO_INCREMENT,
  caller_id BIGINT NOT NULL,
  callee_id BIGINT NOT NULL,
  type ENUM('voice', 'video') DEFAULT 'voice',
  status ENUM('pending', 'active', 'ended', 'rejected', 'missed', 'terminated') DEFAULT 'pending',
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  terminated_by BIGINT NULL,
  termination_reason VARCHAR(200) NULL,
  call_quality JSON NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (terminated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_caller_id (caller_id),
  INDEX idx_callee_id (callee_id),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
