-- 添加 links 字段到 posts 表
ALTER TABLE posts ADD COLUMN links JSON DEFAULT NULL COMMENT '链接列表' AFTER tags;
