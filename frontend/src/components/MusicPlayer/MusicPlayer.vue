<template>
  <div class="music-player">
    <FloatingButton
      :is-playing="musicStore.isPlaying"
      :is-loading="musicStore.playState === 'loading'"
      :has-track="!!musicStore.currentTrack"
      @toggle-play="musicStore.togglePlay"
      @next="musicStore.playNext"
      @show-panel="musicStore.togglePanel"
    />

    <MusicPanel
      :visible="musicStore.showPanel"
      :current-track="musicStore.currentTrack"
      :is-playing="musicStore.isPlaying"
      :volume="musicStore.volume"
      :muted="musicStore.muted"
      :auto-play-enabled="musicStore.autoPlayEnabled"
      :room-state="musicStore.roomState"
      @close="musicStore.togglePanel"
      @toggle-play="musicStore.togglePlay"
      @prev="musicStore.playPrev"
      @next="musicStore.playNext"
      @set-volume="musicStore.setVolume"
      @toggle-mute="musicStore.toggleMute"
      @toggle-auto-play="toggleAutoPlay"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useMusicPlayerStore } from '@/stores/musicPlayer';
import { useAuthStore } from '@/stores/auth';
import FloatingButton from './FloatingButton.vue';
import MusicPanel from './MusicPanel.vue';

const musicStore = useMusicPlayerStore();
const authStore = useAuthStore();

function toggleAutoPlay() {
  musicStore.autoPlayEnabled = !musicStore.autoPlayEnabled;
  musicStore.saveSettings();
}

onMounted(() => {
  musicStore.init();
  
  if (authStore.isAuthenticated && musicStore.autoPlayEnabled) {
    setTimeout(() => {
      musicStore.autoPlayAfterLogin();
    }, 1000);
  }
});

onUnmounted(() => {
  musicStore.destroy();
});
</script>

<style scoped>
.music-player {
  position: relative;
  z-index: 9999;
}
</style>
