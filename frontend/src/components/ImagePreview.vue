<template>
  <Transition name="fade">
    <div v-if="modelValue" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-xl" @click="close">
      <!-- Top Action Bar -->
      <div class="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
        <button @click="close" class="w-10 h-10 rounded-full glass-btn flex items-center justify-center active:scale-90 transition-all">
          <span class="text-xl">✕</span>
        </button>
        
        <div v-if="showLike" class="flex items-center gap-4">
          <button 
            @click.stop="$emit('like')" 
            class="flex items-center gap-2 glass-badge px-4 py-2 rounded-full active:scale-90 transition-all"
            :class="{ 'text-red-500 bg-red-500/10': isLiked }"
          >
            <span class="text-xl">{{ isLiked ? '❤️' : '🤍' }}</span>
            <span class="font-black text-sm">{{ likeCount || 0 }}</span>
          </button>
        </div>
      </div>

      <!-- Image Container -->
      <div class="relative w-full h-full flex items-center justify-center p-4">
        <img 
          :src="imageUrl" 
          class="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in duration-300"
          @click.stop
        />
      </div>

      <!-- Bottom Helper -->
      <div class="absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
        Click background to close
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  imageUrl: string;
  showLike?: boolean;
  isLiked?: boolean;
  likeCount?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'like': [];
}>();

function close() {
  emit('update:modelValue', false);
}

// Prevent body scroll when open
watch(() => props.modelValue, (val) => {
  if (val) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@keyframes zoom-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-in.zoom-in {
  animation: zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
