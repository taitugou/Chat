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
        <div class="text-sm font-bold text-foreground/80">关注</div>
        <div class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Following</div>
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center px-6">
      <div class="glass-card w-full max-w-md p-6 text-center space-y-4">
        <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <span class="text-2xl">➕</span>
        </div>
        <div class="space-y-2">
          <h2 class="text-xl font-bold text-white">关注页面正在完善</h2>
          <p class="text-sm text-foreground/50">当前展示基础占位内容</p>
        </div>
        <button
          class="glass-btn-primary w-full py-3 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
          @click="goBackOneLevel"
        >
          返回
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  router.push('/home');
}
</script>
