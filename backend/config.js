import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const rawCorsOrigins = process.env.CORS_ORIGIN || '*';
const normalizedCorsOrigins = rawCorsOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigin = normalizedCorsOrigins.length <= 1
  ? (normalizedCorsOrigins[0] || '*')
  : normalizedCorsOrigins;

export const config = {
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT || '888', 10),
    host: process.env.HOST || '::',
    env: process.env.NODE_ENV || 'development',
    trustProxy: process.env.TRUST_PROXY === 'true' ? true : (process.env.TRUST_PROXY === 'false' ? false : false),
    ssl: {
      enabled: process.env.SSL_ENABLED === 'true',
      key: process.env.SSL_KEY,
      cert: process.env.SSL_CERT,
    }
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'tai_chat',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  },

  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    rememberMeExpiresIn: process.env.JWT_REMEMBER_ME_EXPIRES_IN || '30d',
  },

  // 文件上传配置
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedImageTypes: (process.env.ALLOWED_IMAGE_TYPES || 'jpg,jpeg,png,gif').split(','),
    allowedVideoTypes: (process.env.ALLOWED_VIDEO_TYPES || 'mp4,webm').split(','),
  },

  // 内网穿透配置
  frp: {
    enabled: process.env.FRP_ENABLED === 'true',
    domain: process.env.FRP_DOMAIN || '',
  },

  // CORS配置
  cors: {
    origin: corsOrigin,
    credentials: true,
  },

  // Socket.IO配置
  socketIO: {
    path: process.env.SOCKET_IO_PATH || '/socket.io',
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    transports: ['websocket'],
    pingTimeout: 60000, // 增加超时时间，减少重连压力
    pingInterval: 25000, // 增加心跳间隔，减少 CPU 唤醒频率
    perMessageDeflate: {
      threshold: 1024
    },
    httpCompression: true,
    maxHttpBufferSize: 1e7
  },
};

export default config;
