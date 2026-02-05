-- 添加隐私设置字段到 users 表
-- 如果字段已存在，忽略错误
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_settings JSON DEFAULT NULL COMMENT '隐私设置';

-- 添加帖子可见性字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS posts_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '帖子可见性';

-- 添加获赞可见性字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS likes_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '获赞可见性';

-- 添加关注可见性字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '关注列表可见性';

-- 添加粉丝可见性字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '粉丝列表可见性';

-- 添加背景图片字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS background_image VARCHAR(500) DEFAULT NULL COMMENT '背景图片URL';
