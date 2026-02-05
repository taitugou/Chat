-- TTG Chat 数据库初始化脚本
-- MySQL 8.0
-- Root密码: 123456

-- 创建数据库
CREATE DATABASE IF NOT EXISTS tai_chat DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE tai_chat;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT '账号',
  email VARCHAR(100) UNIQUE NOT NULL COMMENT '邮箱',
  phone VARCHAR(20) UNIQUE NOT NULL COMMENT '手机号',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  nickname VARCHAR(100) NOT NULL COMMENT '昵称',
  avatar VARCHAR(255) DEFAULT NULL COMMENT '头像',
  gender ENUM('male', 'female', 'secret') DEFAULT 'secret' COMMENT '性别',
  birthday DATE DEFAULT NULL COMMENT '生日',
  location VARCHAR(100) DEFAULT NULL COMMENT '地区',
  bio TEXT DEFAULT NULL COMMENT '个性签名',
  interest_tags JSON DEFAULT NULL COMMENT '兴趣标签',
  points INT DEFAULT 0 COMMENT '积分',
  status ENUM('active', 'frozen', 'deleted') DEFAULT 'active' COMMENT '状态',
  last_login_at TIMESTAMP NULL DEFAULT NULL COMMENT '最后登录时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  content TEXT NOT NULL COMMENT '内容',
  images JSON DEFAULT NULL COMMENT '图片列表',
  video_url VARCHAR(255) DEFAULT NULL COMMENT '视频URL',
  audio_url VARCHAR(255) DEFAULT NULL COMMENT '音频URL',
  file_url VARCHAR(255) DEFAULT NULL COMMENT '文件URL',
  location VARCHAR(100) DEFAULT NULL COMMENT '位置',
  tags JSON DEFAULT NULL COMMENT '标签',
  visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '可见性',
  is_top BOOLEAN DEFAULT FALSE COMMENT '是否置顶',
  status ENUM('active', 'deleted', 'hidden') DEFAULT 'active' COMMENT '状态',
  view_count INT DEFAULT 0 COMMENT '查看数',
  like_count INT DEFAULT 0 COMMENT '点赞数',
  comment_count INT DEFAULT 0 COMMENT '评论数',
  share_count INT DEFAULT 0 COMMENT '分享数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_visibility (visibility),
  FULLTEXT idx_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子表';

-- 帖子点赞表
CREATE TABLE IF NOT EXISTS post_likes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL COMMENT '帖子ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_post_user (post_id, user_id),
  INDEX idx_post_id (post_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子点赞表';

-- 帖子评论表
CREATE TABLE IF NOT EXISTS post_comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL COMMENT '帖子ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  parent_id BIGINT DEFAULT NULL COMMENT '父评论ID',
  content TEXT NOT NULL COMMENT '评论内容',
  like_count INT DEFAULT 0 COMMENT '点赞数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES post_comments(id) ON DELETE CASCADE,
  INDEX idx_post_id (post_id),
  INDEX idx_user_id (user_id),
  INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子评论表';

-- 帖子分享表
CREATE TABLE IF NOT EXISTS post_shares (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL COMMENT '帖子ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_post_id (post_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子分享表';

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sender_id BIGINT NOT NULL COMMENT '发送者ID',
  receiver_id BIGINT DEFAULT NULL COMMENT '接收者ID（私聊）',
  group_id BIGINT DEFAULT NULL COMMENT '群聊ID（群聊）',
  conversation_id VARCHAR(100) NOT NULL COMMENT '会话ID',
  message_type ENUM('text', 'image', 'video', 'audio', 'file', 'location') DEFAULT 'text' COMMENT '消息类型',
  content TEXT DEFAULT NULL COMMENT '内容',
  file_url VARCHAR(255) DEFAULT NULL COMMENT '文件URL',
  file_size INT DEFAULT NULL COMMENT '文件大小',
  duration INT DEFAULT NULL COMMENT '时长（音频/视频）',
  is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否删除',
  is_recalled BOOLEAN DEFAULT FALSE COMMENT '是否撤回',
  is_snapchat BOOLEAN DEFAULT FALSE COMMENT '是否阅后即焚',
  snapchat_duration INT DEFAULT 0 COMMENT '阅后即焚时长（秒）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_receiver_id (receiver_id),
  INDEX idx_group_id (group_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- 好友分组表
CREATE TABLE IF NOT EXISTS friend_groups (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  name VARCHAR(50) NOT NULL COMMENT '分组名称',
  sort_order INT DEFAULT 0 COMMENT '排序顺序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_group (user_id, name),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友分组表';

-- 匹配设置表
CREATE TABLE IF NOT EXISTS match_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  min_age INT DEFAULT 18 COMMENT '最小年龄',
  max_age INT DEFAULT 80 COMMENT '最大年龄',
  preferred_gender ENUM('male', 'female', 'both') DEFAULT 'both' COMMENT '偏好性别',
  preferred_location VARCHAR(100) DEFAULT NULL COMMENT '偏好地区',
  distance_range INT DEFAULT 50 COMMENT '距离范围（公里）',
  matching_mode ENUM('precise', 'interest', 'nearby', 'random') DEFAULT 'precise' COMMENT '匹配模式',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='匹配设置表';

-- 好友关系表
CREATE TABLE IF NOT EXISTS user_friends (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  friend_id BIGINT NOT NULL COMMENT '好友ID',
  group_id BIGINT DEFAULT NULL COMMENT '分组ID',
  remark VARCHAR(100) DEFAULT NULL COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES friend_groups(id) ON DELETE SET NULL,
  UNIQUE KEY uk_user_friend (user_id, friend_id),
  INDEX idx_user_id (user_id),
  INDEX idx_friend_id (friend_id),
  INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友关系表';

-- 好友关系自定义表
CREATE TABLE IF NOT EXISTS user_friend_relations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '发起者ID',
  friend_id BIGINT NOT NULL COMMENT '好友ID',
  custom_name VARCHAR(20) DEFAULT NULL COMMENT '自定义关系名称（最多10个字符）',
  visibility ENUM('public', 'self', 'both', 'group') DEFAULT 'both' COMMENT '可见性',
  target_groups JSON DEFAULT NULL COMMENT '可见分组（当visibility为group时使用）',
  status ENUM('pending', 'accepted', 'rejected', 'expired') DEFAULT 'pending' COMMENT '状态',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '请求时间',
  responded_at TIMESTAMP NULL DEFAULT NULL COMMENT '响应时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_friend_relation (user_id, friend_id),
  INDEX idx_user_id (user_id),
  INDEX idx_friend_id (friend_id),
  INDEX idx_status (status),
  INDEX idx_requested_at (requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友关系自定义表';

-- 黑名单表
CREATE TABLE IF NOT EXISTS user_blacklist (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  blocker_id BIGINT NOT NULL COMMENT '拉黑者ID',
  blocked_id BIGINT NOT NULL COMMENT '被拉黑者ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_blocker_blocked (blocker_id, blocked_id),
  INDEX idx_blocker_id (blocker_id),
  INDEX idx_blocked_id (blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='黑名单表';

-- 匹配历史表
CREATE TABLE IF NOT EXISTS match_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  matched_user_id BIGINT NOT NULL COMMENT '匹配用户ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_matched_user_id (matched_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='匹配历史表';

-- VIP兑换码表
CREATE TABLE IF NOT EXISTS vip_codes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT '兑换码',
  level ENUM('vip', 'svip', 'ssvip') NOT NULL COMMENT 'VIP等级',
  duration VARCHAR(20) NOT NULL COMMENT '时长（如：1m, 3m, 6m, 12m, permanent）',
  status ENUM('unused', 'used', 'expired', 'cancelled') DEFAULT 'unused' COMMENT '状态',
  used_by BIGINT DEFAULT NULL COMMENT '使用者ID',
  used_at TIMESTAMP NULL DEFAULT NULL COMMENT '使用时间',
  expire_at TIMESTAMP NULL DEFAULT NULL COMMENT '过期时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_code (code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='VIP兑换码表';

-- 续期卡表
CREATE TABLE IF NOT EXISTS renewal_cards (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  expire_at TIMESTAMP NOT NULL COMMENT '过期时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_expire_at (expire_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='续期卡表';

-- 用户签到表
CREATE TABLE IF NOT EXISTS user_checkins (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  consecutive_days INT DEFAULT 1 COMMENT '连续签到天数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户签到表';

-- 积分记录表
CREATE TABLE IF NOT EXISTS point_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  amount INT NOT NULL COMMENT '积分变化（正数为获得，负数为消耗）',
  type VARCHAR(50) NOT NULL COMMENT '类型（checkin/post/like/comment/share/consume等）',
  description VARCHAR(255) DEFAULT NULL COMMENT '描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分记录表';

-- 用户关注表
CREATE TABLE IF NOT EXISTS user_follows (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  follower_id BIGINT NOT NULL COMMENT '关注者ID',
  following_id BIGINT NOT NULL COMMENT '被关注者ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uk_follower_following (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_follower_id (follower_id),
  INDEX idx_following_id (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户关注表';

-- 用户登录日志表
CREATE TABLE IF NOT EXISTS user_login_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  ip VARCHAR(50) DEFAULT NULL COMMENT '登录IP',
  location VARCHAR(100) DEFAULT NULL COMMENT '登录地点',
  device VARCHAR(100) DEFAULT NULL COMMENT '登录设备',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_login_time (login_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户登录日志表';

-- 插入测试管理员用户
-- 注意：默认密码为 admin123，请在生产环境中修改
-- 密码哈希使用 bcrypt，需要在应用启动后通过注册或修改密码功能设置
-- 或者使用以下SQL设置（需要先安装bcrypt工具生成哈希）：
-- UPDATE users SET password_hash = '$2a$10$...' WHERE username = 'admin';
INSERT INTO users (username, email, phone, password_hash, nickname, status) VALUES
('admin', 'admin@ttgchat.com', '13800000000', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '管理员', 'active')
ON DUPLICATE KEY UPDATE username=username;

-- 默认密码：admin123
-- 生产环境请务必修改管理员密码！

-- 添加用户表的扩展字段（如果不存在）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS match_settings JSON DEFAULT NULL COMMENT '匹配设置',
ADD COLUMN IF NOT EXISTS privacy_settings JSON DEFAULT NULL COMMENT '隐私设置',
ADD COLUMN IF NOT EXISTS notification_settings JSON DEFAULT NULL COMMENT '通知设置',
ADD COLUMN IF NOT EXISTS vip_level ENUM('none', 'vip', 'svip', 'ssvip') DEFAULT 'none' COMMENT 'VIP等级';

-- 聊天设置表
CREATE TABLE IF NOT EXISTS chat_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  conversation_id VARCHAR(100) DEFAULT NULL COMMENT '会话ID',
  is_pinned BOOLEAN DEFAULT FALSE COMMENT '是否置顶',
  is_muted BOOLEAN DEFAULT FALSE COMMENT '是否免打扰',
  background_image VARCHAR(255) DEFAULT NULL COMMENT '背景图片',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_user_conversation (user_id, conversation_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天设置表';

-- 全屏通知表
CREATE TABLE IF NOT EXISTS fullscreen_notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sender_id BIGINT NOT NULL COMMENT '发送者ID',
  sender_level ENUM('vip', 'svip', 'ssvip') NOT NULL COMMENT '发送者VIP等级',
  title VARCHAR(100) DEFAULT NULL COMMENT '通知标题',
  content TEXT NOT NULL COMMENT '通知内容',
  notification_type ENUM('birthday', 'festival', 'event', 'status', 'custom') DEFAULT 'custom' COMMENT '通知类型',
  status ENUM('pending', 'sent', 'failed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
  sent_at TIMESTAMP NULL DEFAULT NULL COMMENT '发送时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sender_id (sender_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全屏通知表';

-- 全屏通知发送记录
CREATE TABLE IF NOT EXISTS fullscreen_notification_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  notification_id BIGINT NOT NULL COMMENT '通知ID',
  receiver_id BIGINT NOT NULL COMMENT '接收者ID',
  is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  read_at TIMESTAMP NULL DEFAULT NULL COMMENT '阅读时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (notification_id) REFERENCES fullscreen_notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notification_id (notification_id),
  INDEX idx_receiver_id (receiver_id),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全屏通知发送记录';

-- 群聊表
CREATE TABLE IF NOT EXISTS chat_groups (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '群聊名称',
  avatar VARCHAR(255) DEFAULT NULL COMMENT '群聊头像',
  description TEXT DEFAULT NULL COMMENT '群聊描述',
  creator_id BIGINT NOT NULL COMMENT '创建者ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群聊表';

-- 群聊公告表
CREATE TABLE IF NOT EXISTS group_announcements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  group_id BIGINT NOT NULL COMMENT '群聊ID',
  title VARCHAR(100) NOT NULL COMMENT '公告标题',
  content TEXT NOT NULL COMMENT '公告内容',
  created_by BIGINT NOT NULL COMMENT '创建者ID',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否活跃',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_group_id (group_id),
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群聊公告表';

-- 群聊成员表
CREATE TABLE IF NOT EXISTS chat_group_members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  group_id BIGINT NOT NULL COMMENT '群聊ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  role ENUM('owner', 'admin', 'member') DEFAULT 'member' COMMENT '成员角色',
  nickname VARCHAR(100) DEFAULT NULL COMMENT '群内昵称',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_group_user (group_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群聊成员表';

-- 赞助记录表
CREATE TABLE IF NOT EXISTS sponsorships (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '赞助用户ID',
  amount DECIMAL(10, 2) NOT NULL COMMENT '赞助金额',
  payment_method VARCHAR(50) DEFAULT NULL COMMENT '支付方式',
  transaction_id VARCHAR(100) DEFAULT NULL COMMENT '交易流水号',
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'completed' COMMENT '状态',
  remark TEXT DEFAULT NULL COMMENT '备注',
  admin_id BIGINT DEFAULT NULL COMMENT '操作管理员ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_amount (amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='赞助记录表';

