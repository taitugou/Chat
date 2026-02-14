<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useCallStore } from '@/stores/call';
import { useAuthStore } from '@/stores/auth';
import CallModal from '@/components/CallModal.vue';
import MusicPlayer from '@/components/MusicPlayer/MusicPlayer.vue';
import { getImageUrl } from '@/utils/imageUrl';

const callStore = useCallStore();
const authStore = useAuthStore();

const showMusicPlayer = computed(() => authStore.isAuthenticated);

onMounted(() => {
  callStore.initGlobalListener();
});
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>

  <CallModal
    v-if="callStore.callStatus !== 'idle'"
    :status="callStore.callStatus"
    :call-type="callStore.callType"
    :nickname="callStore.otherUser?.nickname || 'Unknown'"
    :avatar="getImageUrl(callStore.otherUser?.avatar)"
    :local-stream="callStore.localStream"
    :remote-stream="callStore.remoteStream"
    :is-minimized="callStore.isMinimized"
    :call-duration="callStore.callDuration"
    :connection-quality="callStore.connectionQuality"
    @accept="callStore.acceptCall()"
    @reject="callStore.rejectCall()"
    @hangup="callStore.endCall()"
    @toggle-minimize="callStore.toggleMinimize()"
    @switch-camera="callStore.switchCamera()"
    @toggle-mute="callStore.toggleMute()"
  />

  <MusicPlayer v-if="showMusicPlayer" />
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
