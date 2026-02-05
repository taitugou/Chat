-- 添加背景图片字段到用户表
USE tai_chat;

-- 先删除字段（如果存在）
ALTER TABLE users DROP COLUMN IF EXISTS background_image;

-- 添加字段
ALTER TABLE users ADD COLUMN background_image VARCHAR(255) DEFAULT NULL COMMENT '背景图片' AFTER avatar;
