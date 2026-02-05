-- TTG 游戏系统数据库表
-- 创建时间: 2026-01-17

USE tai_chat;

-- 游戏筹码表
CREATE TABLE IF NOT EXISTS game_chips (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  balance BIGINT DEFAULT 0 COMMENT '筹码余额',
  total_earned BIGINT DEFAULT 0 COMMENT '累计获得筹码',
  total_spent BIGINT DEFAULT 0 COMMENT '累计消耗筹码',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_id (user_id),
  INDEX idx_balance (balance)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏筹码表';

-- 游戏签到表
CREATE TABLE IF NOT EXISTS game_checkins (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  checkin_date DATE NOT NULL COMMENT '签到日期',
  consecutive_days INT DEFAULT 1 COMMENT '连续签到天数',
  reward_chips INT DEFAULT 1000 COMMENT '奖励筹码',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_date (user_id, checkin_date),
  INDEX idx_checkin_date (checkin_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏签到表';

-- 借贷记录表
CREATE TABLE IF NOT EXISTS game_loans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '借款用户ID',
  amount BIGINT NOT NULL COMMENT '借款金额',
  interest_rate DECIMAL(5,2) NOT NULL COMMENT '利率（25表示25%）',
  loan_type ENUM('outside', 'inside') NOT NULL COMMENT '借贷类型（outside=局外，inside=局内）',
  room_id BIGINT DEFAULT NULL COMMENT '房间ID（局内借贷）',
  game_id BIGINT DEFAULT NULL COMMENT '游戏ID（局内借贷）',
  status ENUM('pending', 'active', 'repaid', 'overdue') DEFAULT 'pending' COMMENT '状态',
  total_repayment BIGINT DEFAULT 0 COMMENT '应还总额',
  repaid_amount BIGINT DEFAULT 0 COMMENT '已还金额',
  overdue_days INT DEFAULT 0 COMMENT '逾期天数',
  due_date DATETIME DEFAULT NULL COMMENT '到期日期',
  repaid_at TIMESTAMP NULL DEFAULT NULL COMMENT '还款时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_loan_type (loan_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='借贷记录表';

-- 游戏类型表
CREATE TABLE IF NOT EXISTS game_types (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT '游戏代码',
  name VARCHAR(100) NOT NULL COMMENT '游戏名称',
  category ENUM('poker', 'mahjong', 'chess', 'other') NOT NULL COMMENT '游戏分类',
  min_players INT NOT NULL COMMENT '最少玩家数',
  max_players INT NOT NULL COMMENT '最多玩家数',
  description TEXT DEFAULT NULL COMMENT '游戏描述',
  rules JSON DEFAULT NULL COMMENT '游戏规则配置',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_category (category),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏类型表';

-- 游戏房间表
CREATE TABLE IF NOT EXISTS game_rooms (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_code VARCHAR(20) UNIQUE NOT NULL COMMENT '房间代码',
  game_type_id BIGINT NOT NULL COMMENT '游戏类型ID',
  creator_id BIGINT NOT NULL COMMENT '创建者ID',
  name VARCHAR(200) NOT NULL COMMENT '房间名称',
  password VARCHAR(100) DEFAULT NULL COMMENT '房间密码',
  max_players INT NOT NULL COMMENT '最大玩家数',
  current_players INT DEFAULT 0 COMMENT '当前玩家数',
  status ENUM('waiting', 'playing', 'finished', 'closed') DEFAULT 'waiting' COMMENT '房间状态',
  settings JSON DEFAULT NULL COMMENT '房间设置（底注、盲注等）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (game_type_id) REFERENCES game_types(id) ON DELETE CASCADE,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_game_type (game_type_id),
  INDEX idx_creator (creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏房间表';

-- 房间玩家表
CREATE TABLE IF NOT EXISTS game_room_players (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id BIGINT NOT NULL COMMENT '房间ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  seat_number INT DEFAULT 0 COMMENT '座位号',
  chips BIGINT DEFAULT 0 COMMENT '带入筹码',
  is_ready BOOLEAN DEFAULT FALSE COMMENT '是否准备',
  is_online BOOLEAN DEFAULT TRUE COMMENT '是否在线',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_room_user (room_id, user_id),
  INDEX idx_room_id (room_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房间玩家表';

-- 游戏记录表
CREATE TABLE IF NOT EXISTS game_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id BIGINT NOT NULL COMMENT '房间ID',
  game_type_id BIGINT NOT NULL COMMENT '游戏类型ID',
  winner_id BIGINT DEFAULT NULL COMMENT '获胜者ID',
  total_pot BIGINT DEFAULT 0 COMMENT '总底池',
  game_data JSON DEFAULT NULL COMMENT '游戏数据',
  status ENUM('playing', 'finished', 'aborted') DEFAULT 'playing' COMMENT '游戏状态',
  started_at TIMESTAMP NULL DEFAULT NULL COMMENT '开始时间',
  finished_at TIMESTAMP NULL DEFAULT NULL COMMENT '结束时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (game_type_id) REFERENCES game_types(id) ON DELETE CASCADE,
  FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_room_id (room_id),
  INDEX idx_winner_id (winner_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏记录表';

-- 游戏玩家记录表
CREATE TABLE IF NOT EXISTS game_player_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL COMMENT '游戏ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  chips_change BIGINT DEFAULT 0 COMMENT '筹码变化',
  final_chips BIGINT DEFAULT 0 COMMENT '最终筹码',
  position INT DEFAULT 0 COMMENT '排名',
  hand_data JSON DEFAULT NULL COMMENT '手牌数据',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (game_id) REFERENCES game_records(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_game_user (game_id, user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏玩家记录表';

-- 筹码流水表
CREATE TABLE IF NOT EXISTS chip_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  amount BIGINT NOT NULL COMMENT '筹码变化（正数为获得，负数为消耗）',
  balance_after BIGINT NOT NULL COMMENT '变化后余额',
  type ENUM('checkin', 'game_win', 'game_loss', 'loan', 'repay', 'purchase', 'refund', 'other') NOT NULL COMMENT '类型',
  description VARCHAR(255) DEFAULT NULL COMMENT '描述',
  related_id BIGINT DEFAULT NULL COMMENT '相关ID（游戏ID/借贷ID等）',
  related_type VARCHAR(50) DEFAULT NULL COMMENT '相关类型',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='筹码流水表';

-- 游戏聊天消息表
CREATE TABLE IF NOT EXISTS game_chat_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id BIGINT NOT NULL COMMENT '房间ID',
  user_id BIGINT NOT NULL COMMENT '发送者ID',
  message_type ENUM('text', 'emoji', 'system') DEFAULT 'text' COMMENT '消息类型',
  content TEXT DEFAULT NULL COMMENT '内容',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_room_id (room_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏聊天消息表';

-- 游戏统计表
CREATE TABLE IF NOT EXISTS game_statistics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  game_type_id BIGINT DEFAULT NULL COMMENT '游戏类型ID（NULL表示全部）',
  total_games INT DEFAULT 0 COMMENT '总游戏场次',
  total_wins INT DEFAULT 0 COMMENT '总胜利场次',
  total_losses INT DEFAULT 0 COMMENT '总失败场次',
  total_chips_earned BIGINT DEFAULT 0 COMMENT '累计获得筹码',
  total_chips_lost BIGINT DEFAULT 0 COMMENT '累计失去筹码',
  max_win BIGINT DEFAULT 0 COMMENT '最大单局赢取',
  max_loss BIGINT DEFAULT 0 COMMENT '最大单局输掉',
  win_rate DECIMAL(5,2) DEFAULT 0 COMMENT '胜率',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_type_id) REFERENCES game_types(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_game (user_id, game_type_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏统计表';

-- 插入默认游戏类型
INSERT INTO game_types (code, name, category, min_players, max_players, description, sort_order) VALUES
('texas_holdem', '德州扑克', 'poker', 2, 10, '最受欢迎的扑克游戏', 1),
('zhajinhua', '炸金花', 'poker', 2, 6, '简单刺激的三张牌游戏', 2),
('doudizhu', '斗地主', 'poker', 3, 3, '经典三人扑克游戏', 3),
('shengji', '升级', 'poker', 4, 4, '四人两副牌游戏', 4),
('paodekuai', '跑得快', 'poker', 2, 4, '快速出牌游戏', 5),
('blackjack', '21点', 'poker', 2, 7, '经典赌场游戏', 6),
('sichuan_mahjong', '四川麻将', 'mahjong', 4, 4, '四川地区麻将玩法', 7),
('guangdong_mahjong', '广东麻将', 'mahjong', 4, 4, '广东地区麻将玩法', 8),
('guobiao_mahjong', '国标麻将', 'mahjong', 4, 4, '国际标准麻将', 9),
('ren_mahjong', '二人麻将', 'mahjong', 2, 2, '快速二人麻将', 10),
('xiangqi', '中国象棋', 'chess', 2, 2, '中国传统棋类游戏', 11),
('weiqi', '围棋', 'chess', 2, 2, '古老策略棋类游戏', 12),
('wuziqi', '五子棋', 'chess', 2, 2, '简单有趣的棋类游戏', 13),
('international_chess', '国际象棋', 'chess', 2, 2, '国际流行棋类游戏', 14),
('junqi', '军棋', 'chess', 2, 2, '经典军棋对战游戏', 15),
('niuniu', '牛牛', 'other', 2, 10, '刺激的比牌游戏', 16),
('erbaban', '二八杠', 'other', 2, 8, '经典骰子游戏', 17),
('touzi_bao', '骰宝', 'other', 2, 10, '骰子押注游戏', 18)
ON DUPLICATE KEY UPDATE code=code;

-- 好友关系表
CREATE TABLE IF NOT EXISTS friendships (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  friend_id BIGINT NOT NULL COMMENT '好友ID',
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending' COMMENT '关系状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_friend (user_id, friend_id),
  INDEX idx_user_id (user_id),
  INDEX idx_friend_id (friend_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友关系表';

-- 为game_rooms表添加last_active_at字段（用于24h后自动消失）
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后活动时间' AFTER updated_at;

-- 更新last_active_at的索引
ALTER TABLE game_rooms
DROP INDEX IF EXISTS idx_status;

ALTER TABLE game_rooms
ADD INDEX idx_status_active (status, last_active_at);
