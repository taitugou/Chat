-- 添加在线状态字段到用户表
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_status ENUM('online', 'offline', 'away', 'busy') DEFAULT 'offline' COMMENT '在线状态' AFTER status;
