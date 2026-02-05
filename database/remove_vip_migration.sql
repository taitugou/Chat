-- 移除 VIP 相关字段的迁移脚本
-- 执行前请确保已备份数据库

USE tai_chat;

-- 1. 从 users 表中移除 vip_level 和 vip_expire_at 字段
ALTER TABLE users DROP COLUMN vip_level;
ALTER TABLE users DROP COLUMN vip_expire_at;

-- 2. 移除 vip_level 索引
ALTER TABLE users DROP INDEX idx_vip_level;

-- 3. 删除全屏通知使用统计表（如果存在）
DROP TABLE IF EXISTS fullscreen_notification_usage;

-- 4. 更新默认管理员账户（移除VIP状态）
UPDATE users SET status = 'active' WHERE username = 'admin';

SELECT '迁移完成！已移除所有VIP相关字段和表。' as result;
