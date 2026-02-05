-- 添加帖子引用功能相关字段
-- 引用类型：post(帖子)、topic_comment(话题评论)、comment(评论)
-- 引用来源：原帖子ID或原评论ID

ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_type ENUM('none', 'post', 'topic_comment', 'comment', 'topic') DEFAULT 'none' COMMENT '引用类型' AFTER status;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_id INT DEFAULT NULL COMMENT '引用来源ID' AFTER quote_type;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_content TEXT DEFAULT NULL COMMENT '引用内容快照' AFTER quote_id;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_user_id INT DEFAULT NULL COMMENT '被引用内容的作者ID' AFTER quote_content;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_user_name VARCHAR(100) DEFAULT NULL COMMENT '被引用内容的作者昵称' AFTER quote_user_id;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_user_avatar VARCHAR(255) DEFAULT NULL COMMENT '被引用内容的作者头像' AFTER quote_user_name;

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_posts_quote_type ON posts(quote_type);
CREATE INDEX IF NOT EXISTS idx_posts_quote_id ON posts(quote_id);

-- 评论表也添加引用字段
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS quote_type ENUM('none', 'post', 'topic_comment', 'comment', 'topic') DEFAULT 'none' COMMENT '引用类型' AFTER parent_id;

ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS quote_id INT DEFAULT NULL COMMENT '引用来源ID' AFTER quote_type;

ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS quote_content TEXT DEFAULT NULL COMMENT '引用内容快照' AFTER quote_id;

ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS quote_user_id INT DEFAULT NULL COMMENT '被引用内容的作者ID' AFTER quote_content;

ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS quote_user_name VARCHAR(100) DEFAULT NULL COMMENT '被引用内容的作者昵称' AFTER quote_user_id;

ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS quote_user_avatar VARCHAR(255) DEFAULT NULL COMMENT '被引用内容的作者头像' AFTER quote_user_name;
