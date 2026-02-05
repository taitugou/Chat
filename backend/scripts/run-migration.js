import mysql from 'mysql2/promise';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
  });

  try {
    console.log('开始执行数据库迁移...');

    const migrationPath = path.join(__dirname, '../../database/migrations/add_anonymous_support.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('USE'));

    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
        console.log('执行成功:', statement.trim().substring(0, 50) + '...');
      }
    }

    console.log('数据库迁移完成!');
  } catch (error) {
    console.error('数据库迁移失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
