<template>
  <div class="min-h-screen pb-20 bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300">
    <TopNav title="相关周边" />
    
    <div class="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div class="w-32 h-32 bg-ios-systemGray5 rounded-[2.5rem] flex items-center justify-center border border-ios-separator shadow-2xl relative group">
        <div class="absolute -inset-4 bg-ios-blue/10 rounded-[3rem] blur-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
        <span class="text-6xl relative">🎁</span>
      </div>
      
      <div class="text-center space-y-2">
        <h1 class="text-3xl font-black text-white tracking-tighter">敬请期待</h1>
        <p class="text-ios-label-tertiary text-sm font-bold uppercase tracking-[0.3em]">Coming Soon</p>
      </div>
      
      <p class="text-ios-label-tertiary text-center max-w-xs leading-relaxed text-sm">
        我们正在精心准备相关周边商品<br />感谢您的关注与支持
      </p>
      
      <button @click="$router.back()" class="ios-btn-secondary px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all mt-8">
        返回
      </button>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';
</script>
