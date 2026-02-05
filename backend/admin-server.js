import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { initDatabase } from './database/connection.js';
import { initRedis } from './database/redis.js';
import adminRoutes from './routes/adminEnhanced.js';
import { errorHandler } from './middleware/errorHandler.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建管理员服务器实例
const adminApp = express();
const adminHttpServer = createServer(adminApp);

// 中间件
adminApp.use(helmet({
  contentSecurityPolicy: false, // 允许内联脚本用于开发
}));
adminApp.use(cors({
  origin: '*',
  credentials: true,
}));
adminApp.use(express.json({ limit: '10mb' }));
adminApp.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查
adminApp.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'admin' });
});

// API路由 - 管理员路由使用根路径
adminApp.use('/api/admin', adminRoutes);

// 静态文件服务 - 前端构建文件
const frontendDistPath = path.join(__dirname, '../frontend/dist');
adminApp.use(express.static(frontendDistPath));

// 静态文件服务 - 上传文件
adminApp.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // 为 posts 目录下的非媒体文件设置强制下载
    if (filePath.includes('posts')) {
      const ext = path.extname(filePath).toLowerCase();
      const mediaExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm', '.ogg', '.mp3', '.wav'];
      if (!mediaExts.includes(ext)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    }
  }
}));

// 单页应用(SPA)路由处理 - catch-all路由
adminApp.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// 错误处理
adminApp.use(errorHandler);

// 启动管理员服务器
async function startAdminServer() {
  try {
    // 尝试初始化数据库连接，但不阻塞服务器启动
    initDatabase()
      .then(() => console.log('✓ 管理员服务器 - MySQL数据库连接成功'))
      .catch((error) => console.warn('⚠️ 管理员服务器 - MySQL数据库连接失败:', error.message));

    // 尝试初始化Redis连接，但不阻塞服务器启动
    initRedis()
      .then(() => console.log('✓ 管理员服务器 - Redis连接成功'))
      .catch((error) => console.warn('⚠️ 管理员服务器 - Redis连接失败:', error.message));

    // 启动HTTP服务器，使用1127端口
    const adminPort = 1127;
    adminHttpServer.listen(adminPort, config.server.host, () => {
      console.log(`✓ 管理员服务器运行在 http://${config.server.host}:${adminPort}`);
      console.log(`✓ 管理员API路径: http://${config.server.host}:${adminPort}/api/admin`);
    });
  } catch (error) {
    console.error('✗ 管理员服务器启动失败:', error);
    process.exit(1);
  }
}

startAdminServer();

export { adminApp };
