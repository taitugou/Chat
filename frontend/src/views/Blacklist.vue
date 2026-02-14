<template>
  <div class="h-screen flex flex-col overflow-hidden bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300">
    <!-- 顶部导航栏 -->
    <div class="ios-glass px-4 py-3 flex items-center z-50 shadow-sm border-b border-ios-separator">
      <button
        @click="goBackOneLevel"
        class="p-2 -ml-2 rounded-full text-ios-label-secondary hover:text-ios-label-primary hover:bg-ios-systemGray5 transition-all active:scale-90"
        title="返回上一页"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0 ml-2">
        <div class="text-sm font-bold text-ios-label-primary">黑名单</div>
        <div class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest">Blacklist</div>
      </div>
      <div class="text-[10px] font-bold text-ios-label-tertiary bg-ios-systemGray5 px-2 py-1 rounded-lg">
        {{ blacklist.length }} 人
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
      <div v-if="loading && blacklist.length === 0" class="flex flex-col items-center justify-center py-20 space-y-4">
        <div class="w-10 h-10 border-4 border-ios-blue/30 border-t-primary rounded-full animate-spin"></div>
        <p class="text-xs text-ios-label-tertiary">加载名单中...</p>
      </div>

      <div v-else-if="blacklist.length === 0" class="flex flex-col items-center justify-center py-20 space-y-6 text-center px-10">
        <div class="w-20 h-20 rounded-3xl bg-ios-systemGray5 flex items-center justify-center text-3xl grayscale opacity-30">
          🚫
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-bold text-ios-label-primary">黑名单空空如也</h3>
          <p class="text-[10px] text-ios-label-tertiary leading-relaxed">
            被屏蔽的用户将无法关注你、给你发私信或在你的帖子下评论。
          </p>
        </div>
      </div>

      <div v-else class="grid gap-3">
        <div 
          v-for="user in blacklist" 
          :key="user.id"
          class="ios-card p-3 rounded-2xl flex items-center justify-between group"
        >
          <div class="flex items-center space-x-3">
            <img :src="user.avatar" class="w-10 h-10 rounded-xl object-cover bg-ios-systemGray5" />
            <div>
              <div class="text-sm font-bold text-ios-label-primary">{{ user.nickname }}</div>
              <div class="text-[10px] text-ios-label-tertiary">@{{ user.username }}</div>
            </div>
          </div>
          <button 
            @click="unblockUser(user)"
            :disabled="unblocking === user.id"
            class="ios-btn-secondary px-3 py-1.5 rounded-xl text-[10px] font-bold text-ios-label-secondary hover:text-red-400 transition-all active:scale-95 disabled:opacity-50"
          >
            {{ unblocking === user.id ? '处理中...' : '解除屏蔽' }}
          </button>
        </div>
      </div>

      <div class="px-2 pt-4">
        <p class="text-[10px] text-ios-label-tertiary text-center leading-relaxed">
          温馨提示：解除屏蔽后，对方将恢复与你的正常互动权限。
        </p>
      </div>
    </div>

    <!-- 提示消息 -->
    <div v-if="toast.show" class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div :class="[
        'px-6 py-3 rounded-2xl shadow-xl backdrop-blur-md border font-bold text-sm',
        toast.type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'
      ]">
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';

const router = useRouter();

// 状态定义
const loading = ref(false);
const unblocking = ref<number | null>(null);
const blacklist = ref<any[]>([]);

const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error',
});

// 方法定义
function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
}

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  router.push('/settings');
}

async function fetchBlacklist() {
  loading.value = true;
  try {
    const response = await api.get('/user/block/list');
    blacklist.value = response.data.blacklist || [];
  } catch (error) {
    console.error('获取黑名单失败:', error);
    showToast('获取名单失败', 'error');
  } finally {
    loading.value = false;
  }
}

async function unblockUser(user: any) {
  if (unblocking.value !== null) return;
  if (!confirm(`确定要将 ${user.nickname} 从黑名单中移除吗？`)) return;

  unblocking.value = user.id;
  try {
    await api.delete(`/user/block/${user.id}`);
    blacklist.value = blacklist.value.filter(u => u.id !== user.id);
    showToast(`已解除对 ${user.nickname} 的屏蔽`);
  } catch (error: any) {
    showToast(error.response?.data?.error || '解除失败', 'error');
  } finally {
    unblocking.value = null;
  }
}

onMounted(() => {
  fetchBlacklist();
});
</script>

<style scoped>
.ios-card {
  background: var(--ios-glass-bg);
  border: 1px solid var(--ios-glass-border);
  backdrop-filter: blur(24px);
  box-shadow: var(--shadow-lg);
  border-radius: 1.5rem;
}
.ios-btn-secondary {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}
.ios-btn-secondary:hover {
  background: var(--bg-hover);
  color: var(--text-ios-blue);
}
</style>
