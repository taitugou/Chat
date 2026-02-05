import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import { useAuthStore } from './stores/auth';
import { initSocket } from './utils/socket';
import { registerSW } from 'virtual:pwa-register';

// 注册 Service Worker 进行资源缓存
registerSW({
  onNeedRefresh() {
    console.log('应用有更新，请刷新页面以加载最新版本');
  },
  onOfflineReady() {
    console.log('应用已准备好离线使用');
  },
});

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// 在应用挂载前获取用户信息
async function initApp() {
  const authStore = useAuthStore();
  if (authStore.isAuthenticated) {
    try {
      await authStore.fetchUserInfo();
      await authStore.fetchUserSettings();
      
      // 全局初始化 Socket 连接
      if (authStore.token) {
        initSocket(authStore.token);
      }
    } catch (error) {
      console.warn('获取用户信息失败，可能是token已过期');
    }
  }
  app.mount('#app');
}

initApp();

