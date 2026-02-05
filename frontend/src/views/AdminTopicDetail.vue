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
        <div class="text-sm font-bold text-foreground/80">话题详情</div>
        <div class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Admin Topic Detail</div>
      </div>
    </div>

    <main class="flex-1 overflow-y-auto p-6 space-y-6">
      <div v-if="loading" class="flex items-center justify-center h-64 text-foreground/40 italic">
        加载中...
      </div>
      <div v-else-if="!topic" class="flex flex-col items-center justify-center h-64 space-y-4">
        <div class="text-4xl">🔎</div>
        <div class="text-foreground/40 italic">未找到该话题</div>
        <button @click="goBackOneLevel" class="glass-btn-primary px-6 py-2 rounded-xl text-xs font-bold">返回</button>
      </div>
      <div v-else class="max-w-4xl mx-auto space-y-6">
        <!-- Topic Info Card -->
        <div class="glass-card p-8 space-y-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-3xl">
                #
              </div>
              <div>
                <h2 class="text-2xl font-black text-white">{{ topic.name }}</h2>
                <div class="text-xs text-foreground/40 mt-1">创建于 {{ formatDate(topic.created_at) }}</div>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">话题描述</div>
            <p class="text-foreground/80 leading-relaxed">{{ topic.description || '暂无描述' }}</p>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-foreground/5">
            <div class="space-y-1">
              <div class="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">动态数量</div>
              <div class="text-xl font-black text-white">{{ topic.post_count || 0 }}</div>
            </div>
            <div class="space-y-1">
              <div class="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">关注人数</div>
              <div class="text-xl font-black text-white">{{ topic.follower_count || 0 }}</div>
            </div>
          </div>
        </div>

        <!-- Action Area -->
        <div class="flex items-center justify-end space-x-3">
          <button 
            @click="deleteTopic" 
            class="px-6 py-3 rounded-2xl bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all active:scale-95"
          >
            🗑️ 删除该话题
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
const topic = ref<any>(null);
const loading = ref(true);

onMounted(fetchTopicDetail);

async function fetchTopicDetail() {
  const id = route.params.id;
  if (!id) return;
  
  loading.value = true;
  try {
    const res = await api.get(`/admin/topics/${id}`);
    topic.value = res.data.topic;
  } catch (error) {
    console.error('获取话题详情失败:', error);
  } finally {
    loading.value = false;
  }
}

async function deleteTopic() {
  if (!confirm('确定要删除该话题吗？此操作不可撤回。')) return;
  
  try {
    await api.delete(`/admin/topics/${topic.value.id}`, { params: { permanent: false } });
    alert('删除成功');
    goBackOneLevel();
  } catch (error) {
    console.error('删除话题失败:', error);
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
