CREATE TABLE IF NOT EXISTS friend_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  requester_id BIGINT NOT NULL,
  receiver_id BIGINT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_request (requester_id, receiver_id),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_receiver (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
