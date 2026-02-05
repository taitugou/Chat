<template>
  <nav class="fixed bottom-0 left-0 right-0 z-[50] pb-safe">
    <div class="mx-auto max-w-lg px-6 py-3">
      <div class="glass-nav rounded-[2rem] shadow-2xl shadow-black/40 flex items-center justify-between px-2 py-2 border border-white/5">
        <router-link 
          v-for="item in navItems" 
          :key="item.path"
          :to="item.path"
          class="relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 active:scale-90"
          :class="[isPathActive(item.path) ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/60']"
        >
          <span class="text-2xl mb-0.5">{{ item.icon }}</span>
          <span class="text-[9px] font-black uppercase tracking-tighter">{{ item.name }}</span>
          
          <!-- Unread dot for chat/notifications if needed -->
          <div v-if="item.showBadge && unreadCount > 0" class="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-[#1a1a2e] flex items-center justify-center">
            <span class="text-[8px] font-bold text-white">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </div>
          
          <!-- Active indicator -->
          <div v-if="isPathActive(item.path)" class="absolute -bottom-1 w-1 h-1 bg-primary rounded-full"></div>
        </router-link>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';

const route = useRoute();
const authStore = useAuthStore();
const unreadCount = ref(0);
let pollTimer: any = null;

const navItems = computed(() => {
  const items = [
    { name: '广场', path: '/home', icon: '🏛️' },
    { name: '动态', path: '/posts', icon: '📝' },
    { name: '匹配', path: '/match', icon: '🔥' },
    { name: '消息', path: '/friends', icon: '💬', showBadge: true },
  ];
  
  if (authStore.isSuperAdmin) {
     items.push({ name: '后台', path: '/superadmin', icon: '🛡️' });
   } else if (authStore.isAdmin) {
     items.push({ name: '后台', path: '/admin', icon: '🛡️' });
   }
  
  return items;
});

const isPathActive = (path: string) => {
  if (path === '/home') return route.path === '/home' || route.path === '/';
  return route.path.startsWith(path);
};

async function fetchUnreadCount() {
  try {
    const response = await api.get('/notification/unread-count');
    unreadCount.value = response.data.count || 0;
  } catch (error) {
    // Silently fail for unread count
  }
}

onMounted(() => {
  fetchUnreadCount();
  pollTimer = setInterval(fetchUnreadCount, 30000); // Poll every 30s
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.glass-nav {
  backdrop-filter: blur(24px) saturate(180%);
  background: rgba(255, 255, 255, 0.05);
}

.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 1.5rem);
}
</style>
