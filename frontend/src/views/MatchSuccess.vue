<template>
  <div class="min-h-screen flex items-center justify-center bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300 p-4">
    <div class="ios-card w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in duration-500 text-center">
      <div class="space-y-6">
        <!-- 匹配成功头部 -->
        <div class="space-y-2">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-ios-blue/20 rounded-full text-4xl mb-4 animate-bounce">
            ✨
          </div>
          <h1 class="text-3xl font-black text-white tracking-tight">匹配成功！</h1>
          <p class="text-ios-label-tertiary text-sm font-medium">为你找到了最契合的灵魂</p>
        </div>

        <!-- 匹配者信息 -->
        <div class="relative group py-4">
          <div class="flex flex-col items-center gap-4">
            <div class="relative">
              <img
                :src="getImageUrl(isAnonymous ? null : matchedUser?.avatar)"
                class="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-ios-blue/20 shadow-2xl transition-transform group-hover:scale-105"
              />
              <div v-if="isAnonymous" class="absolute inset-0 bg-ios-black/40 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center">
                <span class="text-2xl">👤</span>
              </div>
            </div>
            <h2 class="text-xl font-bold text-white">
              {{ isAnonymous ? '神秘用户' : (matchedUser?.nickname || matchedUser?.username) }}
            </h2>
            <div class="flex items-center justify-center gap-2">
              <div class="h-1.5 w-24 bg-ios-systemGray5 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-ios-blue to-purple-500 transition-all duration-1000"
                  :style="{ width: `${matchScore}%` }"
                ></div>
              </div>
              <span class="text-xs font-bold text-ios-blue">{{ matchScore }}% 匹配度</span>
            </div>
          </div>
          
          <!-- 匹配统计 -->
          <div v-if="matchStats" class="bg-ios-systemGray5 rounded-2xl p-4 border border-ios-separator space-y-2 mt-6">
            <p class="text-sm font-medium text-ios-label-secondary">这是你们第 <span class="text-ios-blue font-bold">{{ matchStats.count }}</span> 次匹配</p>
            <p v-if="matchStats.lastMatchAt" class="text-[10px] text-ios-label-tertiary uppercase tracking-widest">
              上次见面：{{ formatLastMatchTime(matchStats.lastMatchAt) }}
            </p>
            <p v-else class="text-[10px] text-ios-label-tertiary uppercase tracking-widest">首次奇妙相遇</p>
          </div>
          
          <!-- 状态提示 -->
          <div class="py-2 mt-4">
            <p v-if="myStatus === 'pending'" class="text-sm text-ios-label-secondary animate-pulse">请确认是否开始交流</p>
            <div v-else class="flex flex-col items-center gap-2">
              <div v-if="myStatus === 'accepted' && otherStatus === 'pending'" class="flex items-center gap-2 text-xs text-ios-label-tertiary">
                <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                等待对方确认...
              </div>
              <p v-else-if="myStatus === 'accepted' && otherStatus === 'accepted'" class="text-sm font-bold text-green-400">
                契合达成！即将进入聊天...
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="space-y-3 mt-8">
        <template v-if="myStatus === 'pending'">
          <div class="grid grid-cols-2 gap-3">
            <button
              @click="acceptMatch"
              :disabled="loading"
              class="ios-btn-primary py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all disabled:opacity-50"
            >
              {{ loading ? '处理中...' : '同意' }}
            </button>
            <button
              @click="rejectMatch"
              :disabled="loading"
              class="ios-btn-secondary py-4 rounded-2xl font-bold text-ios-label-secondary active:scale-95 transition-all disabled:opacity-50"
            >
              拒绝
            </button>
          </div>
        </template>
        
        <template v-else-if="myStatus === 'accepted'">
          <button
            v-if="otherStatus !== 'accepted'"
            @click="rejectMatch"
            class="w-full ios-btn-secondary py-4 rounded-2xl font-bold text-red-400/80 active:scale-95 transition-all"
          >
            放弃并重新匹配
          </button>
          <div v-else class="w-full py-4 text-center">
            <div class="inline-flex items-center gap-2 px-6 py-2 bg-ios-blue/20 rounded-full border border-ios-blue/20 text-ios-blue text-sm font-bold animate-pulse">
              🚀 正在开启时空门...
            </div>
          </div>
        </template>

        <button
          v-if="!isAnonymous"
          @click.stop="goToProfile"
          class="w-full ios-btn-secondary py-4 rounded-2xl font-bold text-ios-label-tertiary text-sm hover:text-white transition-colors active:scale-95"
        >
          查看详细资料
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getSocket } from '@/utils/socket';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';

const router = useRouter();

const matchedUser = ref<any>(null);
const matchScore = ref(0);
const isAnonymous = ref(false);
const loading = ref(false);
const myStatus = ref('pending');
const otherStatus = ref('pending');
const matchStats = ref<any>(null);
const roomId = ref<string | null>(null);
const pollInterval = ref<any>(null);
const isNavigatingToChat = ref(false);

onMounted(() => {
  loadMatchResult();
  startPolling();
});

onUnmounted(() => {
  stopPolling();

  if (!isNavigatingToChat.value) {
    localStorage.removeItem('matchResult');
    api.post('/match/cancel').catch(err => console.error('清理匹配状态失败', err));
  }
});

function formatLastMatchTime(timeStr: string) {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 365) return `${Math.floor(days / 365)} 年前`;
  if (days > 30) return `${Math.floor(days / 30)} 个月前`;
  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  if (minutes > 0) return `${minutes} 分钟前`;
  return '刚刚';
}

function startPolling() {
  if (pollInterval.value) return;
  pollInterval.value = setInterval(async () => {
    try {
      const response = await api.get('/match/result');
      if (response.data.matched) {
        myStatus.value = response.data.status || 'pending';
        otherStatus.value = response.data.otherStatus || 'pending';
        matchStats.value = response.data.matchStats || null;
        roomId.value = response.data.roomId || null;
        
        if (myStatus.value === 'accepted' && otherStatus.value === 'accepted') {
          stopPolling();
          setTimeout(() => {
            startChat();
          }, 1500);
        }
      } else if (response.data.reason === 'REJECTED') {
        stopPolling();
        alert('匹配已被拒绝，将为您重新匹配');
        continueMatch(true);
      }
    } catch (error) {
      console.error('轮询状态失败', error);
    }
  }, 2000);
}

function stopPolling() {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }
}

async function acceptMatch() {
  loading.value = true;
  try {
    const response = await api.post('/match/accept');
    myStatus.value = response.data.status;
    otherStatus.value = response.data.otherStatus;
    roomId.value = response.data.roomId || null;
    
    if (response.data.bothAccepted) {
      stopPolling();
      setTimeout(() => {
        startChat();
      }, 1500);
    }
  } catch (error: any) {
    console.error('同意匹配失败:', error);
    alert(error.response?.data?.error || '操作失败');
  } finally {
    loading.value = false;
  }
}

async function rejectMatch() {
  if (!confirm('确定要拒绝本次匹配吗？拒绝后将自动开始重新匹配')) return;
  
  loading.value = true;
  try {
    await api.post('/match/reject');
    localStorage.removeItem('matchResult');
    stopPolling();
    continueMatch(true);
  } catch (error: any) {
    console.error('拒绝匹配失败:', error);
    alert(error.response?.data?.error || '操作失败');
  } finally {
    loading.value = false;
  }
}

function loadMatchResult() {
  try {
    const matchResultStr = localStorage.getItem('matchResult');
    if (matchResultStr) {
      const matchResult = JSON.parse(matchResultStr);
      matchedUser.value = matchResult.user;
      // 后端现在返回 0-100 的整数分数
      const rawScore = typeof matchResult.score === 'number' ? matchResult.score : 85;
      matchScore.value = Math.round(rawScore);
      isAnonymous.value = matchResult.isAnonymous || false;
      matchStats.value = matchResult.matchStats || null;
      roomId.value = matchResult.roomId || null;
    } else {
      router.push('/match');
    }
  } catch (error) {
    console.error('加载匹配结果失败:', error);
    router.push('/match');
  }
}

function startChat() {
  if (matchedUser.value) {
    isNavigatingToChat.value = true;
    localStorage.removeItem('matchResult');
    const chatUrl = roomId.value 
      ? `/chat/${matchedUser.value.id}?room_id=${roomId.value}`
      : `/chat/${matchedUser.value.id}`;
    router.push(chatUrl);
  }
}

function goToProfile() {
  if (matchedUser.value?.username) {
    router.push(`/profile/${matchedUser.value.username}`);
  }
}

function continueMatch(autoMatch = false) {
  if (autoMatch) {
    router.push({ path: '/match', query: { autoMatch: 'true' } });
  } else {
    router.push('/match');
  }
}
</script>
