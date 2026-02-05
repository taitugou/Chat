<template>
  <div class="min-h-screen pb-20 bg-background text-foreground transition-colors duration-300">
    <TopNav />
    
    <!-- 顶部搜索 -->
    <div class="glass sticky top-[64px] z-40 py-6 px-4 border-b border-foreground/5 shadow-2xl">
      <div class="max-w-5xl mx-auto flex items-center gap-4">
        <button @click="router.back()" class="w-10 h-10 rounded-full glass-btn flex items-center justify-center active:scale-90 transition-all">
          <span class="text-xl">←</span>
        </button>
        <div class="flex-1 relative group">
          <input
            v-model="searchQuery"
            @keyup.enter="performSearch(1)"
            type="text"
            placeholder="搜索用户、帖子、话题..."
            class="glass-input w-full pl-12 pr-12 py-4 rounded-2xl"
            ref="searchInput"
            autofocus
          />
          <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-foreground/20 group-focus-within:text-primary transition-colors">🔍</span>
          <button 
            v-if="searchQuery" 
            @click="clearSearch"
            class="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-foreground/40 hover:text-white transition-all"
          >
            ×
          </button>
        </div>
      </div>

      <!-- 筛选标?-->
      <div class="max-w-5xl mx-auto mt-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          v-for="filter in filters"
          :key="filter.value"
          @click="handleFilterClick(filter.value)"
          class="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex-shrink-0 active:scale-95"
          :class="[
            activeFilter === filter.value ? 'glass-btn-primary' : 'glass text-foreground/40 hover:text-white border border-foreground/5'
          ]"
        >
          {{ filter.label }}
          <span v-if="filter.count !== undefined" class="ml-1 text-[10px] opacity-60">({{ filter.count }})</span>
        </button>
      </div>
    </div>

    <div class="max-w-5xl mx-auto px-4 py-8 pb-24">
      <!-- 加载?-->
      <div v-if="isLoading" class="py-20 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-6"></div>
        <p class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">Searching the void...</p>
      </div>

      <!-- 未找到结果 -->
      <div v-else-if="hasSearched && searchResults.length === 0" class="py-20 text-center glass-card animate-in fade-in zoom-in duration-500">
        <div class="text-6xl mb-6 opacity-20">🔍</div>
        <h3 class="text-xl font-bold text-white mb-2">未找到相关结果</h3>
        <p class="text-foreground/40 text-sm">试试其他关键词或调整搜索条件</p>
      </div>

      <!-- 初始页面内容 (热门推荐) -->
      <div v-else-if="!hasSearched && !searchQuery" class="space-y-10 animate-in fade-in duration-700">
        <div v-if="trendingData.trending_posts?.length > 0">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xs font-black text-foreground/40 uppercase tracking-[0.2em] flex items-center gap-2">
              <span class="text-lg">🔥</span> 热门帖子
            </h2>
            <button @click="loadTrending" class="text-[10px] font-black text-primary uppercase tracking-widest hover:opacity-70 transition-opacity">换一批</button>
          </div>
          <div class="space-y-4">
            <div
              v-for="post in trendingData.trending_posts.slice(0, 5)"
              :key="post.id"
              class="glass-card p-5 cursor-pointer group active:scale-[0.99] transition-all"
              @click="$router.push(`/post/${post.id}`)"
            >
              <div class="flex items-start gap-4">
                <img
                  :src="getImageUrl(post.avatar)"
                  class="w-12 h-12 rounded-xl object-cover border border-foreground/10 group-hover:border-primary transition-colors"
                  @click.stop="goToProfile(post.username)"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span 
                      class="font-bold text-foreground/90 group-hover:text-primary transition-colors"
                      @click.stop="goToProfile(post.username)"
                    >{{ post.nickname }}</span>
                    <span class="text-[10px] text-foreground/20 uppercase tracking-widest">· {{ formatTime(post.created_at) }}</span>
                  </div>
                  <p class="text-foreground/60 line-clamp-2 text-sm leading-relaxed" v-html="formatPostContent(post.content)"></p>
                  <div class="flex items-center gap-6 mt-4 text-[10px] font-black uppercase tracking-widest text-foreground/30">
                    <span class="flex items-center gap-1.5">
                      <span class="text-sm">{{ post.isLiked ? '❤️' : '🤍' }}</span>
                      {{ post.like_count || 0 }}
                    </span>
                    <span class="flex items-center gap-1.5">
                      <span class="text-sm">💬</span>
                      {{ post.comment_count || 0 }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="trendingData.popular_tags?.length > 0">
          <h2 class="text-xs font-black text-foreground/40 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span class="text-lg">#</span> 热门话题
          </h2>
          <div class="flex flex-wrap gap-2.5">
            <button
              v-for="tag in trendingData.popular_tags.slice(0, 15)"
              :key="tag.tag"
              @click="searchByTag(tag.tag)"
              class="px-4 py-2 rounded-xl glass text-xs font-bold text-foreground/60 hover:text-white hover:bg-foreground/10 border border-foreground/5 active:scale-95 transition-all"
            >
              #{{ tag.tag }}
              <span class="text-[10px] text-foreground/20 ml-1.5 tabular-nums">{{ tag.count }}</span>
            </button>
          </div>
        </div>

        <div v-if="trendingData.popular_users?.length > 0">
          <h2 class="text-xs font-black text-foreground/40 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span class="text-lg">👥</span> 活跃用户
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="user in trendingData.popular_users.slice(0, 6)"
              :key="user.id"
              class="glass-card p-4 cursor-pointer group active:scale-[0.98] transition-all"
              @click.stop="goToProfile(user.username)"
            >
              <div class="flex items-center gap-3">
                <div class="relative">
                  <img
                    :src="getImageUrl(user.avatar)"
                    class="w-12 h-12 rounded-xl object-cover border border-foreground/10 group-hover:border-primary transition-colors"
                  />
                  <div
                    class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black"
                    :class="{
                      'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]': user.online_status === 'online',
                      'bg-foreground/10': !user.online_status || user.online_status === 'offline'
                    }"
                  ></div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-foreground/90 truncate group-hover:text-primary transition-colors text-sm">{{ user.nickname }}</div>
                  <div class="text-[10px] text-foreground/30 uppercase tracking-widest font-black">{{ user.post_count }} Posts</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 搜索结果列表 -->
      <div v-else class="animate-in fade-in duration-500">
        <div class="flex items-center justify-between mb-8 px-1">
          <p class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">
            Found <span class="text-foreground/80 tabular-nums">{{ totalResults }}</span> Results
            <span v-if="searchTime" class="ml-2 text-foreground/10">({{ searchTime }}ms)</span>
          </p>
          <div class="relative">
            <select
              v-model="sortBy"
              class="text-[10px] font-black uppercase tracking-widest bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 outline-none focus:border-primary text-foreground/60 appearance-none pr-8 cursor-pointer"
            >
              <option value="relevance">相关性</option>
              <option value="latest">最新发布</option>
              <option value="hot">最热门</option>
            </select>
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/20 pointer-events-none text-[8px]">▼</span>
          </div>
        </div>

        <div v-if="searchResults.length > 0" class="space-y-4">
          <template v-for="result in searchResults" :key="result.type + '_' + result.id">
            <!-- 用户结果 -->
            <div v-if="result.type === 'user'" class="glass-card p-5 active:scale-[0.99] transition-all">
              <div class="flex items-center gap-5 cursor-pointer group" @click.stop="goToProfile(result.username)">
                <div class="relative">
                  <img
                    :src="getImageUrl(result.avatar)"
                    class="w-16 h-16 rounded-2xl object-cover border border-foreground/10 group-hover:border-primary transition-colors shadow-xl"
                  />
                  <div
                    class="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-black"
                    :class="{
                      'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]': result.online_status === 'online',
                      'bg-foreground/10': !result.online_status || result.online_status === 'offline'
                    }"
                  ></div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3">
                    <span class="font-black text-foreground/90 group-hover:text-primary transition-colors tracking-tight">{{ result.nickname }}</span>
                    <span
                      v-if="result.online_status === 'online'"
                      class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-green-500/10 text-green-400 rounded-md border border-green-500/20"
                    >Online</span>
                  </div>
                  <p class="text-sm text-foreground/50 mt-1.5 line-clamp-1 italic" v-html="formatPostContent(result.bio || '这个人很懒，什么都没写')"></p>
                  <div v-if="result.location" class="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
                    <span>📍</span> {{ result.location }}
                  </div>
                </div>
                <button @click.stop="toggleFollow(result)" class="glass-btn-primary px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all">
                  关注
                </button>
              </div>
            </div>

            <!-- 帖子结果 -->
            <div v-else-if="result.type === 'post'" class="glass-card overflow-hidden active:scale-[0.99] transition-all">
              <div class="p-5 cursor-pointer group" @click="$router.push(`/post/${result.id}`)">
                <div class="flex items-start gap-4 mb-4">
                  <img
                    :src="getImageUrl(result.user?.avatar)"
                    class="w-12 h-12 rounded-xl object-cover border border-foreground/10 group-hover:border-primary transition-colors"
                    @click.stop="goToProfile(result.user?.username)"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span 
                          class="font-bold text-foreground/90 group-hover:text-primary transition-colors"
                          @click.stop="goToProfile(result.user?.username)"
                        >{{ result.user?.nickname }}</span>
                        <span class="text-[10px] text-foreground/20 uppercase tracking-widest font-black">· {{ formatTime(result.created_at) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="space-y-4">
                  <p class="text-foreground/80 text-sm sm:text-base leading-relaxed" v-html="formatPostContent(result.content)"></p>

                  <!-- 图片网格 -->
                  <div v-if="result.images?.length > 0" class="rounded-2xl overflow-hidden border border-foreground/5">
                    <div class="grid grid-cols-3 gap-1">
                      <img
                        v-for="(img, idx) in result.images.slice(0, 3)"
                        :key="idx"
                        :src="getImageUrl(img)"
                        class="w-full aspect-square object-cover hover:opacity-90 transition-opacity cursor-pointer"
                        @click.stop="previewImage(result.images, idx)"
                      />
                    </div>
                    <div v-if="result.images.length > 3" class="bg-foreground/5 py-2 text-[10px] text-foreground/30 font-black uppercase tracking-widest text-center border-t border-foreground/5">
                      + {{ result.images.length - 3 }} More Images
                    </div>
                  </div>

                  <!-- 文件链接 -->
                  <div v-if="result.file_url" class="mt-2">
                    <a 
                      :href="getImageUrl(result.file_url)" 
                      :download="result.file_url.split('/').pop().split('_').slice(2).join('_') || 'download'"
                      class="flex items-center gap-3 glass p-3 rounded-xl border border-foreground/10 hover:bg-foreground/5 transition-all group"
                      @click.stop
                    >
                      <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-[11px] font-bold text-foreground/90 truncate">{{ result.file_url.split('/').pop().split('_').slice(2).join('_') || '查看文件' }}</div>
                        <div class="text-[9px] text-foreground/30 uppercase tracking-widest font-black">Download Attachment</div>
                      </div>
                    </a>
                  </div>

                  <!-- 链接卡片 -->
                  <div v-if="result.link_info" class="mb-4">
                    <a
                      :href="result.link_info.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block glass border border-foreground/10 rounded-2xl overflow-hidden hover:bg-foreground/5 transition-all group/link active:scale-[0.99]"
                      @click.stop
                    >
                      <div v-if="result.link_info.image_url" class="w-full h-36 overflow-hidden bg-foreground/5 border-b border-foreground/5">
                        <img :src="result.link_info.image_url" class="w-full h-full object-cover group-hover/link:scale-110 transition-transform duration-700" />
                      </div>
                      <div class="p-4">
                        <div class="text-sm font-bold text-foreground/90 line-clamp-1 group-hover/link:text-primary transition-colors">{{ result.link_info.title }}</div>
                        <div class="text-[10px] font-black uppercase tracking-tighter text-foreground/20 mt-1 truncate">{{ result.link_info.url }}</div>
                      </div>
                    </a>
                  </div>

                  <!-- 底部交互?-->
                  <div class="flex items-center justify-between pt-4 border-t border-foreground/5">
                    <div class="flex items-center gap-8 text-foreground/30 text-[10px] font-black uppercase tracking-widest">
                      <button class="flex items-center gap-2 hover:text-red-500 transition-colors active:scale-90">
                        <span class="text-base">{{ result.isLiked ? '❤️' : '🤍' }}</span>
                        {{ result.like_count || 0 }}
                      </button>
                      <button class="flex items-center gap-2 hover:text-primary transition-colors active:scale-90">
                        <span class="text-base">💬</span>
                        {{ result.comment_count || 0 }}
                      </button>
                      <button class="flex items-center gap-2 hover:text-green-500 transition-colors active:scale-90">
                        <span class="text-base">🔗</span>
                        {{ result.share_count || 0 }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 消息结果 -->
            <div v-else-if="result.type === 'message'" class="glass-card p-5 hover:bg-foreground/5 transition-all cursor-pointer active:scale-[0.99] group" @click="openChat(result)">
              <div class="flex items-center gap-4">
                <img
                  :src="getImageUrl(result.sender?.avatar)"
                  class="w-12 h-12 rounded-xl object-cover border border-foreground/10 group-hover:border-primary transition-colors"
                  @click.stop="goToProfile(result.sender?.username)"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span 
                      class="font-bold text-foreground/90 group-hover:text-primary transition-colors"
                      @click.stop="goToProfile(result.sender?.username)"
                    >{{ result.sender?.nickname }}</span>
                    <span class="text-[10px] text-foreground/20 font-black uppercase tracking-widest">{{ formatTime(result.created_at) }}</span>
                  </div>
                  <p class="text-foreground/50 truncate mt-1.5 text-sm italic" v-html="formatPostContent(result.content)"></p>
                </div>
              </div>
            </div>

            <!-- 话题结果 -->
            <div v-else-if="result.type === 'topic'" class="glass-card p-5 hover:bg-foreground/5 transition-all cursor-pointer active:scale-[0.99] group" @click="searchByTag(result.tag)">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-[1.25rem] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl group-hover:scale-110 transition-transform">
                  <span class="text-primary font-black text-xl">#</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-black text-foreground/90 group-hover:text-primary transition-colors text-lg tracking-tight">#{{ result.tag }}</div>
                  <div class="text-[10px] text-foreground/30 font-black uppercase tracking-[0.2em] mt-1">{{ result.usage_count || 0 }} Mentions</div>
                </div>
                <div class="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/20 group-hover:bg-primary group-hover:text-white transition-all">
                  <span class="text-xl">→</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 加载更多按钮 -->
        <div v-if="hasMore" class="py-12 text-center">
          <button
            @click="loadMore"
            :disabled="isLoadingMore"
            class="glass-btn px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all disabled:opacity-20"
          >
            {{ isLoadingMore ? 'Searching...' : 'Load More' }}
          </button>
        </div>
      </div>

      <!-- 图片预览模态框 -->
      <transition name="fade">
        <div
          v-if="previewImageVisible"
          class="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center"
          @click="previewImageVisible = false"
        >
          <button class="absolute top-6 right-6 w-12 h-12 rounded-full glass-btn flex items-center justify-center text-white active:scale-90 transition-all z-20">
            <span class="text-2xl leading-none">×</span>
          </button>
          
          <button
            v-if="previewImages.length > 1"
            @click.stop="prevImage"
            class="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full glass-btn flex items-center justify-center text-white active:scale-90 transition-all z-20"
          >
            <span class="text-4xl leading-none pr-1">‹</span>
          </button>
          
          <img
            :src="getImageUrl(previewImages[previewImageIndex])"
            class="max-w-[95vw] max-h-[95vh] object-contain shadow-[0_50px_100px_rgba(0,0,0,0.8)] animate-in zoom-in duration-300"
            @click.stop
          />
          
          <button
            v-if="previewImages.length > 1"
            @click.stop="nextImage"
            class="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full glass-btn flex items-center justify-center text-white active:scale-90 transition-all z-20"
          >
            <span class="text-4xl leading-none pl-1">›</span>
          </button>
          
          <div v-if="previewImages.length > 1" class="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-2.5 glass-badge rounded-full text-white text-[10px] font-black uppercase tracking-widest border border-foreground/10">
            {{ previewImageIndex + 1 }} / {{ previewImages.length }}
          </div>
        </div>
      </transition>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getSocket } from '@/utils/socket';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';
import { formatPostContent } from '@/utils/contentRenderer';
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';

const router = useRouter();

// 关注/取消关注逻辑
const isLoadingFollow = ref(false);
async function toggleFollow(user: any) {
  if (isLoadingFollow.value) return;
  isLoadingFollow.value = true;
  try {
    await api.post(`/friends/follow/${user.id}`);
  } catch (error) {
    console.error('关注操作失败:', error);
  } finally {
    isLoadingFollow.value = false;
  }
}

interface SearchResult {
  type: string;
  id: number;
  [key: string]: any;
}

interface TrendingData {
  trending_posts: any[];
  popular_tags: any[];
  popular_users: any[];
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}

const searchQuery = ref('');
const activeFilter = ref('all');
const sortBy = ref('relevance');
const searchResults = ref<SearchResult[]>([]);
const suggestions = ref<string[]>([]);
const showSuggestions = ref(false);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const hasSearched = ref(false);
const hasMore = ref(false);
const currentPage = ref(1);
const totalResults = ref(0);
const searchTime = ref(0);
const trendingData = ref<TrendingData>({
  trending_posts: [],
  popular_tags: [],
  popular_users: []
});
const searchInput = ref<HTMLInputElement | null>(null);

const previewImageVisible = ref(false);
const previewImages = ref<string[]>([]);
const previewImageIndex = ref(0);

const filters = [
  { label: '全部', value: 'all', count: undefined },
  { label: '用户', value: 'users', count: undefined },
  { label: '帖子', value: 'posts', count: undefined },
  { label: '话题', value: 'topics', count: undefined }
];


onMounted(async () => {
  await loadTrending();
  
  const socket = getSocket();
  if (socket) {
    socket.on('user:status_change', (data: { userId: number, status: string }) => {
      // 更新搜索结果列表
      searchResults.value = searchResults.value.map(item => {
        if (item.type === 'user' && item.id === data.userId) {
          return { ...item, online_status: data.status };
        }
        return item;
      });

      // 更新热门用户
      if (trendingData.value.popular_users) {
        trendingData.value.popular_users = trendingData.value.popular_users.map(u => {
          if (u.id === data.userId) {
            return { ...u, online_status: data.status };
          }
          return u;
        });
      }
    });
  }
});

async function loadTrending() {
  try {
    const response = await api.get('/search/trending', { params: { limit: 10 } });
    trendingData.value = response.data;
  } catch (error) {
    console.error('加载热门内容失败:', error);
  }
}

async function performSearch(page: number = 1) {
  const query = searchQuery.value.trim();
  if (!query) {
    isLoading.value = false;
    return;
  }

  showSuggestions.value = false;
  isLoading.value = true;
  hasSearched.value = true;
  currentPage.value = page;

  try {
    const response = await api.get('/search', {
      params: {
        q: query,
        type: activeFilter.value,
        page,
        limit: 20,
        sort: sortBy.value
      }
    });

    if (page === 1) {
      searchResults.value = response.data.results || [];
    } else {
      searchResults.value = [...searchResults.value, ...(response.data.results || [])];
    }

    totalResults.value = response.data.total_results || 0;
    searchTime.value = response.data.took || 0;
    hasMore.value = response.data.pagination?.has_more || false;
  } catch (error) {
    console.error('搜索失败:', error);
    searchResults.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return;
  isLoadingMore.value = true;
  const nextPage = currentPage.value + 1;
  try {
    const response = await api.get('/search', {
      params: {
        q: searchQuery.value.trim(),
        type: activeFilter.value,
        page: nextPage,
        limit: 20,
        sort: sortBy.value
      }
    });
    searchResults.value = [...searchResults.value, ...(response.data.results || [])];
    currentPage.value = nextPage;
    hasMore.value = response.data.pagination?.has_more || false;
  } catch (error) {
    console.error('加载更多失败:', error);
  } finally {
    isLoadingMore.value = false;
  }
}

function clearSearch() {
  searchQuery.value = '';
  searchResults.value = [];
  hasSearched.value = false;
  suggestions.value = [];
  totalResults.value = 0;
  searchTime.value = 0;
  searchInput.value?.focus();
}

function setFilter(filter: string) {
  activeFilter.value = filter;
  if (hasSearched.value && searchQuery.value.trim()) {
    performSearch(1);
  }
}

function handleFilterClick(filter: string) {
  setFilter(filter);
}

function searchByTag(tag: string) {
  searchQuery.value = tag;
  activeFilter.value = 'topics';
  performSearch();
}

function openChat(message: any) {
  if (message.sender_id) {
    router.push(`/chat/${message.sender_id}`);
  }
}

function previewImage(images: string[], index: number) {
  previewImages.value = images;
  previewImageIndex.value = index;
  previewImageVisible.value = true;
}

function prevImage() {
  previewImageIndex.value = (previewImageIndex.value - 1 + previewImages.value.length) % previewImages.value.length;
}

function nextImage() {
  previewImageIndex.value = (previewImageIndex.value + 1) % previewImages.value.length;
}

function formatTime(time: string) {
  const date = new Date(time);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

watch(activeFilter, () => {
  if (hasSearched.value) performSearch(1);
});

watch(sortBy, () => {
  if (hasSearched.value) performSearch(1);
});
</script>

<style scoped>
</style>


