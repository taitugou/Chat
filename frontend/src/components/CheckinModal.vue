<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" @click.self="$emit('close')">
    <div class="glass-modal w-full max-w-sm max-h-[90vh] overflow-y-auto custom-scrollbar animate-modal-enter">
      <div class="p-8 text-center">
        <div class="mb-6 flex justify-center">
          <div class="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-bounce-soft">
            <span class="text-4xl">💰</span>
          </div>
        </div>

        <h3 class="text-2xl font-bold text-white mb-2">每日签到</h3>
        <p class="text-white/60 mb-8">每天登录即可领取随机筹码奖励，连续签到奖励更丰厚！</p>

        <div class="space-y-4">
          <button 
            @click="$emit('checkin')" 
            class="glass-btn-primary w-full py-4 text-lg"
          >
            立即领取
          </button>
          <button 
            @click="$emit('close')" 
            class="glass-btn w-full py-3 text-white/40"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'close'): void;
  (e: 'checkin'): void;
}>();
</script>

<style scoped>
.glass-modal {
  max-width: 90vw;
}
</style>
