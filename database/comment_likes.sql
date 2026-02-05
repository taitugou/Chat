CREATE TABLE IF NOT EXISTS comment_likes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  comment_id BIGINT NOT NULL COMMENT '评论ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_comment_user (comment_id, user_id),
  INDEX idx_comment_id (comment_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论点赞表';
