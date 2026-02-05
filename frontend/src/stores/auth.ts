import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/utils/api';
import { initSocket, disconnectSocket } from '@/utils/socket';

interface User {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  roles?: { name: string }[];
  isGuest?: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(null);
  const defaultLandingPage = ref<string>('home');
  const isInitialLoading = ref(true);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => {
    if (!user.value || !user.value.roles) return false;
    return user.value.id === 1 || user.value.roles.some(role => role.name === 'admin' || role.name === 'super_admin');
  });

  const isSuperAdmin = computed(() => {
    if (!user.value || !user.value.roles) return false;
    return user.value.id === 1 || user.value.roles.some(role => role.name === 'super_admin');
  });

  async function login(account: string, password: string, rememberMe = false) {
    try {
      const response = await api.post('/auth/login', {
        account,
        password,
        rememberMe,
      });

      token.value = response.data.token;
      user.value = response.data.user;
      isInitialLoading.value = false;
      if (token.value) {
        localStorage.setItem('token', token.value);
        initSocket(token.value);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || '登录失败');
    }
  }

  async function register(data: {
    username: string;
    nickname: string;
    phone: string;
    email: string;
    password: string;
    interestTags?: string[];
  }) {
    try {
      const response = await api.post('/auth/register', data);

      token.value = response.data.token;
      user.value = response.data.user;
      if (token.value) {
        localStorage.setItem('token', token.value);
        initSocket(token.value);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || '注册失败');
    }
  }

  async function guestLogin() {
    try {
      const response = await api.post('/auth/guest-login');
      token.value = response.data.token;
      user.value = response.data.user;
      if (token.value) {
        localStorage.setItem('token', token.value);
        initSocket(token.value);
      }
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || '游客登录失败');
    }
  }

  async function upgradeGuest(data: {
    username: string;
    nickname: string;
    phone: string;
    email: string;
    password: string;
  }) {
    try {
      const response = await api.post('/auth/upgrade-guest', data);
      token.value = response.data.token;
      user.value = response.data.user;
      if (token.value) {
        localStorage.setItem('token', token.value);
        initSocket(token.value);
      }
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || '升级失败');
    }
  }

  async function fetchUserInfo() {
    try {
      const response = await api.get('/auth/me');
      user.value = response.data.user;
      return response.data.user;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.warn('Token无效或已过期，执行登出');
        console.error('获取用户信息失败:', error);
      }
      throw error;
    } finally {
      isInitialLoading.value = false;
    }
  }

  async function fetchUserSettings() {
    try {
      const response = await api.get('/settings/user');
      if (response.data.settings?.defaultLandingPage) {
        defaultLandingPage.value = response.data.settings.defaultLandingPage;
      }
    } catch (error) {
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    defaultLandingPage.value = 'home';
    localStorage.removeItem('token');
    disconnectSocket();
  }

  return {
    token,
    user,
    isInitialLoading,
    defaultLandingPage,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    login,
    register,
    guestLogin,
    upgradeGuest,
    fetchUserInfo,
    fetchUserSettings,
    logout,
  };
});

