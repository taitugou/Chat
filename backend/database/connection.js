import mysql from 'mysql2/promise';
import { config } from '../config.js';

let pool = null;

export async function initDatabase() {
  try {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: config.database.waitForConnections,
      connectionLimit: config.database.connectionLimit,
      queueLimit: config.database.queueLimit,
      charset: config.database.charset,
    });

    // 测试连接
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    // 确保必要的字段存在
    await ensureDatabaseColumns();

    return pool;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

async function ensureDatabaseColumns() {
  try {
    const connection = await pool.getConnection();

    // 检查并添加 privacy_settings 字段
    const [privacyColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'privacy_settings'`
    );
    
    if (!privacyColumns || privacyColumns.length === 0) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN privacy_settings JSON DEFAULT NULL COMMENT '隐私设置'`
      );
      console.log('✓ 已添加 privacy_settings 字段');
    }

    // 检查并添加 posts_visibility 字段
    const [postsColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'posts_visibility'`
    );
    
    if (!postsColumns || postsColumns.length === 0) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN posts_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '帖子可见性'`
      );
      console.log('✓ 已添加 posts_visibility 字段');
    }

    // 检查并添加 likes_visibility 字段
    const [likesColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'likes_visibility'`
    );
    
    if (!likesColumns || likesColumns.length === 0) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN likes_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '获赞可见性'`
      );
      console.log('✓ 已添加 likes_visibility 字段');
    }

    // 检查并添加 following_visibility 字段
    const [followingColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'following_visibility'`
    );
    
    if (!followingColumns || followingColumns.length === 0) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN following_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '关注列表可见性'`
      );
      console.log('✓ 已添加 following_visibility 字段');
    }

    // 检查并添加 followers_visibility 字段
    const [followersColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'followers_visibility'`
    );
    
    if (!followersColumns || followersColumns.length === 0) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN followers_visibility ENUM('public', 'friends', 'private') DEFAULT 'public' COMMENT '粉丝列表可见性'`
      );
      console.log('✓ 已添加 followers_visibility 字段');
    }

    // 检查并添加 background_image 字段
    const [bgColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'background_image'`
    );
    
    if (!bgColumns || bgColumns.length === 0) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN background_image VARCHAR(500) DEFAULT NULL COMMENT '背景图片URL'`
      );
      console.log('✓ 已添加 background_image 字段');
    }

    // 针对低配 HDD 的索引优化：添加 points 索引
    const [pointsIndex] = await connection.query(
      `SHOW INDEX FROM users WHERE Key_name = 'idx_points'`
    );
    if (!pointsIndex || pointsIndex.length === 0) {
      await connection.query(`CREATE INDEX idx_points ON users(points)`);
      console.log('✓ 已为 users 表添加 points 索引');
    }

    // 针对低配 HDD 的索引优化：添加 posts.like_count 索引
    const [postLikesIndex] = await connection.query(
      `SHOW INDEX FROM posts WHERE Key_name = 'idx_like_count'`
    );
    if (!postLikesIndex || postLikesIndex.length === 0) {
      await connection.query(`CREATE INDEX idx_like_count ON posts(like_count)`);
      console.log('✓ 已为 posts 表添加 like_count 索引');
    }

    // 检查并添加 user_login_logs 表的 logout_time 字段
    const [logoutTimeColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_login_logs' AND COLUMN_NAME = 'logout_time'`
    );
    
    if (!logoutTimeColumns || logoutTimeColumns.length === 0) {
      await connection.query(
        `ALTER TABLE user_login_logs ADD COLUMN logout_time DATETIME DEFAULT NULL COMMENT '登出时间'`
      );
      console.log('✓ 已添加 user_login_logs.logout_time 字段');
    }

    // 检查并添加 match_settings 表的 use_anonymous 字段
    const [useAnonColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'match_settings' AND COLUMN_NAME = 'use_anonymous'`
    );
    
    if (!useAnonColumns || useAnonColumns.length === 0) {
      await connection.query(
        `ALTER TABLE match_settings ADD COLUMN use_anonymous BOOLEAN DEFAULT FALSE COMMENT '是否使用匿名身份匹配'`
      );
      console.log('✓ 已添加 match_settings.use_anonymous 字段');
    }

    // 检查并添加 messages 表的 is_burned 字段
    const [burnedColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'is_burned'`
    );
    
    if (!burnedColumns || burnedColumns.length === 0) {
      await connection.query(
        `ALTER TABLE messages ADD COLUMN is_burned BOOLEAN DEFAULT FALSE COMMENT '是否已焚毁'`
      );
      console.log('✓ 已添加 messages.is_burned 字段');
    }

    // 检查并添加 users 表的 is_guest 字段
    const [guestColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_guest'`
    );
    
    if (!guestColumns || guestColumns.length === 0) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN is_guest BOOLEAN DEFAULT FALSE COMMENT '是否为游客'`
      );
      console.log('✓ 已添加 users.is_guest 字段');
    }

    // 检查并修改 users 表的 phone、email 和 password_hash 字段为允许 NULL
    const [userColumns] = await connection.query(
      `SELECT COLUMN_NAME, IS_NULLABLE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' 
       AND COLUMN_NAME IN ('phone', 'email', 'password_hash')`
    );

    const needsModify = userColumns.some(col => col.IS_NULLABLE === 'NO');
    
    if (needsModify) {
      await connection.query(
        `ALTER TABLE users MODIFY COLUMN phone VARCHAR(20) NULL COMMENT '手机号',
         MODIFY COLUMN email VARCHAR(100) NULL COMMENT '邮箱',
         MODIFY COLUMN password_hash VARCHAR(255) NULL COMMENT '密码哈希'`
      );
      console.log('✓ 已修改 users 表 phone、email 和 password_hash 字段为允许 NULL');
    }

    // 检查并更新 match_history 表
    const [historyCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'match_history'`
    );
    const historyColNames = historyCols.map(c => c.COLUMN_NAME);

    if (!historyColNames.includes('score')) {
      await connection.query(`ALTER TABLE match_history ADD COLUMN score DECIMAL(5,2) DEFAULT NULL COMMENT '匹配分数'`);
      console.log('✓ 已为 match_history 表添加 score 字段');
    }
    if (!historyColNames.includes('is_anonymous')) {
      await connection.query(`ALTER TABLE match_history ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE COMMENT '是否匿名'`);
      console.log('✓ 已为 match_history 表添加 is_anonymous 字段');
    }
    if (!historyColNames.includes('room_id')) {
      await connection.query(`ALTER TABLE match_history ADD COLUMN room_id VARCHAR(100) DEFAULT NULL COMMENT '房间ID'`);
      console.log('✓ 已为 match_history 表添加 room_id 字段');
    }

    // 检查并创建 friend_requests 表
    const [friendRequestsTable] = await connection.query(
      `SHOW TABLES LIKE 'friend_requests'`
    );

    if (!friendRequestsTable || friendRequestsTable.length === 0) {
       await connection.query(`
         CREATE TABLE friend_requests (
           id BIGINT AUTO_INCREMENT PRIMARY KEY,
           requester_id BIGINT NOT NULL,
           receiver_id BIGINT NOT NULL,
           status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
           message TEXT,
           created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
           updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
           UNIQUE KEY unique_request (requester_id, receiver_id),
           FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
           FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
           INDEX idx_status (status),
           INDEX idx_receiver (receiver_id)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
       `);
       console.log('✓ 已创建 friend_requests 表');
     }

    // 检查并创建 notifications 表
    const [notificationsTable] = await connection.query(
      `SHOW TABLES LIKE 'notifications'`
    );

    if (!notificationsTable || notificationsTable.length === 0) {
       await connection.query(`
         CREATE TABLE notifications (
           id BIGINT PRIMARY KEY AUTO_INCREMENT,
           user_id BIGINT NOT NULL COMMENT '接收通知的用户ID',
           type ENUM('message', 'comment', 'like', 'follow', 'mention', 'system', 'profile_message') NOT NULL COMMENT '通知类型',
           title VARCHAR(200) DEFAULT NULL COMMENT '通知标题',
           content TEXT DEFAULT NULL COMMENT '通知内容',
           sender_id BIGINT DEFAULT NULL COMMENT '发送者ID',
           sender_avatar VARCHAR(255) DEFAULT NULL COMMENT '发送者头像（快照）',
           sender_nickname VARCHAR(100) DEFAULT NULL COMMENT '发送者昵称（快照）',
           related_id BIGINT DEFAULT NULL COMMENT '相关内容ID（帖子/评论/留言等）',
           related_type VARCHAR(50) DEFAULT NULL COMMENT '相关内容类型（post/comment/message等）',
           is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
           read_at TIMESTAMP NULL DEFAULT NULL COMMENT '阅读时间',
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
           FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
           FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
           INDEX idx_user_id (user_id),
           INDEX idx_type (type),
           INDEX idx_is_read (is_read),
           INDEX idx_created_at (created_at),
           INDEX idx_sender_id (sender_id)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';
       `);
       console.log('✓ 已创建 notifications 表');
     }
    
    const [notificationIsDeletedColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'is_deleted'`
    );
    
    if (!notificationIsDeletedColumn || notificationIsDeletedColumn.length === 0) {
      await connection.query(
        `ALTER TABLE notifications ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否删除'`
      );
      console.log('✓ 已添加 notifications.is_deleted 字段');
    }
    
    const [notificationDeletedAtColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'deleted_at'`
    );
    
    if (!notificationDeletedAtColumn || notificationDeletedAtColumn.length === 0) {
      await connection.query(
        `ALTER TABLE notifications ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '删除时间'`
      );
      console.log('✓ 已添加 notifications.deleted_at 字段');
    }
    
    const [notificationIsDeletedIndex] = await connection.query(
      `SHOW INDEX FROM notifications WHERE Key_name = 'idx_is_deleted'`
    );
    
    if (!notificationIsDeletedIndex || notificationIsDeletedIndex.length === 0) {
      await connection.query(`CREATE INDEX idx_is_deleted ON notifications(is_deleted)`);
      console.log('✓ 已添加 notifications.idx_is_deleted 索引');
    }

    // 检查并创建 user_messages 表
    const [userMessagesTable] = await connection.query(
      `SHOW TABLES LIKE 'user_messages'`
    );

    if (!userMessagesTable || userMessagesTable.length === 0) {
       await connection.query(`
         CREATE TABLE user_messages (
           id BIGINT PRIMARY KEY AUTO_INCREMENT,
           profile_user_id BIGINT NOT NULL COMMENT '留言板所属用户ID',
           sender_id BIGINT NOT NULL COMMENT '留言者ID',
           parent_id BIGINT DEFAULT NULL COMMENT '父留言ID（用于回复）',
           content TEXT NOT NULL COMMENT '留言内容',
           mentions JSON DEFAULT NULL COMMENT '@提及的用户ID列表',
           like_count INT DEFAULT 0 COMMENT '点赞数',
           reply_count INT DEFAULT 0 COMMENT '回复数',
           is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否删除',
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
           updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
           FOREIGN KEY (profile_user_id) REFERENCES users(id) ON DELETE CASCADE,
           FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
           FOREIGN KEY (parent_id) REFERENCES user_messages(id) ON DELETE CASCADE,
           INDEX idx_profile_user (profile_user_id),
           INDEX idx_sender_id (sender_id),
           INDEX idx_parent_id (parent_id),
           INDEX idx_created_at (created_at),
           INDEX idx_is_deleted (is_deleted)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户留言表';
       `);
       console.log('✓ 已创建 user_messages 表');
     }

    // 检查并创建 user_message_likes 表
    const [userMessageLikesTable] = await connection.query(
      `SHOW TABLES LIKE 'user_message_likes'`
    );

    if (!userMessageLikesTable || userMessageLikesTable.length === 0) {
       await connection.query(`
         CREATE TABLE user_message_likes (
           id BIGINT PRIMARY KEY AUTO_INCREMENT,
           message_id BIGINT NOT NULL COMMENT '留言ID',
           user_id BIGINT NOT NULL COMMENT '点赞用户ID',
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
           FOREIGN KEY (message_id) REFERENCES user_messages(id) ON DELETE CASCADE,
           FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
           UNIQUE KEY uk_message_user (message_id, user_id),
           INDEX idx_message_id (message_id),
           INDEX idx_user_id (user_id)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留言点赞表';
       `);
       console.log('✓ 已创建 user_message_likes 表');
     }

    // 检查并创建 user_follows 表
    const [userFollowsTable] = await connection.query(
      `SHOW TABLES LIKE 'user_follows'`
    );

    if (!userFollowsTable || userFollowsTable.length === 0) {
      await connection.query(`
        CREATE TABLE user_follows (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          follower_id BIGINT NOT NULL COMMENT '关注者ID',
          following_id BIGINT NOT NULL COMMENT '被关注者ID',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '关注时间',
          FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY uk_follower_following (follower_id, following_id),
          INDEX idx_follower (follower_id),
          INDEX idx_following (following_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户关注表';
      `);
      console.log('✓ 已创建 user_follows 表');
    }

    // 检查并创建 user_follow_point_rewards 表
    const [userFollowPointRewardsTable] = await connection.query(
      `SHOW TABLES LIKE 'user_follow_point_rewards'`
    );

    if (!userFollowPointRewardsTable || userFollowPointRewardsTable.length === 0) {
      await connection.query(`
        CREATE TABLE user_follow_point_rewards (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          follower_id BIGINT NOT NULL COMMENT '关注者ID',
          following_id BIGINT NOT NULL COMMENT '被关注者ID',
          points INT NOT NULL COMMENT '奖励积分',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
          FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY uk_follower_following_points (follower_id, following_id),
          INDEX idx_follower (follower_id),
          INDEX idx_following (following_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关注积分奖励记录表';
      `);
      console.log('✓ 已创建 user_follow_point_rewards 表');
    }

    // 检查并添加 game_rooms 表的 empty_at 字段
    const [emptyAtColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_rooms' AND COLUMN_NAME = 'empty_at'`
    );
    
    if (!emptyAtColumns || emptyAtColumns.length === 0) {
      await connection.query(
        `ALTER TABLE game_rooms ADD COLUMN empty_at DATETIME DEFAULT NULL COMMENT '房间变为空的时间'`
      );
      console.log('✓ 已添加 game_rooms.empty_at 字段');
    }

    const [lastActiveColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_rooms' AND COLUMN_NAME = 'last_active_at'`
    );
    
    if (!lastActiveColumns || lastActiveColumns.length === 0) {
      await connection.query(
        `ALTER TABLE game_rooms ADD COLUMN last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后活动时间'`
      );
      console.log('✓ 已添加 game_rooms.last_active_at 字段');
    }

    // 检查并添加 is_visible 字段到核心表
    const coreTables = [
      'users', 'posts', 'post_comments', 'topics', 'roles', 'chat_groups', 'sponsorships',
      'notifications', 'system_notifications', 'operation_logs', 'security_audits', 
      'system_logs', 'system_configs', 'messages', 'game_rooms', 'game_records', 'user_messages'
    ];
    for (const table of coreTables) {
      const [tableExists] = await connection.query(`SHOW TABLES LIKE ?`, [table]);
      if (tableExists && tableExists.length > 0) {
        const [visibleColumns] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'is_visible'`,
          [table]
        );
        
        if (!visibleColumns || visibleColumns.length === 0) {
          await connection.query(
            `ALTER TABLE ${table} ADD COLUMN is_visible BOOLEAN DEFAULT TRUE COMMENT '是否可见(软删除)'`
          );
          console.log(`✓ 已为 ${table} 表添加 is_visible 字段`);
        }
      }
    }

    const [oauthClientsTable] = await connection.query(`SHOW TABLES LIKE 'oauth_clients'`);
    if (!oauthClientsTable || oauthClientsTable.length === 0) {
      await connection.query(`
        CREATE TABLE oauth_clients (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          client_id VARCHAR(100) NOT NULL UNIQUE,
          client_secret VARCHAR(255) NOT NULL,
          client_name VARCHAR(100) NOT NULL,
          redirect_uris TEXT NOT NULL,
          redirect_blacklist TEXT DEFAULT NULL COMMENT '重定向地址黑名单，逗号分隔',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✓ 已创建 oauth_clients 表');
    }

    const [oauthCodesTable] = await connection.query(`SHOW TABLES LIKE 'oauth_codes'`);
    if (!oauthCodesTable || oauthCodesTable.length === 0) {
      await connection.query(`
        CREATE TABLE oauth_codes (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          code VARCHAR(100) NOT NULL UNIQUE,
          client_id VARCHAR(100) NOT NULL,
          user_id BIGINT NOT NULL,
          redirect_uri TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✓ 已创建 oauth_codes 表');
    }

    if (config.server.env === 'development') {
      await connection.query(
        `INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris)
         VALUES ('test_client', 'test_secret', '测试第三方应用', '*')
         ON DUPLICATE KEY UPDATE client_name = VALUES(client_name), redirect_uris = VALUES(redirect_uris);`
      );
    }

    connection.release();
  } catch (error) {
    console.error('确保数据库字段失败:', error);
    // 不抛出错误，允许系统继续运行
  }
}

export function getPool() {
  if (!pool) {
    throw new Error('数据库连接池未初始化，请先调用 initDatabase()');
  }
  return pool;
}

export async function query(sql, params) {
  const pool = getPool();
  try {
    return await pool.query(sql, params);
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

export async function transaction(callback) {
  const pool = getPool();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch {}

      const code = error?.code;
      const errno = error?.errno;
      const sqlState = error?.sqlState;
      const isDeadlock = code === 'ER_LOCK_DEADLOCK' || errno === 1213 || sqlState === '40001';

      if (isDeadlock && attempt < maxAttempts) {
        const delayMs = 50 * attempt;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      throw error;
    } finally {
      connection.release();
    }
  }
}
