import { defineStore } from 'pinia';
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { CallManager, type CallStatus, type CallType, type ConnectionQuality } from '@/utils/callManager';
import { socket } from '@/utils/socket';
import { useAuthStore } from './auth';
import api from '@/utils/api';
import { audioManager } from '@/utils/audio';

export const useCallStore = defineStore('call', () => {
  const callManager = ref<CallManager | null>(null);
  const callStatus = ref<CallStatus>('idle');
  const callType = ref<CallType>('video');
  const localStream = ref<MediaStream | null>(null);
  const remoteStream = ref<MediaStream | null>(null);
  const otherUser = ref<{ id: number; nickname: string; avatar: string } | null>(null);
  const isMinimized = ref(false);
  const connectionQuality = ref<ConnectionQuality | null>(null);
  const isMuted = ref(false);
  const callDuration = ref(0);
  const callError = ref<string | null>(null);
  const isPageVisible = ref(true);
  const hasNotificationPermission = ref(false);

  const authStore = useAuthStore();
  let durationInterval: number | null = null;
  let visibilityHandler: (() => void) | null = null;
  let currentNotification: Notification | null = null;

  watch(callStatus, (next, prev) => {
    if (next === 'idle') {
      audioManager.stopAllLoops();
      stopDurationTimer();
      closeNotification();
      return;
    }
    if (next === 'incoming') {
      audioManager.stopAllLoops();
      audioManager.playLoop('call_ring_in', 0.7);
      if (!isPageVisible.value) {
        showIncomingNotification();
      }
      return;
    }
    if (next === 'calling') {
      audioManager.stopAllLoops();
      audioManager.playLoop('call_ring_out', 0.7);
      return;
    }
    if (next === 'connecting') {
      audioManager.stopAllLoops();
      return;
    }
    if (next === 'reconnecting') {
      if (!isPageVisible.value) {
        showReconnectingNotification();
      }
      return;
    }
    if (next === 'connected') {
      audioManager.stopAllLoops();
      audioManager.play('call_connect', 1.0);
      startDurationTimer();
      closeNotification();
      return;
    }
    if (next === 'ended') {
      audioManager.stopAllLoops();
      stopDurationTimer();
      closeNotification();
      if (prev === 'calling' || prev === 'connecting') {
        audioManager.play('call_busy', 1.0);
      } else {
        audioManager.play('call_end', 1.0);
      }
    }
  });

  function startDurationTimer() {
    stopDurationTimer();
    callDuration.value = 0;
    durationInterval = window.setInterval(() => {
      callDuration.value++;
      if (!isPageVisible.value && callDuration.value % 60 === 0) {
        updateOngoingCallNotification();
      }
    }, 1000);
  }

  function stopDurationTimer() {
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      return false;
    }
    
    if (Notification.permission === 'granted') {
      hasNotificationPermission.value = true;
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      hasNotificationPermission.value = permission === 'granted';
      return permission === 'granted';
    }
    
    return false;
  }

  function showIncomingNotification() {
    if (!hasNotificationPermission.value) return;
    
    closeNotification();
    
    const nickname = otherUser.value?.nickname || '未知用户';
    const typeText = callType.value === 'video' ? '视频通话' : '语音通话';
    
    currentNotification = new Notification(`${nickname} 邀请您${typeText}`, {
      body: '点击返回应用接听',
      icon: otherUser.value?.avatar || '/favicon.ico',
      tag: 'call-incoming',
      requireInteraction: true,
      silent: false
    });
    
    currentNotification.onclick = () => {
      window.focus();
      closeNotification();
    };
  }

  function showReconnectingNotification() {
    if (!hasNotificationPermission.value) return;
    
    closeNotification();
    
    const nickname = otherUser.value?.nickname || '对方';
    
    currentNotification = new Notification(`正在重连 ${nickname}...`, {
      body: '网络不稳定，正在尝试重新连接',
      icon: '/favicon.ico',
      tag: 'call-reconnecting',
      silent: true
    });
    
    currentNotification.onclick = () => {
      window.focus();
      closeNotification();
    };
  }

  function updateOngoingCallNotification() {
    if (!hasNotificationPermission.value || !isPageVisible.value) return;
    if (callStatus.value !== 'connected') return;
    
    const nickname = otherUser.value?.nickname || '对方';
    const minutes = Math.floor(callDuration.value / 60);
    const seconds = callDuration.value % 60;
    const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    closeNotification();
    
    currentNotification = new Notification(`通话中 - ${nickname}`, {
      body: `通话时长: ${durationText}`,
      icon: otherUser.value?.avatar || '/favicon.ico',
      tag: 'call-ongoing',
      silent: true
    });
    
    currentNotification.onclick = () => {
      window.focus();
      closeNotification();
    };
  }

  function closeNotification() {
    if (currentNotification) {
      currentNotification.close();
      currentNotification = null;
    }
  }

  function handleVisibilityChange() {
    isPageVisible.value = document.visibilityState === 'visible';
    
    if (isPageVisible.value) {
      closeNotification();
      
      if (callStatus.value === 'connected' && remoteStream.value) {
        resumeAudioPlayback();
      }
    } else {
      if (callStatus.value === 'incoming') {
        showIncomingNotification();
      } else if (callStatus.value === 'reconnecting') {
        showReconnectingNotification();
      } else if (callStatus.value === 'connected') {
        updateOngoingCallNotification();
      }
    }
  }

  function resumeAudioPlayback() {
    if (!remoteStream.value) return;
    
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      if (audio.srcObject === remoteStream.value) {
        audio.play().catch(() => {});
      }
    });
    
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      if (video.srcObject === remoteStream.value) {
        video.play().catch(() => {});
      }
    });
  }

  function initGlobalListener() {
    if (!socket) return;

    requestNotificationPermission();

    visibilityHandler = handleVisibilityChange;
    document.addEventListener('visibilitychange', visibilityHandler);

    socket.on('webrtc:call', async (data: any) => {
      if (callStatus.value !== 'idle') {
        if (data.fromId) {
          socket.emit('webrtc:signal', {
            targetId: data.fromId,
            type: 'busy',
            usage: 'media'
          });
        }
        return;
      }

      if (data.type !== 'video' && data.type !== 'audio') return;

      const fromId = data.fromId;
      if (!fromId) return;

      otherUser.value = { id: fromId, nickname: '未知用户', avatar: '' };
      initCallManager(fromId);
      
      if (callManager.value) {
        callManager.value.handleIncomingCall(data);
      }

      try {
        const response = await api.get(`/user/${fromId}`);
        const user = response.data.user;
        otherUser.value = {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar
        };
      } catch (e) {
        console.error('Failed to fetch caller info', e);
      }
    });
  }

  function initCallManager(targetId: number, roomId?: string) {
    if (callManager.value) {
      callManager.value.cleanup();
    }

    const myId = authStore.user?.id;
    
    callManager.value = new CallManager(
      targetId,
      (status) => {
        callStatus.value = status;
        if (status === 'ended') {
          setTimeout(() => {
            callStatus.value = 'idle';
            otherUser.value = null;
            localStream.value = null;
            remoteStream.value = null;
            callManager.value = null;
            isMinimized.value = false;
            connectionQuality.value = null;
            isMuted.value = false;
            callDuration.value = 0;
            callError.value = null;
          }, 2000);
        }
      },
      (stream) => {
        remoteStream.value = stream;
        if (isPageVisible.value) {
          resumeAudioPlayback();
        }
      },
      (stream) => {
        localStream.value = stream;
      },
      (error) => {
        console.error('Call Error:', error);
        callError.value = error;
      },
      roomId,
      myId,
      (type) => {
        callType.value = type;
      },
      (quality) => {
        connectionQuality.value = quality;
      }
    );
  }

  async function startCall(targetId: number, type: CallType, targetUser: any) {
    otherUser.value = {
      id: targetId,
      nickname: targetUser.nickname,
      avatar: targetUser.avatar
    };
    callType.value = type;
    callError.value = null;
    
    initCallManager(targetId);
    
    if (callManager.value) {
      await callManager.value.startCall(type);
    }
  }

  function acceptCall() {
    if (callManager.value) {
      callManager.value.acceptCall();
    }
  }

  function rejectCall() {
    if (callManager.value) {
      callManager.value.rejectCall();
    }
  }

  function endCall() {
    if (callManager.value) {
      callManager.value.endCall();
    }
  }
  
  function toggleMinimize() {
    isMinimized.value = !isMinimized.value;
  }

  function toggleMute() {
    isMuted.value = !isMuted.value;
    if (callManager.value) {
      callManager.value.toggleMute(isMuted.value);
    }
  }

  async function switchCamera() {
    if (!callManager.value) return;
    await callManager.value.switchCamera();
  }

  async function switchAudioDevice(deviceId: string) {
    if (!callManager.value) return;
    await callManager.value.switchAudioDevice(deviceId);
  }

  function getCallStats() {
    if (!callManager.value) return null;
    return callManager.value.getCallStats();
  }

  function clearError() {
    callError.value = null;
  }

  function cleanup() {
    stopDurationTimer();
    closeNotification();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  return {
    callStatus,
    callType,
    localStream,
    remoteStream,
    otherUser,
    isMinimized,
    connectionQuality,
    isMuted,
    callDuration,
    callError,
    isPageVisible,
    hasNotificationPermission,
    initGlobalListener,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMinimize,
    toggleMute,
    switchCamera,
    switchAudioDevice,
    getCallStats,
    clearError,
    cleanup,
    requestNotificationPermission
  };
});
