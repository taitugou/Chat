CREATE TABLE IF NOT EXISTS topics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  cover_image VARCHAR(255),
  tags JSON,
  is_hot BOOLEAN DEFAULT FALSE,
  is_top BOOLEAN DEFAULT FALSE,
  status ENUM('active', 'locked', 'deleted') DEFAULT 'active',
  view_count INT DEFAULT 0,
  post_count INT DEFAULT 0,
  follow_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_is_hot (is_hot),
  INDEX idx_is_top (is_top),
  INDEX idx_created_at (created_at),
  INDEX idx_post_count (post_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS topic_follows (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  topic_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_topic_user (topic_id, user_id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
