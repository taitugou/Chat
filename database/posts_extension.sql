-- 帖子表扩展脚本，添加链接帖子和投票帖子所需的字段
USE tai_chat;

-- 添加链接帖子字段
ALTER TABLE posts 
ADD COLUMN link_title VARCHAR(255) DEFAULT NULL COMMENT '链接标题',
ADD COLUMN link_description TEXT DEFAULT NULL COMMENT '链接描述',
ADD COLUMN link_image_url VARCHAR(255) DEFAULT NULL COMMENT '链接图片URL',
ADD COLUMN link_url VARCHAR(255) DEFAULT NULL COMMENT '链接URL';

-- 添加投票帖子字段
ALTER TABLE posts 
ADD COLUMN poll_options JSON DEFAULT NULL COMMENT '投票选项',
ADD COLUMN poll_votes JSON DEFAULT NULL COMMENT '投票结果',
ADD COLUMN poll_expire_at TIMESTAMP DEFAULT NULL COMMENT '投票过期时间',
ADD COLUMN poll_type ENUM('single', 'multiple', 'rating') DEFAULT NULL COMMENT '投票类型',
ADD COLUMN poll_is_anonymous BOOLEAN DEFAULT FALSE COMMENT '是否匿名投票',
ADD COLUMN poll_is_public BOOLEAN DEFAULT TRUE COMMENT '是否公开结果';

-- 添加帖子类型字段
ALTER TABLE posts 
ADD COLUMN post_type ENUM('text', 'image', 'video', 'audio', 'link', 'poll') DEFAULT 'text' COMMENT '帖子类型';
