import mysql from 'mysql2/promise';
import fs from 'fs';
import { config } from '../config.js';

async function runMigration() {
  let pool = null;
  try {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });

    const sql = fs.readFileSync(new URL('../database/calls_table.sql', import.meta.url), 'utf8');
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await pool.query(stmt);
          console.log('Executed:', stmt.substring(0, 50) + '...');
        } catch (e) {
          console.log('Error or already exists:', e.message);
        }
      }
    }
    
    console.log('Migration completed!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    if (pool) await pool.end();
    process.exit(1);
  }
}

runMigration();
