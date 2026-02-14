-- 添加 net_change 列到 game_player_records 表
-- 用于记录净变化（筹码变化 - 总投入）

USE tai_chat;

ALTER TABLE game_player_records
ADD COLUMN IF NOT EXISTS net_change BIGINT DEFAULT 0 COMMENT '净变化' AFTER hand_data;

-- 添加 aborted_at 列到 game_records 表
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS aborted_at TIMESTAMP NULL DEFAULT NULL COMMENT '中止时间' AFTER finished_at;
