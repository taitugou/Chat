import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import compression from 'compression';
import { config } from './config.js';
import { initDatabase } from './database/connection.js';
import { initRedis, createRedisClient } from './database/redis.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import chipRoutes from './routes/chips.js';
import gameRoutes from './routes/games.js';
import onlineRoutes from './routes/online.js';
import userRoutes from './routes/user.js';
import topicRoutes from './routes/topic.js';
import postRoutes from './routes/post.js';
import notificationRoutes from './routes/notification.js';
import settingsRoutes from './routes/settings.js';
import pointRoutes from './routes/points.js';
import mentionRoutes from './routes/mention.js';
import chatRoutes from './routes/chat.js';
import taskRoutes from './routes/task.js';
import searchRoutes from './routes/search.js';
import oauthRoutes from './routes/oauth.js';
import guestbookRoutes from './routes/guestbook.js';
import groupRoutes from './routes/group.js';
import matchRoutes from './routes/match.js';
import loanRoutes from './routes/loans.js';
import adminEnhancedRoutes from './routes/adminEnhanced.js';
import musicRoutes from './routes/music.js';
import { initSocketHandlers } from './socket/handlers.js';
import { socketAuth } from './middleware/socketAuth.js';
import { startMessageConsumer } from './services/messageQueue.js';
import { ensureDefaultGameTypes } from './services/ensureGameTypes.js';
import { startRoomCleanupService } from './services/roomCleanupService.js';
import { resetAllRoomPresence, startGameRoomPresenceService } from './services/gameRoomPresenceService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let httpServer;

if (config.server.ssl.enabled) {
  try {
    const keyPath = config.server.ssl.key;
    const certPath = config.server.ssl.cert;
    const resolvePath = (p) => {
      if (fs.existsSync(p)) return p;
      const relative = path.join(__dirname, p);
      if (fs.existsSync(relative)) return relative;
      return p;
    };
    const options = {
      key: fs.readFileSync(resolvePath(keyPath)),
      cert: fs.readFileSync(resolvePath(certPath))
    };
    httpServer = https.createServer(options, app);
    console.log('SSL/HTTPS enabled');
  } catch (error) {
    console.error('Failed to load SSL certificates:', error);
    console.warn('Falling back to HTTP');
    httpServer = http.createServer(app);
  }
} else {
  httpServer = http.createServer(app);
}

const io = new Server(httpServer, config.socketIO);

app.set('trust proxy', config.server.trustProxy);
app.use(cors(config.cors));
app.use(compression());
app.use(express.json());
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use((req, res, next) => {
  if (config.server.env === 'development') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes(io));
app.use('/api/chips', chipRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/online', onlineRoutes);
app.use('/api/user', userRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/points', pointRoutes);
app.use('/api/mention', mentionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/guestbook', guestbookRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/admin', adminEnhancedRoutes);
app.use('/api/music', musicRoutes);

io.use(socketAuth);

io.on('connection', (socket) => {
  initSocketHandlers(io, socket);
});

const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=604800');
    if (filePath.includes('posts')) {
      const ext = path.extname(filePath).toLowerCase();
      const mediaExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm', '.ogg', '.mp3', '.wav'];
      if (!mediaExts.includes(ext)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    }
  }
}));

app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(`Error processing request ${req.method} ${req.url}:`, err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    await ensureDefaultGameTypes();
    startRoomCleanupService();
    try {
      await resetAllRoomPresence();
    } catch (error) {
      console.error('[gameRoomPresence] 初始化离线重置失败:', error);
    }
    await initRedis();
    const pubClient = createRedisClient();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    startGameRoomPresenceService(io);
    startMessageConsumer(io);
    const { port, host, ipv6Only } = config.server;
    const protocol = config.server.ssl.enabled ? 'https' : 'http';
    httpServer.listen({ port, host, ipv6Only }, () => {
      console.log(`Server running on ${protocol}://${host === '::' ? 'localhost' : host}:${port}`);
      console.log(`Environment: ${config.server.env}`);
    });
  } catch (err) {
    console.error('Critical failure during server startup:', err);
    process.exit(1);
  }
};

startServer();

export { app, io };
