<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
    <!-- 顶部导航栏 -->
    <div class="glass px-4 py-3 flex items-center z-50 shadow-sm border-b border-foreground/5">
      <button
        @click="goBackOneLevel"
        class="p-2 -ml-2 rounded-full text-foreground/70 hover:text-white hover:bg-foreground/10 transition-all active:scale-90"
        title="返回上一页"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0 ml-2">
        <div class="text-sm font-bold text-foreground/80">积分中心</div>
        <div class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Points Center</div>
      </div>
      <div class="flex items-center space-x-1 bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
        <span class="text-xs font-bold text-primary">{{ totalPoints }}</span>
        <span class="text-[10px] text-primary/60 font-black">PTS</span>
      </div>
    </div>

    <!-- 顶部概览卡片 -->
    <div class="p-4">
      <div class="glass-card p-6 rounded-[2rem] relative overflow-hidden bg-gradient-to-br from-primary/20 via-transparent to-transparent">
        <div class="relative z-10 flex flex-col items-center text-center space-y-4">
          <div class="w-16 h-16 rounded-3xl bg-primary/20 flex items-center justify-center text-3xl animate-pulse">
            ⭐
          </div>
          <div class="space-y-1">
            <h2 class="text-3xl font-black text-white tracking-tight">{{ totalPoints }}</h2>
            <p class="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.2em]">当前可用积分</p>
          </div>
          <button 
            @click="handleCheckin"
            :disabled="checkinStatus.checkedInToday || checkinLoading"
            class="glass-btn-primary px-8 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
          >
            {{ checkinStatus.checkedInToday ? '今日已签到' : '立即签到' }}
          </button>
          <div v-if="checkinStatus.consecutiveDays > 0" class="text-[10px] font-bold text-primary/60 uppercase tracking-widest animate-in fade-in slide-in-from-top-2">
            已连续签到 {{ checkinStatus.consecutiveDays }} 天
          </div>
        </div>
        <!-- 装饰背景 -->
        <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
        <div class="absolute -left-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
      </div>
    </div>

    <!-- 选项卡切换 -->
    <div class="px-4 mb-2">
      <div class="flex p-1 bg-foreground/5 rounded-2xl">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
            activeTab === tab.id ? 'bg-white text-black shadow-lg' : 'text-foreground/40 hover:text-foreground/60'
          ]"
        >
          {{ tab.name }}
        </button>
      </div>
    </div>

    <!-- 列表内容 -->
    <div class="flex-1 overflow-y-auto px-4 pb-24">
      <!-- 积分明细 -->
      <div v-if="activeTab === 'records'" class="space-y-3">
        <div v-if="recordsLoading && records.length === 0" class="flex justify-center py-20">
          <div class="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
        <div v-else-if="records.length === 0" class="text-center py-20 text-foreground/30 text-xs">
          暂无积分变动记录
        </div>
        <div 
          v-for="record in records" 
          :key="record.id"
          class="glass-card p-4 rounded-2xl flex items-center justify-between"
        >
          <div class="flex items-center space-x-3">
            <div :class="[
              'w-10 h-10 rounded-xl flex items-center justify-center text-lg',
              record.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            ]">
              {{ record.amount > 0 ? '＋' : '－' }}
            </div>
            <div>
              <div class="text-xs font-bold text-white">{{ record.description || '积分变动' }}</div>
              <div class="text-[10px] text-foreground/40">{{ formatDate(record.created_at) }}</div>
            </div>
          </div>
          <div :class="[
            'text-sm font-black',
            record.amount > 0 ? 'text-green-400' : 'text-red-400'
          ]">
            {{ record.amount > 0 ? '+' : '' }}{{ record.amount }}
          </div>
        </div>
        <!-- 加载更多 -->
        <button 
          v-if="hasMoreRecords" 
          @click="fetchRecords(true)"
          :disabled="recordsLoading"
          class="glass-btn w-full py-3 rounded-2xl text-[10px] font-bold text-foreground/40 hover:text-foreground/60 transition-all active:scale-[0.98]"
        >
          {{ recordsLoading ? '加载中...' : '查看更多' }}
        </button>
      </div>

      <!-- 积分排行 -->
      <div v-if="activeTab === 'ranking'" class="space-y-3">
        <div v-if="rankingLoading" class="flex justify-center py-20">
          <div class="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
        <div 
          v-for="(user, index) in ranking" 
          :key="user.user_id"
          :class="[
            'glass-card p-4 rounded-2xl flex items-center justify-between',
            user.is_current_user ? 'border-primary/40 bg-primary/5' : ''
          ]"
        >
          <div class="flex items-center space-x-4">
            <div :class="[
              'w-6 text-center font-black italic',
              index === 0 ? 'text-yellow-400 text-lg' : index === 1 ? 'text-gray-300 text-lg' : index === 2 ? 'text-orange-400 text-lg' : 'text-foreground/20 text-xs'
            ]">
              {{ index + 1 }}
            </div>
            <img :src="user.avatar" class="w-10 h-10 rounded-xl object-cover bg-foreground/10" />
            <div>
              <div class="text-xs font-bold text-white flex items-center space-x-1">
                <span>{{ user.nickname }}</span>
                <span v-if="user.is_current_user" class="text-[8px] bg-primary/20 text-primary px-1 rounded uppercase">Me</span>
              </div>
              <div class="text-[10px] text-foreground/40">@{{ user.username }}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-black text-white">{{ user.points }}</div>
            <div class="text-[8px] font-black text-foreground/30 uppercase tracking-tighter">Points</div>
          </div>
        </div>
      </div>

      <!-- 获取规则 -->
      <div v-if="activeTab === 'rules'" class="space-y-6 pt-2">
        <div class="space-y-3">
          <h4 class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] px-2">如何赚取积分</h4>
          <div class="glass-card divide-y divide-foreground/5 rounded-2xl overflow-hidden">
            <div v-for="(val, key) in rules.rewards" :key="key" class="p-4 flex items-center justify-between">
              <div class="space-y-0.5">
                <div class="text-xs font-bold text-white">{{ ruleLabels[key] || key }}</div>
                <div class="text-[10px] text-foreground/40">{{ ruleDescriptions[key] }}</div>
              </div>
              <div class="text-xs font-black text-green-400">+{{ val }}</div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <h4 class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] px-2">积分消耗</h4>
          <div class="glass-card divide-y divide-foreground/5 rounded-2xl overflow-hidden">
            <div v-for="(val, key) in rules.costs" :key="key" class="p-4 flex items-center justify-between">
              <div class="space-y-0.5">
                <div class="text-xs font-bold text-white">{{ ruleLabels[key] || key }}</div>
                <div class="text-[10px] text-foreground/40">{{ ruleDescriptions[key] }}</div>
              </div>
              <div class="text-xs font-black text-red-400">-{{ val }}</div>
            </div>
          </div>
        </div>
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
const activeTab = ref('records');
const totalPoints = ref(0);
const records = ref<any[]>([]);
const ranking = ref<any[]>([]);
const recordsLoading = ref(false);
const rankingLoading = ref(false);
const checkinLoading = ref(false);
const currentPage = ref(1);
const hasMoreRecords = ref(true);

const checkinStatus = reactive({
  checkedInToday: false,
  consecutiveDays: 0,
});

const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error',
});

const tabs = [
  { id: 'records', name: '积分明细' },
  { id: 'ranking', name: '积分排行' },
  { id: 'rules', name: '获取规则' },
];

const rules = reactive({
  rewards: {} as Record<string, number>,
  costs: {} as Record<string, number>,
});

const ruleLabels: Record<string, string> = {
  DAILY_CHECKIN: '每日签到',
  DAILY_CHECKIN_INCREMENT: '连签加成',
  DAILY_CHECKIN_MAX: '签到上限',
  POST_LIKED: '帖子被点赞',
  POST_COMMENTED: '帖子被评论',
  BE_FOLLOWED: '获得关注',
  MATCH_QUEUE_JUMP: '匹配插队',
  PROMOTE_POST_PER_DAY: '帖子推广',
};

const ruleDescriptions: Record<string, string> = {
  DAILY_CHECKIN: '每天登录并签到即可获得',
  DAILY_CHECKIN_INCREMENT: '连续签到每天额外增加',
  DAILY_CHECKIN_MAX: '单次签到可获得的最大值',
  POST_LIKED: '你的帖子每获得一个点赞',
  POST_COMMENTED: '你的帖子每获得一条评论',
  BE_FOLLOWED: '每增加一位新粉丝',
  MATCH_QUEUE_JUMP: '在灵魂匹配中优先被推荐',
  PROMOTE_POST_PER_DAY: '将你的帖子置顶推荐一天',
};

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
  router.push('/home');
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

async function fetchTotalPoints() {
  try {
    const response = await api.get('/points');
    totalPoints.value = response.data.points || 0;
  } catch (error) {
    console.error('获取总积分失败:', error);
  }
}

async function fetchCheckinStatus() {
  try {
    const response = await api.get('/settings/checkin/status');
    checkinStatus.checkedInToday = response.data.checkedInToday;
    checkinStatus.consecutiveDays = response.data.consecutiveDays;
  } catch (error) {
    console.error('获取签到状态失败:', error);
  }
}

async function handleCheckin() {
  if (checkinStatus.checkedInToday || checkinLoading.value) return;
  checkinLoading.value = true;
  try {
    const response = await api.post('/settings/checkin');
    showToast(`签到成功！获得 ${response.data.pointsEarned} 积分`);
    checkinStatus.checkedInToday = true;
    checkinStatus.consecutiveDays = response.data.consecutiveDays;
    // 签到成功后刷新总积分和记录
    fetchTotalPoints();
    fetchRecords();
  } catch (error: any) {
    showToast(error.response?.data?.error || '签到失败', 'error');
  } finally {
    checkinLoading.value = false;
  }
}

async function fetchRecords(loadMore = false) {
  if (recordsLoading.value) return;
  recordsLoading.value = true;
  
  if (!loadMore) {
    currentPage.value = 1;
    records.value = [];
  } else {
    currentPage.value++;
  }

  try {
    const response = await api.get('/points/records', {
      params: { page: currentPage.value, limit: 15 }
    });
    const newRecords = response.data.records || [];
    records.value = [...records.value, ...newRecords];
    hasMoreRecords.value = newRecords.length === 15;
  } catch (error) {
    console.error('获取积分明细失败:', error);
  } finally {
    recordsLoading.value = false;
  }
}

async function fetchRanking() {
  rankingLoading.value = true;
  try {
    const response = await api.get('/points/ranking');
    ranking.value = response.data.ranking || [];
  } catch (error) {
    console.error('获取排行榜失败:', error);
  } finally {
    rankingLoading.value = false;
  }
}

async function fetchRules() {
  try {
    const response = await api.get('/points/rules');
    // 这里后端返回的是一个对象，我们手动拆分一下
    const allRules = response.data.rules || {};
    rules.rewards = {
      DAILY_CHECKIN: allRules.DAILY_CHECKIN,
      POST_LIKED: allRules.POST_LIKED,
      POST_COMMENTED: allRules.POST_COMMENTED,
      BE_FOLLOWED: allRules.BE_FOLLOWED,
    };
    rules.costs = {
      MATCH_QUEUE_JUMP: 2, // 示例分值
      PROMOTE_POST_PER_DAY: 100, // 示例分值
    };
  } catch (error) {
    console.error('获取规则失败:', error);
  }
}

onMounted(() => {
  fetchTotalPoints();
  fetchCheckinStatus();
  fetchRecords();
  fetchRanking();
  fetchRules();
});
</script>

<style scoped>
.glass-card {
  @apply bg-foreground/[0.03] border border-foreground/[0.08] backdrop-blur-md shadow-xl;
}
.glass-btn-primary {
  @apply bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all;
}
.glass-btn {
  @apply bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-white transition-all border border-foreground/5;
}
</style>
