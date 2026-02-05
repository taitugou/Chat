import { io, Socket } from 'socket.io-client';

const SOCKET_IO_PATH = import.meta.env.VITE_SOCKET_IO_PATH || '/socket.io';

export let socket: Socket | null = null;
let heartbeatInterval: any = null;
let visibilityHandler: (() => void) | null = null;

const HEARTBEAT_INTERVAL = 10000; // 10s

function resolveSocketServerUrl(): string {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!apiBaseUrl || apiBaseUrl.startsWith('/')) {
    return window.location.origin;
  }

  try {
    const url = new URL(apiBaseUrl);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      url.pathname = '';
    }
    url.search = '';
    url.hash = '';
    return url.origin;
  } catch {
    return apiBaseUrl.replace(/\/api\/?$/, '');
  }
}

function startActivityTracking() {
  // 确保先停止旧的追踪
  stopActivityTracking();

  visibilityHandler = () => {
    const isVisible = document.visibilityState === 'visible';
    const status = isVisible ? 'online' : 'offline';
    
    // 同步在线状态到服务器
    socket?.emit('status:update', { status });
    
    if (isVisible) {
      // 如果页面恢复活跃，立即发送心跳
      socket?.emit('user:heartbeat', { active: true });
    }
  };

  document.addEventListener('visibilitychange', visibilityHandler);

  // 定期心跳：仅在页面可见时维持活跃状态
  heartbeatInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      socket?.emit('user:heartbeat', { active: true });
    }
  }, HEARTBEAT_INTERVAL);

  // 初始状态同步：使用 user:online 触发完整的上线逻辑
  const initialStatus = document.visibilityState === 'visible' ? 'online' : 'offline';
  socket?.emit('user:online', { status: initialStatus });
  
  if (initialStatus === 'online') {
    socket?.emit('user:heartbeat', { active: true });
  }
}

function stopActivityTracking() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

export function initSocket(token: string): Socket {
  if (socket?.connected) {
    console.log('Socket已连接，返回现有socket');
    return socket;
  }

  const socketServerUrl = resolveSocketServerUrl();
  console.log('正在初始化Socket.IO连接...', socketServerUrl);
  socket = io(socketServerUrl, {
    path: SOCKET_IO_PATH,
    auth: {
      token,
    },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('Socket.IO连接成功！');
    startActivityTracking();
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO连接错误:', error);
    if (error.message === '令牌已过期' || error.message === 'Token expired' || error.message.includes('认证失败')) {
      localStorage.removeItem('token');
      // 可以选择是否强制刷新或跳转，但通常 API 拦截器会处理跳转
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO断开连接');
    stopActivityTracking();
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  stopActivityTracking();
}
