import { initDatabase } from '../database/connection.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('开始执行社交功能数据库迁移...');

    await initDatabase();

    const sqlPath = path.join(__dirname, '..', 'database', 'social_features.sql');
    const sql = await fs.readFile(sqlPath, 'utf-8');

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await query(statement);
        console.log('✓ 执行成功:', statement.substring(0, 50) + '...');
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_FIELDNAME') {
          console.log('⊘ 跳过（已存在）:', statement.substring(0, 50) + '...');
        } else {
          console.error('✗ 执行失败:', statement.substring(0, 50) + '...');
          console.error('错误:', error.message);
        }
      }
    }

    console.log('✓ 社交功能数据库迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('✗ 数据库迁移失败:', error);
    process.exit(1);
  }
}

runMigration();
