<template>
  <div class="min-h-screen pb-20 bg-background text-foreground transition-colors duration-300">
    <TopNav title="排行榜" />

    <div class="max-w-4xl mx-auto px-4 py-6 space-y-8 pb-24">
      <!-- 排行榜切换标签 -->
      <div class="flex justify-center">
        <div class="flex p-1 glass rounded-2xl w-full max-w-md">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            @click="activeTab = tab.value"
            class="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
            :class="activeTab === tab.value ? 'glass-btn-primary' : 'text-foreground/40 hover:text-white'"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- 排行榜内容 -->
      <div class="glass-card overflow-hidden animate-in fade-in duration-500">
        <div class="p-5 border-b border-foreground/5 bg-foreground/5 flex items-center justify-between">
          <h3 class="text-xs font-black text-foreground/40 uppercase tracking-[0.2em] flex items-center gap-2">
            <span class="text-lg">{{ getTabIcon(activeTab) }}</span>
            {{ getTabTitle(activeTab) }}
          </h3>
          <button @click="refreshCurrentTab" class="w-8 h-8 rounded-full hover:bg-foreground/5 flex items-center justify-center text-foreground/20 transition-colors">
            🔄
          </button>
        </div>

        <div v-if="loading" class="flex flex-col justify-center items-center py-32 space-y-4">
          <div class="relative w-10 h-10">
            <div class="absolute inset-0 border-3 border-primary/20 rounded-full"></div>
            <div class="absolute inset-0 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <span class="text-[10px] text-foreground/30 uppercase tracking-[0.2em] font-black">Updating Ranks...</span>
        </div>

        <div v-else-if="getActiveData.length === 0" class="flex flex-col items-center justify-center py-32 text-center">
          <div class="w-16 h-16 bg-foreground/5 rounded-2xl flex items-center justify-center text-3xl mb-4 opacity-30">📊</div>
          <p class="text-foreground/30 text-xs font-black uppercase tracking-widest">No Data Available</p>
        </div>

        <div v-else class="p-2 divide-y divide-white/[0.03]">
          <div
            v-for="(user, index) in getActiveData"
            :key="user.user_id"
            class="flex items-center justify-between p-4 rounded-2xl hover:bg-foreground/5 transition-all cursor-pointer group"
            @click="goToProfile(user.username)"
          >
            <div class="flex items-center gap-4">
              <div 
                class="w-8 h-8 flex items-center justify-center rounded-lg font-black text-[10px] shadow-2xl"
                :class="[
                  index === 0 ? 'bg-yellow-500 text-white' :
                  index === 1 ? 'bg-gray-400 text-white' :
                  index === 2 ? 'bg-amber-600 text-white' :
                  'bg-foreground/5 text-foreground/20 border border-foreground/5'
                ]"
              >
                {{ index + 1 }}
              </div>
              
              <div class="relative">
                <img
                  :src="getImageUrl(user.avatar)"
                  class="w-12 h-12 rounded-xl border border-foreground/10 group-hover:border-primary/50 transition-colors object-cover"
                />
                <div v-if="index < 3" class="absolute -top-1.5 -right-1.5 text-xs">👑</div>
              </div>

              <div class="min-w-0">
                <div class="font-bold text-foreground/90 group-hover:text-primary transition-colors truncate max-w-[120px] sm:max-w-none">
                  {{ user.nickname || user.username }}
                </div>
                <div class="text-[10px] text-foreground/30 uppercase tracking-tighter">@{{ user.username }}</div>
              </div>
            </div>

            <div class="text-right">
              <div class="text-lg font-black text-primary tabular-nums tracking-tighter">{{ getRankValue(user) }}</div>
              <div class="text-[9px] text-foreground/20 uppercase tracking-[0.1em] font-bold">{{ getRankLabel() }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';

const router = useRouter();
const activeTab = ref('likes');
const loading = ref(false);
const likeRanking = ref<any[]>([]);
const pointsRanking = ref<any[]>([]);
const sponsorshipRanking = ref<any[]>([]);

const tabs = [
  { label: '获赞', value: 'likes' },
  { label: '积分', value: 'points' },
  { label: '贡献', value: 'sponsorship' }
];

const getActiveData = computed(() => {
  if (activeTab.value === 'likes') return likeRanking.value;
  if (activeTab.value === 'points') return pointsRanking.value;
  return sponsorshipRanking.value;
});

function getTabIcon(tab: string) {
  if (tab === 'likes') return '❤️';
  if (tab === 'points') return '💎';
  return '🏆';
}

function getTabTitle(tab: string) {
  if (tab === 'likes') return '点赞达人';
  if (tab === 'points') return '积分精英';
  return '贡献卓越';
}

function getRankValue(user: any) {
  if (activeTab.value === 'likes') return user.total_likes || 0;
  if (activeTab.value === 'points') return user.points || 0;
  return user.total_sponsorship || 0;
}

function getRankLabel() {
  if (activeTab.value === 'likes') return 'Total Likes';
  if (activeTab.value === 'points') return 'Points';
  return 'Contribution';
}

async function refreshCurrentTab() {
  if (activeTab.value === 'likes') await fetchLikeRanking();
  else if (activeTab.value === 'points') await fetchPointsRanking();
  else await fetchSponsorshipRanking();
}

onMounted(() => {
  fetchLikeRanking();
  fetchPointsRanking();
  fetchSponsorshipRanking();
});

async function fetchLikeRanking() {
  loading.value = true;
  try {
    const response = await api.get('/user/likes/ranking');
    likeRanking.value = response.data.ranking || [];
  } catch (error) {} finally { loading.value = false; }
}

async function fetchPointsRanking() {
  try {
    const response = await api.get('/points/ranking');
    pointsRanking.value = response.data.ranking || [];
  } catch (error) {}
}

async function fetchSponsorshipRanking() {
  try {
    const response = await api.get('/user/sponsorship/ranking');
    sponsorshipRanking.value = response.data.ranking || [];
  } catch (error) {}
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>


