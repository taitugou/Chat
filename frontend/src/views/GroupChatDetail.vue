<template>
  <div class="h-screen flex flex-col overflow-hidden bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300">
    <div class="ios-glass px-4 py-3 flex items-center z-50 shadow-sm border-b border-ios-separator">
      <button
        @click="goBackOneLevel"
        class="p-2 -ml-2 rounded-full text-ios-label-secondary hover:text-white hover:bg-ios-systemGray5 transition-all active:scale-90"
        title="返回上一页"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0 ml-2">
        <div class="text-sm font-bold text-ios-label-primary truncate">群聊</div>
        <div class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest truncate">Group {{ groupId }}</div>
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center px-6">
      <div class="ios-card w-full max-w-md p-6 text-center space-y-4">
        <div class="w-16 h-16 rounded-2xl bg-ios-blue/10 flex items-center justify-center mx-auto">
          <span class="text-2xl">💬</span>
        </div>
        <div class="space-y-2">
          <h2 class="text-xl font-bold text-white">群聊详情加载中</h2>
          <p class="text-sm text-ios-label-tertiary">当前版本仅展示基础占位内容</p>
        </div>
        <button
          class="ios-btn-primary w-full py-3 rounded-2xl font-bold text-sm shadow-lg shadow-ios active:scale-[0.98] transition-all"
          @click="goBackOneLevel"
        >
          返回聊天列表
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const groupId = computed(() => route.params.groupId as string);

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  router.push('/chat');
}
</script>
