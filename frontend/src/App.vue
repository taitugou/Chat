<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>

  <!-- Global Call Modal -->
  <CallModal
    v-if="callStore.callStatus !== 'idle'"
    :status="callStore.callStatus"
    :call-type="callStore.callType"
    :nickname="callStore.otherUser?.nickname || 'Unknown'"
    :avatar="getImageUrl(callStore.otherUser?.avatar)"
    :local-stream="callStore.localStream"
    :remote-stream="callStore.remoteStream"
    :is-minimized="callStore.isMinimized"
    @accept="callStore.acceptCall()"
    @reject="callStore.rejectCall()"
    @hangup="callStore.endCall()"
    @toggle-minimize="callStore.toggleMinimize()"
    @switch-camera="callStore.switchCamera()"
  />
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useCallStore } from '@/stores/call';
import { getImageUrl } from '@/utils/imageUrl';
import CallModal from '@/components/CallModal.vue';
import { socket } from '@/utils/socket';

const authStore = useAuthStore();
const callStore = useCallStore();

// Watch for authentication to initialize global listeners
watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated && socket) {
      callStore.initGlobalListener();
  }
}, { immediate: true });

</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Ensure the app takes full height and handles overflow correctly */
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
