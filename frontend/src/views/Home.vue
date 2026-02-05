<template>
  <div class="min-h-screen pb-20 bg-black">
    <TopNav title="话题广场" />

    <div class="max-w-7xl mx-auto px-4 py-6 space-y-8 pb-24">
      <!-- 顶部操作区 -->
      <div class="flex flex-col sm:flex-row items-center gap-4">
        <button 
          @click="showTopicModal = true"
          class="w-full glass-btn-primary py-4 px-6 rounded-2xl shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all group"
        >
          <span class="text-2xl group-hover:rotate-12 transition-transform">✍️</span>
          <span class="font-black text-sm uppercase tracking-widest">发布新话题</span>
        </button>
      </div>

      <!-- 话题分类标签 -->
      <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button 
          v-for="tab in tabs"
          :key="tab.id"
          @click="setActiveTab(tab.id)"
          class="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all flex-shrink-0 active:scale-95"
          :class="[
            activeTab === tab.id ? 'glass-btn-primary' : 'glass text-white/40 hover:text-white border border-white/5'
          ]"
        >
          {{ tab.name }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="py-24 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-6"></div>
        <p class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Curating topics...</p>
      </div>

      <!-- 话题列表 -->
      <div v-else-if="topics.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-700">
        <div
          v-for="topic in topics"
          :key="topic.id"
          class="glass-card overflow-hidden group cursor-pointer active:scale-[0.99] transition-all border border-white/5 hover:border-primary/30"
          @click="goToTopicDetail(topic.id)"
        >
          <!-- 话题封面 -->
          <div v-if="topic.cover_image" class="relative h-48 overflow-hidden" @click.stop="previewImage(getImageUrl(topic.cover_image), topic)">
            <img
              :src="getImageUrl(topic.cover_image)"
              class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            
            <div class="absolute top-3 left-3 flex gap-2">
              <div v-if="topic.is_top" class="glass-badge px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-yellow-500 text-black">TOP</div>
              <div v-if="topic.is_hot" class="glass-badge px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-red-500 text-white">HOT</div>
            </div>
          </div>
          <div v-else class="h-2 bg-gradient-to-r from-primary/20 to-purple-600/20"></div>
          
          <!-- 话题内容 -->
          <div class="p-5 space-y-4">
            <div class="space-y-2">
              <h3 class="font-black text-white/90 group-hover:text-primary transition-colors line-clamp-2 tracking-tight leading-tight">{{ topic.title }}</h3>
              <p v-if="topic.description" class="text-white/40 text-xs line-clamp-2 leading-relaxed italic" v-html="formatPostContent(topic.description)"></p>
            </div>
            
            <!-- 话题标签 -->
            <div v-if="topic.tags?.length" class="flex flex-wrap gap-1.5">
              <span
                v-for="(tag, index) in topic.tags.slice(0, 3)"
                :key="index"
                class="px-2 py-1 glass rounded-md text-[9px] font-bold text-white/30 uppercase tracking-tighter"
              >
                #{{ tag }}
              </span>
            </div>
            
            <!-- 话题底部信息 -->
            <div class="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
              <div class="flex items-center gap-2 group/user" @click.stop="goToProfile(topic.username)">
                <img
                  :src="getImageUrl(topic.avatar)"
                  class="w-6 h-6 rounded-lg object-cover border border-white/10 group-hover/user:border-primary transition-colors"
                />
                <span class="text-[10px] font-bold text-white/40 group-hover/user:text-white transition-colors truncate max-w-[80px]">
                  {{ topic.nickname }}
                </span>
              </div>
              <div class="flex items-center gap-4 text-[10px] font-black text-white/30 uppercase tracking-widest">
                <span class="flex items-center gap-1.5">
                  <span class="text-xs">💬</span> {{ topic.post_count || 0 }}
                </span>
                <button 
                  @click.stop="toggleTopicLike(topic)"
                  class="flex items-center gap-1.5 hover:text-red-500 transition-colors active:scale-90"
                  :class="{ 'text-red-500': topic.isLiked }"
                >
                  <span class="text-xs">{{ topic.isLiked ? '❤️' : '🤍' }}</span>
                  {{ topic.like_count || 0 }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="py-24 text-center glass-card">
        <div class="text-6xl mb-6 opacity-20">📭</div>
        <h3 class="text-xl font-bold text-white mb-2">暂无话题</h3>
        <p class="text-white/40 text-sm mb-8">快来开启第一个讨论吧</p>
      </div>
    </div>

    <!-- 发布话题模态框 (iOS Slide-up Style) -->
    <Transition name="slide-up">
      <div v-if="showTopicModal" class="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showTopicModal = false">
        <div class="w-full max-w-2xl glass-modal rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-500 flex flex-col max-h-[90vh]">
          <div class="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 class="text-base font-bold text-white">发布新话题</h2>
            <button @click="showTopicModal = false" class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-white/40 active:scale-90 transition-all">✕</button>
          </div>
          
          <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">话题标题</label>
              <input
                v-model="topicTitle"
                type="text"
                placeholder="吸引人的标题..."
                class="glass-input w-full py-4 px-5 rounded-2xl"
                maxlength="200"
              />
              <p class="text-[9px] text-right text-white/10 uppercase tracking-widest">{{ topicTitle.length }}/200</p>
            </div>
            
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">话题背景/描述</label>
              <MentionInput
                v-model="topicDescription"
                placeholder="详细介绍一下这个话题..."
                :rows="4"
                :max-length="500"
                class="rounded-2xl"
              />
            </div>
            
            <div class="space-y-4">
              <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">话题封面</label>
              <div 
                class="relative w-full aspect-video glass rounded-2xl overflow-hidden border border-white/10 shadow-inner group cursor-pointer flex flex-col items-center justify-center"
                @click="coverInput?.click()"
              >
                <img
                  v-if="coverPreview"
                  :src="coverPreview"
                  class="w-full h-full object-cover transition-all group-hover:scale-105"
                />
                <template v-else>
                  <span class="text-4xl mb-2 opacity-20">🖼️</span>
                  <span class="text-[10px] font-black text-white/20 uppercase tracking-widest">点击上传封面图</span>
                </template>
                
                <div v-if="coverPreview" class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                  <span class="text-xs font-black text-white uppercase tracking-widest">更换图片</span>
                </div>
              </div>
              <input ref="coverInput" type="file" accept="image/*" class="hidden" @change="handleCoverSelect" />
              <button v-if="coverPreview" @click="removeCover" class="w-full py-2 text-[10px] font-black text-red-400/40 uppercase tracking-widest hover:text-red-400 transition-colors">移除封面</button>
            </div>
            
            <div class="flex items-center gap-3 p-4 glass rounded-2xl border border-white/5">
              <div class="relative w-10 h-6 cursor-pointer" @click="isTopicAnonymous = !isTopicAnonymous">
                <div class="absolute inset-0 rounded-full transition-colors duration-300" :class="isTopicAnonymous ? 'bg-primary' : 'bg-white/10'"></div>
                <div class="absolute top-1 left-1 w-4 h-4 bg-white/80 rounded-full transition-transform duration-300" :style="{ transform: isTopicAnonymous ? 'translateX(16px)' : 'translateX(0)' }"></div>
              </div>
              <div>
                <span class="block text-xs font-bold text-white/80">匿名发布</span>
                <span class="block text-[9px] text-white/20 uppercase tracking-tighter">开启后将以匿名身份发布此话题</span>
              </div>
            </div>
          </div>
          
          <div class="p-6 bg-white/5 border-t border-white/5">
            <button
              @click="submitTopic"
              class="w-full glass-btn-primary py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-30"
              :disabled="!topicTitle.trim() || submitting"
            >
              {{ submitting ? 'PUBLISHING...' : 'PUBLISH TOPIC' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <BottomNav />
    <ImagePreview 
      v-model="showImagePreview" 
      :image-url="previewImageUrl"
      :show-like="!!previewingTopic"
      :is-liked="previewingTopic?.isLiked"
      :like-count="previewingTopic?.like_count"
      @like="previewingTopic && toggleTopicLike(previewingTopic)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';
import { formatPostContent } from '@/utils/contentRenderer';
import MentionInput from '@/components/MentionInput.vue';
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';
import ImagePreview from '@/components/ImagePreview.vue';

const router = useRouter();
const authStore = useAuthStore();

const topics = ref<any[]>([]);
const loading = ref(false);
const activeTab = ref('all');

const tabs = [
  { id: 'all', name: '全 部' },
  { id: 'latest', name: '最 新' },
  { id: 'hot', name: '最 热' },
  { id: 'follow', name: '关 注' },
];

const showTopicModal = ref(false);
const topicTitle = ref('');
const topicDescription = ref('');
const coverInput = ref<HTMLInputElement | null>(null);
const coverPreview = ref('');
const submitting = ref(false);
const isTopicAnonymous = ref(false);

const showImagePreview = ref(false);
const previewImageUrl = ref('');
const previewingTopic = ref<any>(null);

function previewImage(url: string, topic?: any) {
  previewImageUrl.value = url;
  previewingTopic.value = topic || null;
  showImagePreview.value = true;
}

function setActiveTab(tabId: string) {
  if (tabId === 'follow' && !authStore.user) {
    alert('请先登录后查看关注话题');
    return;
  }
  activeTab.value = tabId;
  fetchTopics();
}

async function fetchTopics() {
  loading.value = true;
  try {
    const params: any = {};
    if (activeTab.value === 'latest') params.sort = 'latest';
    else if (activeTab.value === 'hot') params.sort = 'hot';
    else if (activeTab.value === 'follow') params.sort = 'follow';
    
    const response = await api.get('/topics', { params });
    topics.value = response.data.topics || [];
  } catch (error: any) {
    console.error('获取话题失败:', error);
    topics.value = [];
  } finally {
    loading.value = false;
  }
}

function goToTopicDetail(topicId: number) {
  router.push(`/topic/${topicId}`);
}

async function submitTopic() {
  if (!topicTitle.value.trim()) {
    alert('请输入话题标题');
    return;
  }

  submitting.value = true;
  try {
    const formData = new FormData();
    formData.append('title', topicTitle.value);
    formData.append('description', topicDescription.value);
    formData.append('is_anonymous', isTopicAnonymous.value ? '1' : '0');

    if (coverInput.value?.files && coverInput.value.files.length > 0) {
      formData.append('cover', coverInput.value.files[0]);
    }

    await api.post('/topics', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    alert('发布成功');
    topicTitle.value = '';
    topicDescription.value = '';
    coverPreview.value = '';
    isTopicAnonymous.value = false;
    showTopicModal.value = false;
    await fetchTopics();
  } catch (error: any) {
    alert(error.response?.data?.message || '发布失败');
  } finally {
    submitting.value = false;
  }
}

function handleCoverSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = (e) => { coverPreview.value = e.target?.result as string; };
  reader.readAsDataURL(file);
}

function removeCover() {
  coverPreview.value = '';
  if (coverInput.value) coverInput.value.value = '';
}

async function toggleTopicLike(topic: any) {
  try {
    const response = await api.post(`/topics/${topic.id}/like`);
    topic.isLiked = response.data.liked;
    topic.like_count = response.data.liked 
      ? (topic.like_count || 0) + 1 
      : Math.max(0, (topic.like_count || 0) - 1);
  } catch (error: any) {}
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}

onMounted(() => {
  fetchTopics();
});
</script>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>
