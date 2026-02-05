-- 添加统计信息可见性字段到用户表
USE tai_chat;

-- 添加字段
ALTER TABLE users ADD COLUMN posts_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '帖子可见性' AFTER background_image;
ALTER TABLE users ADD COLUMN likes_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '获赞可见性' AFTER posts_visibility;
ALTER TABLE users ADD COLUMN following_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '关注可见性' AFTER likes_visibility;
ALTER TABLE users ADD COLUMN followers_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '粉丝可见性' AFTER following_visibility;
