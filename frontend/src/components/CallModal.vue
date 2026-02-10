<template>
  <div v-if="status !== 'idle'" 
    :class="[
      'fixed z-[200] transition-all duration-300 ease-in-out overflow-hidden',
      isMinimized 
        ? 'bottom-4 right-4 w-64 h-auto rounded-2xl shadow-2xl border border-white/20 glass-modal' 
        : isVideoFullscreen
          ? 'inset-0 bg-black'
          : 'inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md'
    ]"
  >
    <div 
      :class="[
        'relative w-full flex flex-col',
        isMinimized ? '' : isVideoFullscreen ? 'h-full' : 'max-w-lg p-6 rounded-3xl glass-modal border border-white/10 items-center'
      ]"
    >
      <!-- Background Glow (Full Screen Only) -->
      <div v-if="!isMinimized && !isVideoFullscreen" class="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
      
      <!-- Minimized Header -->
      <div v-if="isMinimized" class="flex items-center justify-between p-3 bg-black/20 cursor-move">
         <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full" :class="status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'"></div>
            <span class="text-xs font-bold text-white truncate max-w-[100px]">{{ nickname }}</span>
         </div>
         <button @click="$emit('toggle-minimize')" class="p-1 hover:bg-white/10 rounded">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
         </button>
      </div>

      <!-- Minimize Button (Full Screen Only) -->
      <div v-else class="absolute top-4 right-4 z-20">
         <button @click="$emit('toggle-minimize')" class="p-2 glass rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
         </button>
      </div>

      <!-- Status & User Info -->
      <div v-if="!isVideoFullscreen"
        :class="[
          'relative z-10 flex flex-col items-center',
          isMinimized ? 'p-4' : 'mt-8 mb-8'
        ]"
      >
        <div 
          :class="[
            'rounded-full overflow-hidden border-4 border-white/20 shadow-2xl relative transition-all',
            isMinimized ? 'w-12 h-12 mb-2' : 'w-24 h-24 mb-4'
          ]"
        >
          <img :src="avatar" alt="User" class="w-full h-full object-cover" />
          <div v-if="status === 'connected'" class="absolute inset-0 flex items-center justify-center bg-black/40">
             <div class="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
          </div>
        </div>
        
        <template v-if="!isMinimized">
            <h3 class="text-2xl font-bold text-white mb-2">{{ nickname }}</h3>
            <p class="text-white/60 text-sm font-medium animate-pulse">{{ statusText }}</p>
        </template>
        <template v-else>
            <p class="text-white/60 text-xs font-medium">{{ statusText }}</p>
        </template>
      </div>

      <div v-else class="absolute top-0 left-0 right-0 z-20 px-6 pt-10 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-full overflow-hidden border border-white/25 bg-black/20">
            <img :src="avatar" alt="User" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0">
            <div class="text-white font-bold truncate max-w-[70vw]">{{ nickname }}</div>
            <div class="text-white/70 text-xs">{{ statusText }}</div>
          </div>
        </div>
        <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
      </div>

      <!-- Video Container -->
      <div 
        v-if="callType === 'video' && (status === 'connected' || status === 'calling')" 
        :class="[
            isVideoFullscreen ? 'absolute inset-0 z-0 bg-black overflow-hidden' : 'bg-black/50 overflow-hidden relative border border-white/10 shadow-inner',
            isMinimized ? 'w-full aspect-video rounded-none' : isVideoFullscreen ? '' : 'w-full aspect-video rounded-2xl mb-6'
        ]"
        @click="resumePlayback"
      >
        <video v-if="remoteStream" ref="remoteVideo" autoplay playsinline :muted="status !== 'connected'" class="w-full h-full object-cover"></video>
        <div v-else class="w-full h-full flex items-center justify-center text-white/40">
           <span v-if="status === 'connected'">等待对方视频...</span>
           <span v-else></span>
        </div>
        
        <div 
            v-if="!isMinimized && localStream"
            :class="[
              'absolute bg-black/60 rounded-xl overflow-hidden border border-white/20 shadow-lg',
              isVideoFullscreen ? 'top-24 right-4 w-24 h-36' : 'top-4 right-4 w-24 h-32'
            ]"
        >
          <video ref="localVideo" autoplay playsinline muted class="w-full h-full object-cover transform -scale-x-100"></video>
        </div>
      </div>

      <div v-if="callType === 'audio' && (status === 'connected' || status === 'calling')" :class="[
        'w-full flex items-center justify-center',
        isMinimized ? 'px-3 pb-2' : 'px-4 mb-6'
      ]">
        <audio v-if="remoteStream" ref="remoteAudio" autoplay></audio>
      </div>

      <!-- Controls -->
      <div 
        :class="[
            isVideoFullscreen ? 'absolute bottom-10 left-0 right-0 z-20 flex items-center justify-center gap-10' : 'relative z-10 flex items-center',
            isMinimized ? 'justify-center pb-4 pt-2' : isVideoFullscreen ? '' : 'justify-center gap-8 mb-4'
        ]"
      >
        <!-- Incoming Call Actions -->
        <template v-if="status === 'incoming'">
          <button @click="$emit('reject')" 
            :class="[
                'flex flex-col items-center gap-2 group',
                isMinimized ? 'scale-75' : ''
            ]"
          >
            <div class="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/50 group-hover:bg-red-500 group-hover:text-white transition-all duration-300 active:scale-90">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <span v-if="!isMinimized" class="text-xs text-white/60">拒绝</span>
          </button>
          
          <button @click="$emit('accept')" 
            :class="[
                'flex flex-col items-center gap-2 group ml-4',
                isMinimized ? 'scale-75' : ''
            ]"
          >
            <div class="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center border border-green-500/50 group-hover:bg-green-500 group-hover:text-white transition-all duration-300 active:scale-90 animate-bounce">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            </div>
            <span v-if="!isMinimized" class="text-xs text-white/60">接听</span>
          </button>
        </template>

        <!-- Active Call Actions -->
        <template v-else>
          <template v-if="callType === 'video'">
            <button
              @click="toggleMute"
              :class="[
                'flex flex-col items-center gap-2 group',
                isMinimized ? 'scale-75' : ''
              ]"
            >
              <div :class="[
                'w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-300 active:scale-90',
                isMicMuted ? 'bg-white/15 border-white/30 text-white' : 'bg-black/25 border-white/15 text-white/80 hover:text-white'
              ]">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-14 0"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19v2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 21h8"/></svg>
              </div>
              <span v-if="!isMinimized && !isVideoFullscreen" class="text-xs text-white/60">{{ isMicMuted ? '已静音' : '静音' }}</span>
            </button>

            <button
              @click="toggleCamera"
              :class="[
                'flex flex-col items-center gap-2 group',
                isMinimized ? 'scale-75' : ''
              ]"
            >
              <div :class="[
                'w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-300 active:scale-90',
                isCameraOff ? 'bg-white/15 border-white/30 text-white' : 'bg-black/25 border-white/15 text-white/80 hover:text-white'
              ]">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h8a3 3 0 013 3v6a3 3 0 01-3 3H4a2 2 0 01-2-2V8a2 2 0 012-2z"/></svg>
              </div>
              <span v-if="!isMinimized && !isVideoFullscreen" class="text-xs text-white/60">{{ isCameraOff ? '已关摄像头' : '关摄像头' }}</span>
            </button>

            <button
              @click="toggleSpeaker"
              :class="[
                'flex flex-col items-center gap-2 group',
                isMinimized ? 'scale-75' : ''
              ]"
            >
              <div :class="[
                'w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-300 active:scale-90',
                isSpeakerOn ? 'bg-white/15 border-white/30 text-white' : 'bg-black/25 border-white/15 text-white/80 hover:text-white'
              ]">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5l-6 4H3v6h2l6 4V5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.54 8.46a5 5 0 010 7.07"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.07 4.93a10 10 0 010 14.14"/></svg>
              </div>
              <span v-if="!isMinimized && !isVideoFullscreen" class="text-xs text-white/60">免提</span>
            </button>

            <button
              @click="emit('switch-camera')"
              :class="[
                'flex flex-col items-center gap-2 group',
                isMinimized ? 'scale-75' : ''
              ]"
            >
              <div class="w-14 h-14 rounded-full bg-black/25 text-white/80 hover:text-white flex items-center justify-center border border-white/15 transition-all duration-300 active:scale-90">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10l1 3H6l1-3z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l-2 2 2 2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 18l2-2-2-2"/></svg>
              </div>
              <span v-if="!isMinimized && !isVideoFullscreen" class="text-xs text-white/60">翻转</span>
            </button>
          </template>

          <template v-else>
            <button
              @click="toggleMute"
              :class="[
                'flex flex-col items-center gap-2 group',
                isMinimized ? 'scale-75' : ''
              ]"
            >
              <div :class="[
                'w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-300 active:scale-90',
                isMicMuted ? 'bg-white/15 border-white/30 text-white' : 'bg-black/25 border-white/15 text-white/80 hover:text-white'
              ]">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-14 0"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19v2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 21h8"/></svg>
              </div>
              <span v-if="!isMinimized && !isVideoFullscreen" class="text-xs text-white/60">{{ isMicMuted ? '已静音' : '静音' }}</span>
            </button>

            <button
              @click="toggleSpeaker"
              :class="[
                'flex flex-col items-center gap-2 group',
                isMinimized ? 'scale-75' : ''
              ]"
            >
              <div :class="[
                'w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-300 active:scale-90',
                isSpeakerOn ? 'bg-white/15 border-white/30 text-white' : 'bg-black/25 border-white/15 text-white/80 hover:text-white'
              ]">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5l-6 4H3v6h2l6 4V5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.54 8.46a5 5 0 010 7.07"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.07 4.93a10 10 0 010 14.14"/></svg>
              </div>
              <span v-if="!isMinimized && !isVideoFullscreen" class="text-xs text-white/60">免提</span>
            </button>
          </template>

          <button @click="$emit('hangup')" 
            :class="[
                'flex flex-col items-center gap-2 group',
                isMinimized ? 'scale-75' : ''
            ]"
          >
             <div class="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all duration-300 active:scale-90">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21l-1.498-4.493A1 1 0 005.372 3H5z"></path></svg>
             </div>
             <span v-if="!isMinimized" class="text-xs text-white/60">挂断</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  status: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';
  callType: 'video' | 'audio';
  nickname: string;
  avatar: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMinimized: boolean;
}>();

const emit = defineEmits(['accept', 'reject', 'hangup', 'toggle-minimize', 'switch-camera']);

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const remoteAudio = ref<HTMLAudioElement | null>(null);
const statusText = ref('');
const isMicMuted = ref(false);
const isCameraOff = ref(false);
const isSpeakerOn = ref(false);

const isVideoFullscreen = computed(() => !props.isMinimized && props.callType === 'video' && (props.status === 'connected' || props.status === 'calling'));

watch(() => props.status, (newStatus) => {
  switch (newStatus) {
    case 'calling': statusText.value = '正在呼叫...'; break;
    case 'incoming': statusText.value = '邀请你进行通话...'; break;
    case 'connected': statusText.value = '通话中'; break;
    case 'ended': statusText.value = '通话结束'; break;
    default: statusText.value = '';
  }
}, { immediate: true });

// Helper to attach stream to video element
const attachStream = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (el && stream) {
        el.srcObject = stream;
        const p = el.play?.();
        if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
    }
};

watch([() => props.localStream, localVideo], ([stream, el]) => attachStream(el, stream));
watch([() => props.remoteStream, remoteVideo], ([stream, el]) => attachStream(el, stream));

const attachAudioStream = (el: HTMLAudioElement | null, stream: MediaStream | null) => {
  if (el && stream) {
    el.srcObject = stream;
    const p = el.play?.();
    if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
  }
};

watch([() => props.remoteStream, remoteAudio], ([stream, el]) => attachAudioStream(el, stream));

watch(() => props.localStream, (s) => {
  const at = s?.getAudioTracks?.()[0];
  const vt = s?.getVideoTracks?.()[0];
  isMicMuted.value = !!at && at.enabled === false;
  isCameraOff.value = !!vt && vt.enabled === false;
}, { immediate: true });

function toggleMute() {
  const s = props.localStream;
  const tracks = s?.getAudioTracks?.() || [];
  if (tracks.length === 0) return;
  const next = tracks.some((t) => t.enabled);
  tracks.forEach((t) => {
    t.enabled = !next;
  });
  isMicMuted.value = next;
}

function toggleCamera() {
  const s = props.localStream;
  const tracks = s?.getVideoTracks?.() || [];
  if (tracks.length === 0) return;
  const next = tracks.some((t) => t.enabled);
  tracks.forEach((t) => {
    t.enabled = !next;
  });
  isCameraOff.value = next;
}

async function applySinkId(el: HTMLMediaElement | null, sinkId: string): Promise<boolean> {
  if (!el) return false;
  const anyEl = el as any;
  if (typeof anyEl.setSinkId !== 'function') return false;
  try {
    await anyEl.setSinkId(sinkId);
    return true;
  } catch {
    return false;
  }
}

async function toggleSpeaker() {
  const next = !isSpeakerOn.value;
  const targetSinkId = next ? 'default' : 'communications';
  const okVideo = await applySinkId(remoteVideo.value as any, targetSinkId);
  const okAudio = await applySinkId(remoteAudio.value as any, targetSinkId);
  if (!okVideo && !okAudio) {
    if (!next) {
      isSpeakerOn.value = false;
      return;
    }
    isSpeakerOn.value = true;
    return;
  }
  isSpeakerOn.value = next;
  resumePlayback();
}

function resumePlayback() {
  const rv = remoteVideo.value;
  if (rv) {
    rv.muted = false;
    const p = rv.play?.();
    if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
  }

  const ra = remoteAudio.value;
  if (ra) {
    const p = ra.play?.();
    if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
  }
}

watch(() => props.status, (s) => {
  if (s !== 'connected') return;
  resumePlayback();
});

</script>
