-- 添加匿名功能支持
-- 为帖子、话题、评论表添加 is_anonymous 字段

USE tai_chat;

-- 为帖子表添加 is_anonymous 字段
ALTER TABLE posts 
ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE COMMENT '是否匿名' 
AFTER user_id;

-- 为话题表添加 is_anonymous 字段
ALTER TABLE topics 
ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE COMMENT '是否匿名' 
AFTER user_id;

-- 为帖子评论表添加 is_anonymous 字段
ALTER TABLE post_comments 
ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE COMMENT '是否匿名' 
AFTER user_id;

-- 添加索引以提高查询性能
CREATE INDEX idx_posts_is_anonymous ON posts(is_anonymous);
CREATE INDEX idx_topics_is_anonymous ON topics(is_anonymous);
CREATE INDEX idx_post_comments_is_anonymous ON post_comments(is_anonymous);
