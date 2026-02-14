<template>
  <div
    ref="buttonRef"
    class="music-floating-button"
    :class="{ 'snapping': isSnapping }"
    :style="buttonStyle"
    @mousedown="startDrag"
    @touchstart="startDrag"
    @click="handleClick"
  >
    <div class="button-inner" :class="{ playing: isPlaying, loading: isLoading }">
      <div v-if="isLoading" class="loading-spinner">
        <svg class="animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
        </svg>
      </div>
      <div v-else class="icon-container">
        <svg v-if="!isPlaying" class="music-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <svg v-else class="music-icon playing-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
      <div v-if="showClickHint" class="click-hint">
        {{ clickHintText }}
      </div>
    </div>
    <div v-if="isPlaying" class="sound-waves">
      <span v-for="i in 3" :key="i" class="wave-bar" :style="{ animationDelay: `${i * 0.15}s` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  isPlaying: boolean;
  isLoading: boolean;
  hasTrack: boolean;
}>();

const emit = defineEmits<{
  (e: 'togglePlay'): void;
  (e: 'next'): void;
  (e: 'showPanel'): void;
}>();

const buttonRef = ref<HTMLElement | null>(null);

const position = ref({ x: 20, y: 100 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const hasMoved = ref(false);
const clickCount = ref(0);
const showClickHint = ref(false);
const clickHintText = ref('');
const isSnapping = ref(false);
let clickTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_TIMEOUT = 10000;
const SNAP_MARGIN = 20;

const buttonStyle = computed(() => ({
  right: `${position.value.x}px`,
  bottom: `${position.value.y}px`
}));

function showHint(text: string) {
  clickHintText.value = text;
  showClickHint.value = true;
  setTimeout(() => {
    showClickHint.value = false;
  }, 1000);
}

function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    snapToEdge();
  }, IDLE_TIMEOUT);
}

function snapToEdge() {
  const windowWidth = window.innerWidth;
  const buttonSize = 56;
  const centerX = windowWidth / 2;
  
  isSnapping.value = true;
  
  if (position.value.x > centerX - buttonSize / 2) {
    position.value.x = SNAP_MARGIN;
  } else {
    position.value.x = SNAP_MARGIN;
  }
  
  setTimeout(() => {
    isSnapping.value = false;
  }, 300);
}

function startDrag(e: MouseEvent | TouchEvent) {
  e.preventDefault();
  
  resetIdleTimer();
  
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  
  isDragging.value = true;
  hasMoved.value = false;
  dragStart.value = {
    x: clientX - position.value.x,
    y: clientY - position.value.y
  };
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('touchend', endDrag);
}

function onDrag(e: MouseEvent | TouchEvent) {
  if (!isDragging.value) return;
  
  e.preventDefault();
  resetIdleTimer();
  
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  
  const newX = clientX - dragStart.value.x;
  const newY = clientY - dragStart.value.y;
  
  if (Math.abs(newX - position.value.x) > 5 || Math.abs(newY - position.value.y) > 5) {
    hasMoved.value = true;
  }
  
  const maxX = window.innerWidth - 60;
  const maxY = window.innerHeight - 120;
  
  position.value = {
    x: Math.max(0, Math.min(maxX, newX)),
    y: Math.max(60, Math.min(maxY, newY))
  };
}

function endDrag() {
  isDragging.value = false;
  
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', endDrag);
  
  resetIdleTimer();
}

function handleClick(e: MouseEvent) {
  if (hasMoved.value) return;
  
  resetIdleTimer();
  
  clickCount.value++;
  
  if (clickTimer) {
    clearTimeout(clickTimer);
  }
  
  clickTimer = setTimeout(() => {
    if (clickCount.value === 1) {
      emit('togglePlay');
      showHint(props.isPlaying ? '已暂停' : '正在播放');
    } else if (clickCount.value === 2) {
      emit('next');
      showHint('下一首');
    } else if (clickCount.value >= 3) {
      emit('showPanel');
      showHint('更多选项');
    }
    clickCount.value = 0;
    clickTimer = null;
  }, 250);
}

onMounted(() => {
  const savedPosition = localStorage.getItem('ttg:music:buttonPosition');
  if (savedPosition) {
    try {
      position.value = JSON.parse(savedPosition);
    } catch {}
  }
  resetIdleTimer();
});

onUnmounted(() => {
  localStorage.setItem('ttc:music:buttonPosition', JSON.stringify(position.value));
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
});
</script>

<style scoped>
.music-floating-button {
  position: fixed;
  z-index: 9999;
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: right 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.music-floating-button.snapping {
  transition: right 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.music-floating-button:active {
  cursor: grabbing;
}

.button-inner {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--ios-blue);
  box-shadow: 0 4px 15px rgba(0, 122, 255, 0.4),
              0 0 0 4px rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.button-inner::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
}

.button-inner:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 122, 255, 0.5),
              0 0 0 6px rgba(255, 255, 255, 0.15);
}

.button-inner:active {
  transform: scale(0.95);
}

.button-inner.playing {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(0, 122, 255, 0.4),
                0 0 0 4px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow: 0 4px 25px rgba(0, 122, 255, 0.6),
                0 0 0 8px rgba(255, 255, 255, 0.15);
  }
}

.icon-container {
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.music-icon {
  width: 24px;
  height: 24px;
}

.playing-icon {
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

.loading-spinner {
  color: white;
  width: 24px;
  height: 24px;
}

.loading-spinner svg {
  width: 100%;
  height: 100%;
}

.sound-waves {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.wave-bar {
  width: 3px;
  background: var(--ios-blue);
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% {
    height: 4px;
  }
  50% {
    height: 12px;
  }
}

.click-hint {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  white-space: nowrap;
  animation: fadeInOut 1s ease forwards;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  20% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  80% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
}
</style>
