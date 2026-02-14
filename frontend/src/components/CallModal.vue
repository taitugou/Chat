<template>
  <Teleport to="body">
    <Transition name="call-fade">
      <div v-if="status !== 'idle'" class="call-container" :class="containerClass">
        <div class="call-background" :style="backgroundStyle">
          <div v-if="isVideoCall && showRemoteVideo" class="video-background">
            <video ref="remoteVideo" autoplay playsinline class="remote-video" :class="{ 'video-hidden': isMinimized }"></video>
            <div class="video-overlay"></div>
          </div>
          <div v-else class="avatar-background">
            <div class="avatar-glow"></div>
            <img :src="avatar" alt="" class="bg-avatar" />
          </div>
        </div>

        <div v-if="isMinimized" class="minimized-window" @click="expandWindow">
          <div class="minimized-content">
            <div class="minimized-avatar">
              <img :src="avatar" alt="" />
              <div v-if="status === 'connected'" class="call-indicator connected"></div>
              <div v-else-if="status === 'reconnecting'" class="call-indicator reconnecting"></div>
            </div>
            <div class="minimized-info">
              <span class="minimized-name">{{ nickname }}</span>
              <span class="minimized-status">{{ minimizedStatusText }}</span>
            </div>
            <button class="minimized-hangup" @click.stop="emit('hangup')">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-else class="call-main">
          <div v-if="status === 'incoming'" class="incoming-view">
            <div class="incoming-header">
              <span class="incoming-type">{{ callTypeText }}</span>
            </div>
            
            <div class="incoming-avatar-container">
              <div class="incoming-avatar-ring"></div>
              <img :src="avatar" alt="" class="incoming-avatar" />
            </div>
            
            <div class="incoming-info">
              <h2 class="incoming-name">{{ nickname }}</h2>
              <p class="incoming-status">邀请你进行{{ callTypeText }}</p>
            </div>

            <div class="incoming-actions">
              <button class="action-btn reject" @click="emit('reject')">
                <div class="action-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                  </svg>
                </div>
                <span>拒绝</span>
              </button>
              
              <button class="action-btn accept" @click="emit('accept')">
                <div class="action-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                  </svg>
                </div>
                <span>接听</span>
              </button>
            </div>
          </div>

          <div v-else class="active-call-view">
            <div class="call-header">
              <div class="header-info">
                <h2 class="caller-name">{{ nickname }}</h2>
                <p class="call-status-text">
                  <span v-if="status === 'calling'">正在呼叫...</span>
                  <span v-else-if="status === 'connecting'">正在连接...</span>
                  <span v-else-if="status === 'reconnecting'" class="reconnecting-text">
                    <span class="reconnect-dot"></span>
                    正在重连...
                  </span>
                  <span v-else-if="status === 'connected'">{{ formattedDuration }}</span>
                </p>
              </div>
              <button v-if="status === 'connected'" class="minimize-btn" @click="emit('toggle-minimize')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            </div>

            <div v-if="isVideoCall" class="video-container">
              <video ref="localVideo" autoplay playsinline muted class="local-video" :class="{ 'local-video-expanded': localVideoExpanded }" @click="toggleLocalVideoSize"></video>
            </div>

            <div v-else class="audio-call-content">
              <div class="audio-avatar-container">
                <div class="audio-avatar-ring" :class="{ 'connected': status === 'connected' }"></div>
                <img :src="avatar" alt="" class="audio-avatar" />
              </div>
              <div v-if="status === 'connected'" class="audio-waves">
                <span v-for="i in 5" :key="i" class="wave-bar" :style="{ animationDelay: `${i * 0.1}s` }"></span>
              </div>
            </div>

            <div v-if="status === 'calling'" class="calling-actions">
              <button class="hangup-btn large" @click="emit('hangup')">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
              </button>
              <span class="cancel-text">取消</span>
            </div>

            <div v-else class="call-controls" :class="{ 'controls-hidden': controlsHidden }" @click="showControls">
              <div class="controls-row">
                <button class="control-btn" :class="{ active: isMicMuted }" @click.stop="toggleMute">
                  <div class="control-icon">
                    <svg v-if="!isMicMuted" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9L19.73 21 21 19.73 4.27 3z"/>
                    </svg>
                  </div>
                  <span>{{ isMicMuted ? '已静音' : '静音' }}</span>
                </button>

                <button v-if="isVideoCall" class="control-btn" :class="{ active: isCameraOff }" @click.stop="toggleCamera">
                  <div class="control-icon">
                    <svg v-if="!isCameraOff" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                    </svg>
                  </div>
                  <span>{{ isCameraOff ? '已关闭' : '摄像头' }}</span>
                </button>

                <button class="control-btn" :class="{ active: isSpeakerOn }" @click.stop="toggleSpeaker">
                  <div class="control-icon">
                    <svg v-if="!isSpeakerOn" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  </div>
                  <span>免提</span>
                </button>

                <button v-if="isVideoCall" class="control-btn" @click.stop="emit('switch-camera')">
                  <div class="control-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 12c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3-3 1.34-3 3zm8-8.5h-2.17l-1.86-2H11.03l-1.86 2H7c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-12c0-1.1-.9-2-2-2zm-8 12V7h8v8.5H9z"/>
                    </svg>
                  </div>
                  <span>翻转</span>
                </button>
              </div>

              <div class="controls-row hangup-row">
                <button class="hangup-btn" @click.stop="emit('hangup')">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="connectionQuality && status === 'connected'" class="quality-indicator" :class="connectionQuality.level">
              <span class="quality-dot"></span>
              <span class="quality-text">{{ qualityText }}</span>
            </div>
          </div>

          <audio v-if="remoteStream" ref="remoteAudio" autoplay></audio>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';

type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'reconnecting' | 'ended';
type CallType = 'video' | 'audio';

interface ConnectionQuality {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  rtt?: number;
  isIPv6: boolean;
  isDirect: boolean;
}

const props = defineProps<{
  status: CallStatus;
  callType: CallType;
  nickname: string;
  avatar: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMinimized: boolean;
  callDuration?: number;
  connectionQuality?: ConnectionQuality | null;
}>();

const emit = defineEmits(['accept', 'reject', 'hangup', 'toggle-minimize', 'switch-camera', 'toggle-mute']);

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const remoteAudio = ref<HTMLAudioElement | null>(null);
const isMicMuted = ref(false);
const isCameraOff = ref(false);
const isSpeakerOn = ref(false);
const controlsHidden = ref(false);
const localVideoExpanded = ref(false);
const showRemoteVideo = ref(false);
let controlsTimeout: number | null = null;
let visibilityHandler: (() => void) | null = null;

const isVideoCall = computed(() => props.callType === 'video');
const callTypeText = computed(() => props.callType === 'video' ? '视频通话' : '语音通话');

const containerClass = computed(() => ({
  'is-minimized': props.isMinimized,
  'is-incoming': props.status === 'incoming',
  'is-video': isVideoCall.value
}));

const backgroundStyle = computed(() => {
  if (isVideoCall.value && showRemoteVideo.value) {
    return {};
  }
  return {
    '--avatar-url': `url(${props.avatar})`
  };
});

const minimizedStatusText = computed(() => {
  switch (props.status) {
    case 'calling': return '呼叫中';
    case 'connecting': return '连接中';
    case 'reconnecting': return '重连中';
    case 'connected': return formattedDuration.value;
    default: return '';
  }
});

const formattedDuration = computed(() => {
  const duration = props.callDuration || 0;
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

const qualityText = computed(() => {
  if (!props.connectionQuality) return '';
  switch (props.connectionQuality.level) {
    case 'excellent': return '信号极好';
    case 'good': return '信号良好';
    case 'fair': return '信号一般';
    case 'poor': return '信号较差';
    default: return '';
  }
});

watch(() => props.status, (newStatus) => {
  if (newStatus === 'connected') {
    showRemoteVideo.value = true;
    resetControlsTimeout();
  } else if (newStatus === 'idle') {
    showRemoteVideo.value = false;
    clearControlsTimeout();
  }
}, { immediate: true });

watch(() => props.localStream, (s) => {
  const at = s?.getAudioTracks?.()[0];
  const vt = s?.getVideoTracks?.()[0];
  isMicMuted.value = !!at && at.enabled === false;
  isCameraOff.value = !!vt && vt.enabled === false;
}, { immediate: true });

watch([() => props.localStream, localVideo], ([stream, el]) => {
  if (el && stream) {
    el.srcObject = stream;
    el.play().catch(() => {});
  }
});

watch([() => props.remoteStream, remoteVideo], ([stream, el]) => {
  if (el && stream) {
    el.srcObject = stream;
    el.play().catch(() => {});
    showRemoteVideo.value = true;
  }
});

watch([() => props.remoteStream, remoteAudio], ([stream, el]) => {
  if (el && stream) {
    el.srcObject = stream;
    el.play().catch(() => {});
  }
});

function resetControlsTimeout() {
  clearControlsTimeout();
  controlsHidden.value = false;
  controlsTimeout = window.setTimeout(() => {
    if (props.status === 'connected') {
      controlsHidden.value = true;
    }
  }, 4000);
}

function clearControlsTimeout() {
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
    controlsTimeout = null;
  }
}

function showControls() {
  controlsHidden.value = false;
  resetControlsTimeout();
}

function toggleMute() {
  const s = props.localStream;
  const tracks = s?.getAudioTracks?.() || [];
  if (tracks.length === 0) return;
  const next = tracks.some((t) => t.enabled);
  tracks.forEach((t) => { t.enabled = !next; });
  isMicMuted.value = next;
  emit('toggle-mute', next);
}

function toggleCamera() {
  const s = props.localStream;
  const tracks = s?.getVideoTracks?.() || [];
  if (tracks.length === 0) return;
  const next = tracks.some((t) => t.enabled);
  tracks.forEach((t) => { t.enabled = !next; });
  isCameraOff.value = next;
}

async function toggleSpeaker() {
  const next = !isSpeakerOn.value;
  const sinkId = next ? 'default' : 'communications';
  
  const applySink = async (el: HTMLMediaElement | null) => {
    if (!el) return false;
    const anyEl = el as any;
    if (typeof anyEl.setSinkId !== 'function') return false;
    try {
      await anyEl.setSinkId(sinkId);
      return true;
    } catch {
      return false;
    }
  };
  
  await Promise.all([applySink(remoteVideo.value), applySink(remoteAudio.value)]);
  isSpeakerOn.value = next;
  resumePlayback();
}

function toggleLocalVideoSize() {
  localVideoExpanded.value = !localVideoExpanded.value;
}

function expandWindow() {
  emit('toggle-minimize');
}

function resumePlayback() {
  if (remoteVideo.value) {
    remoteVideo.value.play().catch(() => {});
  }
  if (remoteAudio.value) {
    remoteAudio.value.play().catch(() => {});
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    resumePlayback();
  }
}

onMounted(() => {
  visibilityHandler = handleVisibilityChange;
  document.addEventListener('visibilitychange', visibilityHandler);
});

onUnmounted(() => {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  clearControlsTimeout();
});
</script>

<style scoped>
.call-container {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.call-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.video-background {
  position: absolute;
  inset: 0;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-hidden {
  opacity: 0;
}

.video-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%);
}

.avatar-background {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.avatar-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%);
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 0.8; }
}

.bg-avatar {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  object-fit: cover;
  opacity: 0.3;
  filter: blur(20px);
  transform: scale(2);
}

.minimized-window {
  position: absolute;
  bottom: 80px;
  right: 16px;
  width: 260px;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.minimized-window:hover {
  transform: scale(1.02);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.minimized-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.minimized-avatar {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.minimized-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.call-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #1e1e1e;
}

.call-indicator.connected {
  background: #22c55e;
  animation: pulse 2s infinite;
}

.call-indicator.reconnecting {
  background: #eab308;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.minimized-info {
  flex: 1;
  min-width: 0;
}

.minimized-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.minimized-status {
  display: block;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

.minimized-hangup {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #ef4444;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
  flex-shrink: 0;
}

.minimized-hangup svg {
  width: 20px;
  height: 20px;
  color: #fff;
  transform: rotate(135deg);
}

.minimized-hangup:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.call-main {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.incoming-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.incoming-header {
  margin-bottom: 40px;
}

.incoming-type {
  font-size: 16px;
  color: #9ca3af;
  font-weight: 500;
}

.incoming-avatar-container {
  position: relative;
  margin-bottom: 32px;
}

.incoming-avatar-ring {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 3px solid rgba(34, 197, 94, 0.5);
  animation: ring-pulse 1.5s ease-out infinite;
}

@keyframes ring-pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}

.incoming-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid rgba(255, 255, 255, 0.2);
}

.incoming-info {
  text-align: center;
  margin-bottom: 60px;
}

.incoming-name {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.incoming-status {
  font-size: 16px;
  color: #9ca3af;
  margin: 0;
}

.incoming-actions {
  display: flex;
  gap: 60px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: none;
  border: none;
  cursor: pointer;
}

.action-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.action-icon svg {
  width: 32px;
  height: 32px;
}

.action-btn.reject .action-icon {
  background: #ef4444;
  color: #fff;
}

.action-btn.reject:hover .action-icon {
  transform: scale(1.1);
  background: #dc2626;
}

.action-btn.accept .action-icon {
  background: #22c55e;
  color: #fff;
  animation: bounce 1s infinite;
}

.action-btn.accept:hover .action-icon {
  transform: scale(1.1);
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.action-btn span {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}

.active-call-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.call-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  padding-top: max(16px, env(safe-area-inset-top));
  background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%);
  z-index: 10;
}

.header-info {
  flex: 1;
}

.caller-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.call-status-text {
  font-size: 14px;
  color: #9ca3af;
  margin: 0;
}

.reconnecting-text {
  color: #eab308;
  display: flex;
  align-items: center;
  gap: 6px;
}

.reconnect-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #eab308;
  animation: pulse 1s infinite;
}

.minimize-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.minimize-btn svg {
  width: 24px;
  height: 24px;
  color: #fff;
}

.minimize-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.video-container {
  flex: 1;
  position: relative;
}

.local-video {
  position: absolute;
  top: 80px;
  right: 16px;
  width: 100px;
  height: 140px;
  border-radius: 12px;
  object-fit: cover;
  transform: scaleX(-1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  z-index: 5;
  cursor: pointer;
}

.local-video-expanded {
  width: 180px;
  height: 252px;
}

.audio-call-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.audio-avatar-container {
  position: relative;
  margin-bottom: 40px;
}

.audio-avatar-ring {
  position: absolute;
  inset: -16px;
  border-radius: 50%;
  border: 2px solid rgba(59, 130, 246, 0.3);
  transition: all 0.3s;
}

.audio-avatar-ring.connected {
  border-color: rgba(34, 197, 94, 0.5);
  animation: ring-pulse 2s ease-out infinite;
}

.audio-avatar {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid rgba(255, 255, 255, 0.2);
}

.audio-waves {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 40px;
}

.wave-bar {
  width: 4px;
  height: 20px;
  background: var(--ios-blue);
  border-radius: 2px;
  animation: wave 1s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { height: 8px; }
  50% { height: 32px; }
}

.calling-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  gap: 16px;
}

.hangup-btn.large {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #ef4444;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

.hangup-btn.large svg {
  width: 32px;
  height: 32px;
  color: #fff;
  transform: rotate(135deg);
}

.hangup-btn.large:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.cancel-text {
  font-size: 14px;
  color: #9ca3af;
}

.call-controls {
  padding: 20px;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%);
  transition: opacity 0.3s, transform 0.3s;
}

.call-controls.controls-hidden {
  opacity: 0;
  transform: translateY(20px);
  pointer-events: none;
}

.controls-row {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 20px;
}

.controls-row:last-child {
  margin-bottom: 0;
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.control-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.15s;
}

.control-icon svg {
  width: 24px;
  height: 24px;
  color: #fff;
}

.control-btn:hover .control-icon {
  background: rgba(255, 255, 255, 0.2);
}

.control-btn:active .control-icon {
  transform: scale(0.95);
}

.control-btn.active .control-icon {
  background: #fff;
}

.control-btn.active .control-icon svg {
  color: #000;
}

.control-btn span {
  font-size: 12px;
  color: #9ca3af;
}

.control-btn.active span {
  color: #fff;
}

.hangup-row {
  margin-top: 8px;
}

.hangup-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #ef4444;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

.hangup-btn svg {
  width: 28px;
  height: 28px;
  color: #fff;
  transform: rotate(135deg);
}

.hangup-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.quality-indicator {
  position: absolute;
  top: 80px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 16px;
  font-size: 12px;
  z-index: 5;
}

.quality-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.quality-indicator.excellent .quality-dot { background: #22c55e; }
.quality-indicator.good .quality-dot { background: #3b82f6; }
.quality-indicator.fair .quality-dot { background: #eab308; }
.quality-indicator.poor .quality-dot { background: #ef4444; animation: pulse 1s infinite; }

.quality-text {
  color: #9ca3af;
}

.call-fade-enter-active,
.call-fade-leave-active {
  transition: opacity 0.3s ease;
}

.call-fade-enter-from,
.call-fade-leave-to {
  opacity: 0;
}
</style>
