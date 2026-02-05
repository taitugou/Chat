-- 社交交互功能数据库迁移脚本
-- 包含：@提及、留言、通知系统

USE tai_chat;

-- 1. @提及表
CREATE TABLE IF NOT EXISTS mentions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mentioned_user_id BIGINT NOT NULL COMMENT '被提及的用户ID',
  mentioner_id BIGINT NOT NULL COMMENT '提及者ID',
  post_id BIGINT DEFAULT NULL COMMENT '帖子ID',
  topic_id BIGINT DEFAULT NULL COMMENT '话题ID',
  comment_id BIGINT DEFAULT NULL COMMENT '评论ID',
  message_id BIGINT DEFAULT NULL COMMENT '消息ID',
  mention_text VARCHAR(500) DEFAULT NULL COMMENT '提及文本内容',
  is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mentioner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  INDEX idx_mentioned_user (mentioned_user_id),
  INDEX idx_mentioner_id (mentioner_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='@提及表';

-- 2. 用户留言表
CREATE TABLE IF NOT EXISTS user_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  profile_user_id BIGINT NOT NULL COMMENT '留言板所属用户ID',
  sender_id BIGINT NOT NULL COMMENT '留言者ID',
  parent_id BIGINT DEFAULT NULL COMMENT '父留言ID（用于回复）',
  content TEXT NOT NULL COMMENT '留言内容',
  mentions JSON DEFAULT NULL COMMENT '@提及的用户ID列表',
  like_count INT DEFAULT 0 COMMENT '点赞数',
  reply_count INT DEFAULT 0 COMMENT '回复数',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否删除',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (profile_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES user_messages(id) ON DELETE CASCADE,
  INDEX idx_profile_user (profile_user_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_parent_id (parent_id),
  INDEX idx_created_at (created_at),
  INDEX idx_is_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户留言表';

-- 3. 留言点赞表
CREATE TABLE IF NOT EXISTS user_message_likes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  message_id BIGINT NOT NULL COMMENT '留言ID',
  user_id BIGINT NOT NULL COMMENT '点赞用户ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (message_id) REFERENCES user_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_message_user (message_id, user_id),
  INDEX idx_message_id (message_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留言点赞表';

-- 4. 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '接收通知的用户ID',
  type ENUM('message', 'comment', 'like', 'follow', 'mention', 'system', 'profile_message') NOT NULL COMMENT '通知类型',
  title VARCHAR(200) DEFAULT NULL COMMENT '通知标题',
  content TEXT DEFAULT NULL COMMENT '通知内容',
  sender_id BIGINT DEFAULT NULL COMMENT '发送者ID',
  sender_avatar VARCHAR(255) DEFAULT NULL COMMENT '发送者头像（快照）',
  sender_nickname VARCHAR(100) DEFAULT NULL COMMENT '发送者昵称（快照）',
  related_id BIGINT DEFAULT NULL COMMENT '相关内容ID（帖子/评论/留言等）',
  related_type VARCHAR(50) DEFAULT NULL COMMENT '相关内容类型（post/comment/message等）',
  is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  read_at TIMESTAMP NULL DEFAULT NULL COMMENT '阅读时间',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否删除',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '删除时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_is_read (is_read),
  INDEX idx_is_deleted (is_deleted),
  INDEX idx_created_at (created_at),
  INDEX idx_sender_id (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';

-- 5. 为posts表添加mentions字段（用于存储@提及的用户ID列表）
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS mentions JSON DEFAULT NULL COMMENT '@提及的用户ID列表';

-- 6. 为topics表添加mentions字段（用于存储@提及的用户ID列表）
ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS mentions JSON DEFAULT NULL COMMENT '@提及的用户ID列表';

-- 7. 为post_comments表添加mentions字段（用于存储@提及的用户ID列表）
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS mentions JSON DEFAULT NULL COMMENT '@提及的用户ID列表';
