-- 修改 posts 表的 post_type 字段长度，支持 poll_with_link 等更长的类型
ALTER TABLE posts MODIFY COLUMN post_type VARCHAR(20) NOT NULL DEFAULT 'text';
