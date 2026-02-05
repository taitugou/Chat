<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
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
        <div class="text-sm font-bold text-foreground/80">帖子详情</div>
        <div class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Admin Post Detail</div>
      </div>
    </div>

    <main class="flex-1 overflow-y-auto p-6 space-y-6">
      <div v-if="loading" class="flex items-center justify-center h-64 text-foreground/40 italic">
        加载中...
      </div>
      <div v-else-if="!post" class="flex flex-col items-center justify-center h-64 space-y-4">
        <div class="text-4xl">🔎</div>
        <div class="text-foreground/40 italic">未找到该帖子</div>
        <button @click="goBackOneLevel" class="glass-btn-primary px-6 py-2 rounded-xl text-xs font-bold">返回</button>
      </div>
      <div v-else class="max-w-4xl mx-auto space-y-6">
        <!-- Post Content Card -->
        <div class="glass-card p-8 space-y-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold">
                {{ post.username?.charAt(0).toUpperCase() }}
              </div>
              <div>
                <div class="font-bold text-white text-lg">{{ post.nickname || post.username }}</div>
                <div class="text-xs text-foreground/40">发布于 {{ formatDate(post.created_at) }}</div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
               <span :class="['px-3 py-1 rounded-full text-xs font-bold uppercase', post.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400']">
                {{ post.status }}
              </span>
            </div>
          </div>

          <div class="text-lg text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {{ post.content }}
          </div>

          <div v-if="post.images && post.images.length > 0" class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <img v-for="(img, idx) in post.images" :key="idx" :src="img" class="w-full aspect-square object-cover rounded-2xl border border-foreground/5 hover:scale-[1.02] transition-transform cursor-pointer" />
          </div>

          <div v-if="post.file_url" class="mt-4">
            <a 
              :href="post.file_url" 
              :download="post.file_url.split('/').pop().split('_').slice(2).join('_') || 'download'"
              class="flex items-center gap-3 glass-card p-4 hover:bg-foreground/5 transition-all group"
            >
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-foreground/90 truncate">{{ post.file_url.split('/').pop().split('_').slice(2).join('_') || '查看文件' }}</div>
                <div class="text-[10px] text-foreground/30 uppercase tracking-widest font-black">Attachment File</div>
              </div>
            </a>
          </div>

          <div class="flex items-center space-x-6 pt-6 border-t border-foreground/5 text-sm text-foreground/40">
            <div class="flex items-center space-x-2">
              <span>👍</span>
              <span class="font-bold">{{ post.like_count || 0 }}</span>
            </div>
            <div class="flex items-center space-x-2">
              <span>💬</span>
              <span class="font-bold">{{ post.comment_count || 0 }}</span>
            </div>
            <div class="flex items-center space-x-2">
              <span>👁️</span>
              <span class="font-bold">{{ post.view_count || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- Action Area -->
        <div class="flex items-center justify-end space-x-3">
          <button 
            @click="deletePost" 
            class="px-6 py-3 rounded-2xl bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all active:scale-95"
          >
            🗑️ 删除该帖子
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/utils/api';

const route = useRoute();
const router = useRouter();
const post = ref<any>(null);
const loading = ref(true);

onMounted(fetchPostDetail);

async function fetchPostDetail() {
  const id = route.params.id;
  if (!id) return;
  
  loading.value = true;
  try {
    const res = await api.get(`/admin/posts/${id}`);
    post.value = res.data.post;
  } catch (error) {
    console.error('获取帖子详情失败:', error);
  } finally {
    loading.value = false;
  }
}

async function deletePost() {
  if (!confirm('确定要删除该帖子吗？此操作不可撤销。')) return;
  
  try {
    await api.delete(`/admin/posts/${post.value.id}`, { params: { permanent: false } });
    alert('删除成功');
    goBackOneLevel();
  } catch (error) {
    console.error('删除帖子失败:', error);
    alert('操作失败');
  }
}

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  router.push('/admin/enhanced');
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}
</script>

<style scoped>
.glass {
  @apply bg-background/80 backdrop-blur-xl;
}

.glass-card {
  @apply bg-foreground/[0.03] backdrop-blur-md border border-foreground/5 rounded-3xl transition-all;
}

.glass-btn-primary {
  @apply bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all;
}
</style>
