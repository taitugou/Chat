import mysql from 'mysql2/promise';
import { config } from '../config.js';

async function checkAndFixTables() {
  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
  });

  try {
    console.log('检查表结构...');

    const [postsColumns] = await connection.query('SHOW COLUMNS FROM posts');
    const hasPostsAnonymous = postsColumns.some(col => col.Field === 'is_anonymous');
    console.log('posts表 has_anonymous:', hasPostsAnonymous);

    const [topicsColumns] = await connection.query('SHOW COLUMNS FROM topics');
    const hasTopicsAnonymous = topicsColumns.some(col => col.Field === 'is_anonymous');
    console.log('topics表 has_anonymous:', hasTopicsAnonymous);

    const [commentsColumns] = await connection.query('SHOW COLUMNS FROM post_comments');
    const hasCommentsAnonymous = commentsColumns.some(col => col.Field === 'is_anonymous');
    console.log('post_comments表 has_anonymous:', hasCommentsAnonymous);

    if (!hasPostsAnonymous) {
      console.log('为posts表添加is_anonymous字段...');
      await connection.query(
        'ALTER TABLE posts ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE COMMENT "是否匿名" AFTER user_id'
      );
    }

    if (!hasTopicsAnonymous) {
      console.log('为topics表添加is_anonymous字段...');
      await connection.query(
        'ALTER TABLE topics ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE COMMENT "是否匿名" AFTER user_id'
      );
    }

    if (!hasCommentsAnonymous) {
      console.log('为post_comments表添加is_anonymous字段...');
      await connection.query(
        'ALTER TABLE post_comments ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE COMMENT "是否匿名" AFTER user_id'
      );
    }

    console.log('添加索引...');
    try {
      await connection.query('CREATE INDEX idx_posts_is_anonymous ON posts(is_anonymous)');
      console.log('posts索引添加成功');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') console.log('posts索引已存在或添加失败:', e.message);
    }

    try {
      await connection.query('CREATE INDEX idx_topics_is_anonymous ON topics(is_anonymous)');
      console.log('topics索引添加成功');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') console.log('topics索引已存在或添加失败:', e.message);
    }

    try {
      await connection.query('CREATE INDEX idx_post_comments_is_anonymous ON post_comments(is_anonymous)');
      console.log('post_comments索引添加成功');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') console.log('post_comments索引已存在或添加失败:', e.message);
    }

    console.log('数据库迁移完成!');
  } catch (error) {
    console.error('数据库迁移失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

checkAndFixTables().catch(console.error);
