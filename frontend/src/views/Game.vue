<template>
  <div class="min-h-screen pb-20 bg-black overflow-x-hidden">
    <TopNav title="游戏大厅">
      <template #extra>
        <div class="flex items-center gap-2 glass-badge px-3 py-1.5 rounded-full border border-white/10">
          <span class="text-base">💰</span>
          <span class="font-bold text-yellow-400 tracking-tight">{{ formatNumber(chips.balance) }}</span>
        </div>
      </template>
    </TopNav>

    <div class="max-w-7xl mx-auto px-4 py-6 space-y-8 pb-24">
      <!-- 快捷功能 -->
      <div class="flex items-center justify-center gap-4">
        <button 
          @click="showCheckinModal = true" 
          class="flex-1 max-w-[160px] flex flex-col items-center gap-2 glass-card p-4 active:scale-95 transition-all group"
        >
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400/20 to-emerald-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            🎁
          </div>
          <span class="text-sm font-semibold text-white/90">每日签到</span>
        </button>
        
        <button 
          @click="showLoanModal = true; fetchUserInfo()" 
          class="flex-1 max-w-[160px] flex flex-col items-center gap-2 glass-card p-4 active:scale-95 transition-all group"
        >
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-400/20 to-pink-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            💸
          </div>
          <span class="text-sm font-semibold text-white/90">紧急借贷</span>
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- 左侧：房间列表 -->
        <div class="lg:col-span-2 space-y-6">
          <div class="glass-card overflow-hidden">
            <div class="p-6 flex items-center justify-between border-b border-white/5 bg-white/5">
              <div>
                <h2 class="text-lg font-bold text-white/90">正在进行</h2>
                <p class="text-xs text-white/40">找到感兴趣的对局并加入</p>
              </div>
              <button 
                @click="showCreateRoomModal = true"
                class="glass-btn-primary px-5 py-2 rounded-full text-sm font-semibold shadow-lg active:scale-95 transition-all"
              >
                + 创建房间
              </button>
            </div>

            <div class="p-6">
              <div v-if="loadingRooms" class="flex flex-col justify-center items-center py-20 space-y-4">
                <div class="relative w-12 h-12">
                  <div class="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                  <div class="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                <span class="text-sm text-white/40">正在搜寻房间...</span>
              </div>

              <div v-else-if="rooms.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
                <div class="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-4xl mb-4">
                  🎮
                </div>
                <h3 class="text-white/80 font-semibold">暂无开放房间</h3>
                <p class="text-white/40 text-sm mt-1">您可以点击右上角创建一个</p>
              </div>

              <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  v-for="room in rooms" 
                  :key="room.id"
                  @click="joinRoom(room)"
                  class="glass-card-hover p-4 cursor-pointer group relative overflow-hidden"
                >
                  <div class="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span class="text-4xl">{{ gameEmojis[room.game_code] || '🎮' }}</span>
                  </div>
                  
                  <div class="flex flex-col h-full justify-between space-y-4">
                    <div class="flex items-start justify-between">
                      <div class="space-y-1">
                        <h3 class="text-white font-bold group-hover:text-primary transition-colors">{{ room.name }}</h3>
                        <p class="text-white/40 text-xs tracking-wide uppercase">{{ room.game_name }}</p>
                        <p class="text-white/30 text-[10px] font-mono">{{ formatDateTime(room.last_active_at) }}</p>
                      </div>
                      <div 
                        class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        :class="room.status === 'waiting' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'"
                      >
                        {{ room.status === 'waiting' ? '等待中' : '游戏中' }}
                      </div>
                    </div>
                    
                    <div class="flex items-center justify-between pt-2 border-t border-white/5">
                      <div class="flex items-center gap-3 text-white/60">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs">👤</span>
                          <span class="text-sm font-medium">{{ room.player_count }}/{{ room.max_players }}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs">🔑</span>
                          <span class="text-sm font-mono opacity-80">{{ room.room_code }}</span>
                        </div>
                      </div>
                      <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-primary group-hover:text-white transition-all">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="flex justify-center mt-8">
                <button 
                  @click="fetchRooms(true)" 
                  class="glass-btn px-8 py-3 rounded-full text-sm font-semibold active:scale-95 transition-all flex items-center gap-2"
                >
                  <span>🔄</span> 刷新房间列表
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：排行榜与统计 -->
        <div class="space-y-6">
          <!-- 我的统计 -->
          <div class="glass-card p-6">
            <h2 class="text-base font-bold text-white/90 mb-5">战绩概览</h2>
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center space-y-1">
                <p class="text-[10px] text-white/40 uppercase tracking-widest">总局数</p>
                <p class="text-xl font-bold text-white">{{ stats.total_games || 0 }}</p>
              </div>
              <div class="text-center space-y-1">
                <p class="text-[10px] text-white/40 uppercase tracking-widest">胜率</p>
                <p class="text-xl font-bold text-green-400">{{ stats.win_rate || 0 }}%</p>
              </div>
              <div class="text-center space-y-1">
                <p class="text-[10px] text-white/40 uppercase tracking-widest">最高赢取</p>
                <p class="text-xl font-bold text-yellow-400 truncate px-1">{{ formatNumber(stats.max_win || 0) }}</p>
              </div>
            </div>
          </div>

          <!-- 排行榜 -->
          <div class="glass-card overflow-hidden">
            <div class="p-5 flex items-center justify-between border-b border-white/5 bg-white/5">
              <h2 class="text-base font-bold text-white/90">排行榜</h2>
              <button @click="refreshLeaderboards(); fetchChips()" class="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-white/40 transition-colors">
                🔄
              </button>
            </div>

            <div class="p-4 space-y-4">
              <!-- 切换标签 -->
              <div class="flex p-1 glass rounded-2xl">
                <button
                  v-for="tab in leaderboardTabs"
                  :key="tab.id"
                  class="flex-1 py-2 text-xs font-medium rounded-xl transition-all active:scale-95"
                  :class="leaderboardTab === tab.id ? 'glass-btn-primary' : 'text-white/60 hover:text-white'"
                  @click="leaderboardTab = tab.id as 'chips' | 'win_rate' | 'debt' | 'earnings'"
                >
                  {{ tab.name }}
                </button>
              </div>

              <!-- 下拉筛选 -->
              <div v-if="['win_rate', 'earnings'].includes(leaderboardTab)" class="animate-in slide-in-from-top-2 duration-200">
                <GlassSelect
                  v-if="leaderboardTab === 'win_rate'"
                  v-model="winRateGameTypeId"
                  :options="gameTypeOptions"
                  class="w-full text-xs"
                />
                <GlassSelect
                  v-else
                  v-model="earningsGameTypeId"
                  :options="gameTypeOptions"
                  class="w-full text-xs"
                />
              </div>

              <!-- 排行列表 -->
              <div class="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                <div
                  v-for="(row, index) in activeLeaderboardRows.slice(0, 10)"
                  :key="row.user_id"
                  class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group"
                  @click="goToProfile(row.username)"
                >
                  <div
                    class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                    :class="[
                      index === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20' : 
                      index === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/20' :
                      index === 2 ? 'bg-amber-600/20 text-amber-500 border border-amber-600/20' :
                      'bg-white/5 text-white/40'
                    ]"
                  >
                    {{ index + 1 }}
                  </div>
                  
                  <div class="relative">
                    <img
                      :src="getImageUrl(row.avatar)"
                      class="w-9 h-9 rounded-xl object-cover border border-white/10 group-hover:border-primary/50 transition-colors"
                    />
                    <div v-if="index < 3" class="absolute -top-1 -right-1 text-[10px]">👑</div>
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-white/90 truncate group-hover:text-primary transition-colors">
                      {{ row.nickname }}
                    </div>
                    <div v-if="row.subValue" class="text-[10px] text-white/30 truncate uppercase tracking-tighter">
                      {{ row.subValue }}
                    </div>
                  </div>

                  <div class="text-right">
                    <span class="text-sm font-bold tabular-nums" :class="row.valueClass">{{ row.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗组件 -->
    <CheckinModal v-if="showCheckinModal" @close="showCheckinModal = false" @checkin="handleCheckin" />
    <LoanModal v-if="showLoanModal" :user-info="userInfo" @close="showLoanModal = false" @loan="handleLoan" />
    <CreateRoomModal v-if="showCreateRoomModal" @close="showCreateRoomModal = false" @create="handleCreateRoom" />
    <JoinRoomModal v-if="showJoinRoomModal" @close="showJoinRoomModal = false" @join="handleJoinRoom" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';
import CheckinModal from '@/components/CheckinModal.vue';
import LoanModal from '@/components/LoanModal.vue';
import CreateRoomModal from '@/components/CreateRoomModal.vue';
import JoinRoomModal from '@/components/JoinRoomModal.vue';
import GlassSelect from '@/components/GlassSelect.vue';
import TopNav from '@/components/TopNav.vue';

const router = useRouter();

const chips = ref({ balance: 0, total_earned: 0, total_spent: 0 });
const games = ref<any[]>([]);
const rooms = ref<any[]>([]);
const chipsRanking = ref<any[]>([]);
const winRateRanking = ref<any[]>([]);
const debtRanking = ref<any[]>([]);
const earningsRanking = ref<any[]>([]);
const stats = ref<any>({ total_games: 0, win_rate: 0, max_win: 0 });
const loadingRooms = ref(false);
const userInfo = ref<any>(undefined);

const leaderboardTabs = [
  { id: 'chips', name: '筹码' },
  { id: 'win_rate', name: '胜率' },
  { id: 'debt', name: '欠款' },
  { id: 'earnings', name: '赢取' }
];
const leaderboardTab = ref<'chips' | 'win_rate' | 'debt' | 'earnings'>('chips');
const winRateGameTypeId = ref(0);
const earningsGameTypeId = ref(0);

const gameTypeOptions = computed(() => {
  const base = [{ value: 0, label: '全部玩法' }];
  return base.concat((games.value || []).map((g: any) => ({ value: g.id, label: g.name })));
});

const showCheckinModal = ref(false);
const showLoanModal = ref(false);
const showCreateRoomModal = ref(false);
const showJoinRoomModal = ref(false);

const gameEmojis: Record<string, string> = {
  'texas_holdem': '🃏',
  'zhajinhua': '🎴',
  'doudizhu': '🃏',
  'shengji': '🃏',
  'paodekuai': '🃏',
  'blackjack': '🃏',
  'sichuan_mahjong': '🀄',
  'guangdong_mahjong': '🀄',
  'guobiao_mahjong': '🀄',
  'ren_mahjong': '🀄',
  'xiangqi': '♟️',
  'weiqi': '⚫',
  'wuziqi': '⚫',
  'international_chess': '♟️',
  'junqi': '🎖️',
  'niuniu': '🎴',
  'erbaban': '🎲',
  'touzi_bao': '🎲'
};

function formatNumber(num: number) {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿';
  } else if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toString();
}

function formatDateTime(value: any) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}

async function fetchChips() {
  try {
    const response = await api.get('/chips');
    chips.value = response.data.chips;
  } catch (error) {
    console.error('获取筹码失败:', error);
  }
}

async function fetchUserInfo() {
  try {
    const [userRes, chipsRes, loanRes] = await Promise.all([
      api.get('/auth/me'),
      api.get('/chips'),
      api.get('/loans/summary').catch(() => ({ data: {} }))
    ]);

    userInfo.value = {
      ...userRes.data.user,
      follower_count: userRes.data.stats?.follower_count || 0,
      chips: chipsRes.data.chips?.balance || 0,
      debt: loanRes.data?.total_remaining_repayment || 0,
      total_active_amount: loanRes.data?.total_active_amount || 0
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
}

const activeLeaderboardRows = computed(() => {
  const makeRow = (row: any, value: string, valueClass: string, subValue: string | null = null) => ({
    user_id: row.user_id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    value,
    valueClass,
    subValue
  });

  if (leaderboardTab.value === 'chips') {
    return (chipsRanking.value || []).map((r) => makeRow(r, formatNumber(r.balance || 0), 'text-yellow-400'));
  }

  if (leaderboardTab.value === 'win_rate') {
    return (winRateRanking.value || []).map((r) =>
      makeRow(r, `${r.win_rate || 0}%`, 'text-green-400', `${r.total_games || 0} 局`)
    );
  }

  if (leaderboardTab.value === 'debt') {
    return (debtRanking.value || []).map((r) =>
      makeRow(r, formatNumber(r.total_debt || 0), 'text-red-400', `${r.active_loans || 0} 笔`)
    );
  }

  return (earningsRanking.value || []).map((r) =>
    makeRow(r, formatNumber(r.total_earned || 0), 'text-yellow-400', `单场最高：${formatNumber(r.max_win || 0)}`)
  );
});

async function fetchGames() {
  try {
    const response = await api.get('/games/types');
    games.value = response.data.gameTypes;
  } catch (error) {
    console.error('获取游戏类型失败:', error);
  }
}

async function fetchRooms(silent = false) {
  if (!silent && rooms.value.length === 0) {
    loadingRooms.value = true;
  }
  try {
    const response = await api.get('/rooms');
    rooms.value = response.data.rooms;
  } catch (error) {
    console.error('获取房间列表失败:', error);
  } finally {
    loadingRooms.value = false;
  }
}

async function fetchChipsRanking() {
  try {
    const response = await api.get('/chips/ranking', { params: { limit: 20 } });
    chipsRanking.value = response.data.ranking;
  } catch (error) {
    console.error('获取排行榜失败:', error);
  }
}

async function fetchWinRateRanking() {
  try {
    const params = { limit: 20 } as Record<string, any>;
    if (winRateGameTypeId.value) params.gameTypeId = winRateGameTypeId.value;
    const response = await api.get('/games/leaderboard/win-rate', { params });
    winRateRanking.value = response.data.ranking;
  } catch (error) {
    console.error('获取胜率排行榜失败:', error);
  }
}

async function fetchDebtRanking() {
  try {
    const response = await api.get('/loans/ranking/debt', { params: { limit: 20 } });
    debtRanking.value = response.data.ranking;
  } catch (error) {
    console.error('获取欠款排行榜失败:', error);
  }
}

async function fetchEarningsRanking() {
  try {
    const params = { limit: 20 } as Record<string, any>;
    if (earningsGameTypeId.value) params.gameTypeId = earningsGameTypeId.value;
    const response = await api.get('/games/leaderboard/earnings', { params });
    earningsRanking.value = response.data.ranking;
  } catch (error) {
    console.error('获取赢取排行榜失败:', error);
  }
}

async function refreshLeaderboards() {
  await Promise.all([
    fetchChipsRanking(),
    fetchWinRateRanking(),
    fetchDebtRanking(),
    fetchEarningsRanking()
  ]);
}

async function fetchStats() {
  try {
    const response = await api.get('/games/statistics');
    stats.value = response.data;
  } catch (error) {
    console.error('获取统计失败:', error);
  }
}

async function handleCheckin() {
  try {
    const response = await api.post('/chips/checkin');
    if (response.data.success) {
      alert(`签到成功！获得 ${response.data.rewardChips} 筹码`);
      await fetchChips();
      showCheckinModal.value = false;
    }
  } catch (error: any) {
    alert(error.response?.data?.message || '签到失败');
  }
}

async function handleLoan(amount: number) {
  try {
    const response = await api.post('/loans', { amount, loanType: 'outside' });
    if (response.data.success) {
      alert(`借贷成功！获得 ${amount} 筹码，需归还 ${response.data.totalRepayment} 筹码`);
      await fetchChips();
      showLoanModal.value = false;
    }
  } catch (error: any) {
    alert(error.response?.data?.message || '借贷失败');
  }
}

async function handleCreateRoom(roomData: any) {
  try {
    const response = await api.post('/rooms', roomData);
    if (response.data.success) {
      showCreateRoomModal.value = false;
      router.push(`/game/room/${response.data.room.id}`);
    }
  } catch (error: any) {
    const message = error.response?.data?.message;
    if (message === '已在房间中') {
      if (confirm('您当前已在其他房间中，是否离开并创建新房间？')) {
        try {
          await api.post('/rooms/leave-all');
          const retryResponse = await api.post('/rooms', roomData);
          if (retryResponse.data.success) {
            showCreateRoomModal.value = false;
            router.push(`/game/room/${retryResponse.data.room.id}`);
            return;
          }
        } catch (retryError) {
          console.error('重试创建房间失败:', retryError);
        }
      }
    }
    alert(message || '创建房间失败');
  }
}

async function handleJoinRoom({ roomCode, password }: any) {
  try {
    const response = await api.post('/rooms/join', { roomCode, password });
    if (response.data.success) {
      router.push(`/game/room/${response.data.room.id}`);
    }
  } catch (error: any) {
    const message = error.response?.data?.message;
    if (message === '已在房间中') {
      try {
        await api.post('/rooms/leave-all');
      } catch (e) {
        console.log('自动离开房间失败，继续尝试加入');
      }
      try {
        const retryResponse = await api.post('/rooms/join', { roomCode, password });
        if (retryResponse.data.success) {
          router.push(`/game/room/${retryResponse.data.room.id}`);
          return;
        }
      } catch (retryError) {
        console.error('重试加入房间失败:', retryError);
      }
    }
    alert(message || '加入房间失败');
  }
}

function joinRoom(room: any) {
  if (room.status !== 'waiting' && room.status !== 'playing') {
    alert('该房间当前状态不允许加入');
    return;
  }
  if (room.password) {
    showJoinRoomModal.value = true;
  } else {
    handleJoinRoom({ roomCode: room.room_code, password: null });
  }
}

onMounted(() => {
  fetchChips();
  fetchUserInfo();
  fetchGames();
  fetchRooms();
  refreshLeaderboards();
  fetchStats();
  
  const roomRefreshInterval = setInterval(() => {
    fetchRooms(true);
  }, 1000);
  
  const dataRefreshInterval = setInterval(() => {
    fetchChips();
    refreshLeaderboards();
  }, 30000);
  
  onUnmounted(() => {
    clearInterval(roomRefreshInterval);
    clearInterval(dataRefreshInterval);
  });
});

watch(winRateGameTypeId, () => {
  if (leaderboardTab.value !== 'win_rate') return;
  fetchWinRateRanking();
});

watch(earningsGameTypeId, () => {
  if (leaderboardTab.value !== 'earnings') return;
  fetchEarningsRanking();
});
</script>
