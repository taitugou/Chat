<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
    <!-- 顶部导航 -->
    <div class="glass px-4 py-3 flex items-center z-50 shadow-sm border-b border-foreground/5">
      <button
        @click="goBack"
        class="p-2 -ml-2 rounded-full text-foreground/70 hover:text-white hover:bg-foreground/10 transition-all active:scale-90"
        title="返回"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0 ml-2">
        <div class="text-sm font-bold text-foreground/80">匹配记录</div>
        <div class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Match History</div>
      </div>
      <button
        v-if="matches.length > 0"
        @click="clearHistory"
        class="text-xs font-medium text-red-400/70 hover:text-red-400 transition-colors px-3 py-1.5 rounded-full hover:bg-red-400/10"
      >
        清空记录
      </button>
    </div>

    <!-- 列表内容 -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
      <div v-if="loading" class="flex flex-col items-center justify-center h-full space-y-4">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-foreground/40 font-bold uppercase tracking-widest">加载中...</p>
      </div>

      <div v-else-if="matches.length === 0" class="flex flex-col items-center justify-center h-full space-y-6">
        <div class="w-20 h-20 rounded-3xl bg-foreground/5 flex items-center justify-center animate-bounce duration-[2000ms]">
          <span class="text-3xl">🧭</span>
        </div>
        <div class="text-center space-y-2">
          <p class="text-foreground/80 font-bold text-lg">暂无匹配记录</p>
          <p class="text-xs text-foreground/30 uppercase tracking-widest">No match records found</p>
        </div>
        <button
          @click="$router.push('/match')"
          class="glass-btn-primary px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
        >
          前往匹配
        </button>
      </div>

      <div v-else class="space-y-3 pb-4">
        <div
          v-for="match in matches"
          :key="match.id"
          class="glass-card p-4 flex items-center gap-4 group hover:bg-white/5 transition-all border border-white/5"
        >
          <!-- 头像 -->
          <div class="relative cursor-pointer" @click="goToProfile(match.username)">
            <img
              :src="getAvatarUrl(match.avatar)"
              class="w-14 h-14 rounded-2xl object-cover ring-2 ring-foreground/5 group-hover:ring-primary/30 transition-all"
              alt="avatar"
            />
            <div
              v-if="match.online_status === 'online'"
              class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-black bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
            ></div>
          </div>

          <!-- 信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-black text-white truncate text-base">
                {{ match.is_anonymous ? '匿名用户' : (match.nickname || match.username) }}
              </span>
              <span v-if="match.score" class="text-[9px] px-2 py-0.5 rounded-md bg-primary/20 text-primary font-black uppercase tracking-widest">
                {{ Math.round(match.score) }}% 契合
              </span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
                {{ formatDate(match.created_at) }}
              </span>
              <span v-if="match.is_anonymous" class="text-[10px] text-yellow-500/50 font-black italic">
                #匿名匹配
              </span>
            </div>
          </div>

          <!-- 操作 -->
          <div class="flex items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
            <button
              @click="startChat(match)"
              class="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-90"
              title="开始聊天"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            <button
              @click="deleteEntry(match.id)"
              class="w-10 h-10 flex items-center justify-center rounded-xl text-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-90"
              title="删除记录"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore" class="pt-4 pb-8 flex justify-center">
          <button
            @click="loadMore"
            :disabled="loadingMore"
            class="px-8 py-2.5 rounded-xl glass text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 hover:text-white hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50"
          >
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';

const router = useRouter();
const matches = ref<any[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const page = ref(1);
const hasMore = ref(true);
const limit = 20;

function getAvatarUrl(url: string) {
  return getImageUrl(url);
}

async function fetchHistory(isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMore.value = true;
    } else {
      loading.value = true;
      page.value = 1;
    }

    const response = await api.get('/match/history', {
      params: {
        page: page.value,
        limit
      }
    });

    const newMatches = response.data.matches || [];
    if (isLoadMore) {
      matches.value = [...matches.value, ...newMatches];
    } else {
      matches.value = newMatches;
    }

    hasMore.value = newMatches.length === limit;
  } catch (error) {
    console.error('获取匹配历史失败:', error);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return;
  page.value++;
  await fetchHistory(true);
}

async function deleteEntry(id: number) {
  if (!confirm('确定要删除这条记录吗？')) return;
  try {
    await api.delete(`/match/history/${id}`);
    matches.value = matches.value.filter(m => m.id !== id);
  } catch (error) {
    console.error('删除失败:', error);
  }
}

async function clearHistory() {
  if (!confirm('确定要清空所有匹配记录吗？此操作不可撤销。')) return;
  try {
    await api.delete('/match/history');
    matches.value = [];
  } catch (error) {
    console.error('清空失败:', error);
  }
}

function startChat(match: any) {
  if (match.room_id) {
    router.push(`/chat/${match.matched_user_id}?room_id=${match.room_id}`);
  } else {
    router.push(`/chat/${match.matched_user_id}`);
  }
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}

function goBack() {
  router.back();
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  
  const isToday = date.getFullYear() === now.getFullYear() &&
                  date.getMonth() === now.getMonth() &&
                  date.getDate() === now.getDate();
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  if (isToday) {
    return `今天 ${hours}:${minutes}`;
  }
  
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

onMounted(() => {
  fetchHistory();
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
