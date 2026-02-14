<template>
  <nav class="ios-nav sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center gap-2">
          <router-link :to="brandLink" class="text-xl font-bold text-ios-label-primary cursor-pointer hover:text-ios-label-primary transition-colors">{{ brandText }}</router-link>
          <button 
            @click="showOnlineUsersModal = true"
            class="ios-badge flex items-center gap-1 hover:bg-ios-systemGray5 transition-colors"
          >
            <span 
              class="w-2 h-2 rounded-full animate-pulse"
              :class="isPageVisible ? 'bg-green-400' : 'bg-gray-400'"
            ></span>
            <span>{{ onlineCount }}</span>
          </button>
        </div>
        <div class="flex items-center space-x-4">
          <router-link v-if="route.path !== '/match' && route.path !== '/game'" to="/rankings" class="text-ios-label-primary hover:text-ios-label-secondary transition-colors" title="排行榜">
            <span class="text-xl">📊</span>
          </router-link>
          <router-link v-if="route.path !== '/match' && route.path !== '/game'" to="/search" class="text-ios-label-primary hover:text-ios-label-secondary transition-colors">
            <span class="text-xl">🔍</span>
          </router-link>
          <slot name="extra"></slot>
          <NotificationPanel />
          <router-link to="/profile" class="text-ios-label-primary hover:text-ios-label-secondary transition-colors">
            <img
              :src="getImageUrl(authStore.user?.avatar)"
              :alt="authStore.user?.nickname || '用户头像'"
              class="w-8 h-8 rounded-full border border-ios-separator"
            />
          </router-link>
        </div>
      </div>
    </div>

    <!-- 在线用户列表弹窗 -->
    <div v-if="showOnlineUsersModal" class="fixed inset-0 bg-ios-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showOnlineUsersModal = false">
      <div class="ios-modal w-full max-w-md max-h-[80vh] overflow-y-auto" @click.stop>
        <div class="flex items-center justify-between mb-4 p-4 border-b border-ios-separator">
          <h2 class="text-xl font-bold text-ios-label-primary">在线用户</h2>
          <button @click="showOnlineUsersModal = false" class="text-ios-label-secondary hover:text-ios-label-primary text-2xl leading-none">×</button>
        </div>
        <div class="p-4">
          <div v-if="loadingOnlineUsers" class="flex justify-center items-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-ios-separator0"></div>
          </div>
          <div v-else-if="onlineUsers.length === 0" class="text-center py-8 text-ios-label-secondary">
            暂无在线用户
          </div>
          <div v-else class="space-y-3">
            <div 
              v-for="user in onlineUsers" 
              :key="user.id"
              class="flex items-center gap-3 p-3 rounded-lg hover:bg-ios-systemGray5 transition-colors cursor-pointer"
              @click.stop="goToProfile(user.username)"
            >
              <div class="relative">
                <img
                  :src="getImageUrl(user.avatar)"
                  :alt="user.nickname || user.username"
                  class="w-12 h-12 rounded-full border-2 border-ios-separator"
                />
                <span 
                  class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black"
                  :class="{
                    'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]': user.online_status === 'online',
                    'bg-gray-400': !user.online_status || user.online_status === 'offline'
                  }"
                ></span>
              </div>
              <div class="flex-1">
                <div class="font-medium text-ios-label-primary">{{ user.nickname || user.username }}</div>
                <div class="text-sm text-ios-label-secondary">
                  {{ user.online_status === 'online' ? '在线' : '离线' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getSocket } from '@/utils/socket';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';
import NotificationPanel from '@/components/NotificationPanel.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const brandText = computed(() => {
  return route.path === '/game' ? 'TTG Game' : 'TTG Chat';
});

const brandLink = computed(() => {
  return route.path === '/game' ? '/home' : '/game';
});

const onlineCount = ref(0);
const showOnlineUsersModal = ref(false);
const onlineUsers = ref<any[]>([]);
const loadingOnlineUsers = ref(false);

async function fetchOnlineCount() {
  try {
    const response = await api.get('/online/count');
    onlineCount.value = response.data.count || 0;
  } catch (error) {
    console.error('获取在线人数失败:', error);
  }
}

async function fetchOnlineUsers() {
  loadingOnlineUsers.value = true;
  try {
    const response = await api.get('/online/list');
    onlineUsers.value = response.data.users || [];
  } catch (error) {
    console.error('获取在线用户列表失败:', error);
    onlineUsers.value = [];
  } finally {
    loadingOnlineUsers.value = false;
  }
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
  showOnlineUsersModal.value = false;
}

const isPageVisible = ref(document.visibilityState === 'visible');

onMounted(() => {
  fetchOnlineCount();
  
  const handleVisibilityChange = () => {
    isPageVisible.value = document.visibilityState === 'visible';
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  const socket = getSocket();
  if (socket) {
    socket.on('user:status_change', () => {
      fetchOnlineCount();
      if (showOnlineUsersModal.value) {
        fetchOnlineUsers();
      }
    });
  }

  const interval = setInterval(fetchOnlineCount, 30000);
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (socket) {
      socket.off('user:status_change');
    }
  };
});

watch(showOnlineUsersModal, (newVal) => {
  if (newVal) {
    fetchOnlineUsers();
  }
});
</script>
