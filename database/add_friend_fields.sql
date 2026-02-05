-- 添加好友表的新字段
USE tai_chat;

-- 添加标签字段
ALTER TABLE user_friends 
ADD COLUMN IF NOT EXISTS tags JSON DEFAULT NULL COMMENT '好友标签';

-- 添加权限字段
ALTER TABLE user_friends 
ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT NULL COMMENT '好友权限设置';

-- 添加updated_at字段
ALTER TABLE user_friends 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- 添加索引
ALTER TABLE user_friends 
ADD INDEX IF NOT EXISTS idx_updated_at (updated_at);
