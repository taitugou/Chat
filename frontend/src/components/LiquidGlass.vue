<template>
  <div class="fixed inset-0 z-[-1] overflow-hidden">
    <!-- Base Background Color -->
    <div class="absolute inset-0 bg-ios-systemGray6"></div>
    
    <!-- Background Image if provided -->
    <div 
      v-if="backgroundImage" 
      class="absolute inset-0 bg-cover bg-center transition-all duration-1000"
      :class="props.imageBlur ? 'blur-sm scale-110 opacity-40' : 'opacity-80'"
      :style="{ backgroundImage: `url(${backgroundImage})` }"
    ></div>
    
    <div v-if="props.showBlobs" class="absolute inset-0 overflow-hidden opacity-30">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>
    
    <div class="absolute inset-0" :class="props.overlayBlur ? 'backdrop-blur-[80px] bg-ios-black/20 dark:bg-ios-black/20' : 'bg-ios-black/10 dark:bg-ios-black/10'"></div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  backgroundImage?: string;
  imageBlur?: boolean;
  overlayBlur?: boolean;
  showBlobs?: boolean;
}>(), {
  imageBlur: true,
  overlayBlur: true,
  showBlobs: true,
});
</script>

<style scoped>
.blob {
  position: absolute;
  width: 50vw;
  height: 50vw;
  border-radius: 50%;
  filter: blur(60px);
  animation: move 20s infinite alternate;
}

.blob-1 {
  background: rgba(99, 102, 241, 0.4);
  top: -10%;
  left: -10%;
  animation-duration: 25s;
}

.blob-2 {
  background: rgba(139, 92, 246, 0.4);
  bottom: -10%;
  right: -10%;
  animation-duration: 30s;
  animation-delay: -5s;
}

.blob-3 {
  background: rgba(236, 72, 153, 0.3);
  top: 40%;
  left: 30%;
  animation-duration: 20s;
  animation-delay: -10s;
}

@keyframes move {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(10vw, 10vh) scale(1.2);
  }
}
</style>
