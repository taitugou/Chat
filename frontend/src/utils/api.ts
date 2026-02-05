import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('API baseURL:', import.meta.env.VITE_API_BASE_URL || '/api');

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    console.log('API请求:', config.method?.toUpperCase(), config.url);
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('API请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    console.log('API响应:', response.config.url, response.status);
    return response;
  },
  async (error) => {
    // 特殊处理：如果加入房间时提示已在房间中，且当前不在房间页面，则自动离开并重试
    if (
      error.response?.status === 400 && 
      error.response?.data?.message === '已在房间中' &&
      !error.config._retry &&
      !window.location.pathname.includes('/game/room/')
    ) {
      console.log('检测到残留房间状态，正在自动清理...');
      try {
        error.config._retry = true;
        // 使用 axios 实例本身调用，避免循环依赖问题，或者直接用 api 变量
        await api.post('/rooms/leave-all');
        console.log('清理成功，正在重试加入...');
        return api(error.config);
      } catch (retryError) {
        console.error('自动清理并重试失败:', retryError);
        // 如果清理失败，继续抛出原始错误
      }
    }

    console.error('API响应错误:', error.config?.url, error.response?.status, error.response?.data);
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/') {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath + window.location.search)}`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

