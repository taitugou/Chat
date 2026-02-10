import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { CallManager, type CallStatus, type CallType } from '@/utils/callManager';
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

  const authStore = useAuthStore();

  watch(callStatus, (next, prev) => {
    if (next === 'idle') {
      audioManager.stopAllLoops();
      return;
    }
    if (next === 'incoming') {
      audioManager.stopAllLoops();
      audioManager.playLoop('call_ring_in', 0.7);
      return;
    }
    if (next === 'calling') {
      audioManager.stopAllLoops();
      audioManager.playLoop('call_ring_out', 0.7);
      return;
    }
    if (next === 'connected') {
      audioManager.stopAllLoops();
      audioManager.play('call_connect', 1.0);
      return;
    }
    if (next === 'ended') {
      audioManager.stopAllLoops();
      if (prev === 'calling') {
        audioManager.play('call_busy', 1.0);
      } else {
        audioManager.play('call_end', 1.0);
      }
    }
  });

  // Initialize global listener for incoming calls
  function initGlobalListener() {
    if (!socket) return;

    socket.on('webrtc:call', async (data: any) => {
      // Only handle if we are idle
      if (callStatus.value !== 'idle') {
        // Already in call, maybe reject busy?
        // CallManager handles busy logic internally if instance exists,
        // but here we might not have instance yet if it's a new incoming call.
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
        callManager.value.cleanup(); // cleanup old
    }

    const myId = authStore.user?.id;
    
    callManager.value = new CallManager(
      targetId,
      (status) => {
        callStatus.value = status;
        if (status === 'ended') {
           setTimeout(() => {
               // Cleanup store state
               callStatus.value = 'idle';
               otherUser.value = null;
               localStream.value = null;
               remoteStream.value = null;
               callManager.value = null;
               isMinimized.value = false;
           }, 2000);
        }
      },
      (stream) => {
        remoteStream.value = stream;
      },
      (stream) => {
        localStream.value = stream;
      },
      (error) => {
        // alert(error); // Global alert?
        console.error('Call Error:', error);
      },
      roomId,
      myId,
      (type) => {
          callType.value = type;
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

  async function switchCamera() {
    if (!callManager.value) return;
    await callManager.value.switchCamera();
  }

  return {
    callStatus,
    callType,
    localStream,
    remoteStream,
    otherUser,
    isMinimized,
    initGlobalListener,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMinimize,
    switchCamera
  };
});
