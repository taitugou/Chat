import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { getSocket } from '@/utils/socket';
import { fetchRandomMusic, MusicTrack, MusicSource } from '@/utils/musicApi';

export type { MusicSource } from '@/utils/musicApi';
export type PlayState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface RoomMusicState {
  roomId: string;
  isOwner: boolean;
  ownerControlEnabled: boolean;
}

const PRELOAD_COUNT = 5;
const HISTORY_MAX = 50;

export const useMusicPlayerStore = defineStore('musicPlayer', () => {
  const currentTrack = ref<MusicTrack | null>(null);
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(0.7);
  const muted = ref(false);
  const playState = ref<PlayState>('idle');
  const source = ref<MusicSource>('auto');
  const showPanel = ref(false);
  const autoPlayEnabled = ref(true);
  
  const history = ref<MusicTrack[]>([]);
  const preloadQueue = ref<MusicTrack[]>([]);
  
  const roomState = ref<RoomMusicState | null>(null);
  
  const audioElement = ref<HTMLAudioElement | null>(null);
  const preloadAudioPool = ref<Map<string, HTMLAudioElement>>(new Map());
  
  let progressInterval: number | null = null;
  let socketBound = false;
  let isPreloading = false;

  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  const formattedCurrentTime = computed(() => formatTime(currentTime.value));
  const formattedDuration = computed(() => formatTime(duration.value));

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function init() {
    if (audioElement.value) return;
    
    audioElement.value = new Audio();
    audioElement.value.volume = volume.value;
    audioElement.value.preload = 'auto';
    
    audioElement.value.addEventListener('loadedmetadata', () => {
      duration.value = audioElement.value?.duration || 0;
    });
    
    audioElement.value.addEventListener('timeupdate', () => {
      currentTime.value = audioElement.value?.currentTime || 0;
    });
    
    audioElement.value.addEventListener('ended', () => {
      playNext();
    });
    
    audioElement.value.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      playState.value = 'error';
    });
    
    audioElement.value.addEventListener('canplay', () => {
      playState.value = 'playing';
    });

    loadSettings();
    bindSocketEvents();
    
    fillPreloadQueue();
  }

  function loadSettings() {
    try {
      const savedVolume = localStorage.getItem('ttg:music:volume');
      const savedMuted = localStorage.getItem('ttg:music:muted');
      const savedAutoPlay = localStorage.getItem('ttg:music:autoPlay');
      
      if (savedVolume !== null) setVolume(Number(savedVolume));
      if (savedMuted !== null) muted.value = savedMuted === 'true';
      if (savedAutoPlay !== null) autoPlayEnabled.value = savedAutoPlay === 'true';
    } catch (e) {
      console.warn('Failed to load music settings:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('ttg:music:volume', String(volume.value));
      localStorage.setItem('ttg:music:muted', String(muted.value));
      localStorage.setItem('ttg:music:autoPlay', String(autoPlayEnabled.value));
    } catch (e) {
      console.warn('Failed to save music settings:', e);
    }
  }

  async function fillPreloadQueue() {
    if (isPreloading) return;
    isPreloading = true;
    
    while (preloadQueue.value.length < PRELOAD_COUNT) {
      try {
        const track = await fetchRandomMusic(source.value);
        if (track && track.url) {
          preloadQueue.value.push(track);
          preloadTrack(track);
        }
      } catch (e) {
        console.warn('Failed to preload track:', e);
        break;
      }
    }
    
    isPreloading = false;
  }

  function preloadTrack(track: MusicTrack) {
    if (preloadAudioPool.value.has(track.id)) return;
    
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = track.url;
    audio.load();
    
    preloadAudioPool.value.set(track.id, audio);
    
    if (preloadAudioPool.value.size > PRELOAD_COUNT + 2) {
      const oldestKey = preloadAudioPool.value.keys().next().value;
      if (oldestKey) {
        const oldAudio = preloadAudioPool.value.get(oldestKey);
        oldAudio?.pause();
        oldAudio?.removeAttribute('src');
        preloadAudioPool.value.delete(oldestKey);
      }
    }
  }

  function bindSocketEvents() {
    if (socketBound) return;
    socketBound = true;
    
    const checkSocket = () => {
      const socket = getSocket();
      if (!socket) {
        setTimeout(checkSocket, 1000);
        return;
      }
      
      socket.on('room:music:sync', handleMusicSync);
      socket.on('room:music:control', handleMusicControl);
    };
    
    checkSocket();
  }

  function handleMusicSync(payload: {
    track: MusicTrack;
    isPlaying: boolean;
    currentTime: number;
    action: string;
  }) {
    if (!roomState.value || roomState.value.isOwner) return;
    
    const { track, isPlaying: playing, currentTime: time, action } = payload;
    
    if (action === 'play' || action === 'next') {
      currentTrack.value = track;
      loadTrack(track.url);
      if (playing) {
        audioElement.value?.play().catch(() => {});
      }
    }
    
    if (action === 'seek' && audioElement.value) {
      audioElement.value.currentTime = time;
    }
    
    if (action === 'pause') {
      audioElement.value?.pause();
    }
    
    if (action === 'resume') {
      audioElement.value?.play().catch(() => {});
    }
    
    isPlaying.value = playing;
  }

  function handleMusicControl(payload: { action: string; data?: any }) {
    if (!roomState.value || roomState.value.isOwner) return;
    
    switch (payload.action) {
      case 'play':
        if (payload.data?.track) {
          currentTrack.value = payload.data.track;
          loadTrack(payload.data.track.url);
          audioElement.value?.play().catch(() => {});
          isPlaying.value = true;
        }
        break;
      case 'pause':
        audioElement.value?.pause();
        isPlaying.value = false;
        break;
      case 'resume':
        audioElement.value?.play().catch(() => {});
        isPlaying.value = true;
        break;
      case 'seek':
        if (audioElement.value && payload.data?.time !== undefined) {
          audioElement.value.currentTime = payload.data.time;
        }
        break;
      case 'next':
        if (payload.data?.track) {
          currentTrack.value = payload.data.track;
          loadTrack(payload.data.track.url);
          audioElement.value?.play().catch(() => {});
          isPlaying.value = true;
        }
        break;
    }
  }

  function emitRoomControl(action: string, data?: any) {
    if (!roomState.value || !roomState.value.isOwner) return;
    
    const socket = getSocket();
    if (!socket) return;
    
    socket.emit('room:music:control', {
      roomId: roomState.value.roomId,
      action,
      data: {
        track: currentTrack.value,
        isPlaying: isPlaying.value,
        currentTime: currentTime.value,
        ...data
      }
    });
  }

  async function fetchAndPlay(): Promise<boolean> {
    playState.value = 'loading';
    
    if (preloadQueue.value.length > 0) {
      const track = preloadQueue.value.shift()!;
      currentTrack.value = track;
      await loadTrack(track.url);
      await play();
      
      fillPreloadQueue();
      
      if (roomState.value?.isOwner) {
        emitRoomControl('play', { track });
      }
      
      return true;
    }
    
    try {
      const track = await fetchRandomMusic(source.value);
      if (track) {
        currentTrack.value = track;
        await loadTrack(track.url);
        await play();
        
        if (roomState.value?.isOwner) {
          emitRoomControl('play', { track });
        }
        
        fillPreloadQueue();
        return true;
      }
    } catch (e) {
      console.error('Failed to fetch music:', e);
      playState.value = 'error';
    }
    
    return false;
  }

  async function loadTrack(url: string) {
    if (!audioElement.value) return;
    
    if (audioElement.value.src) {
      audioElement.value.pause();
      audioElement.value.removeAttribute('src');
      audioElement.value.load();
    }
    
    audioElement.value.src = url;
    audioElement.value.load();
    
    return new Promise<void>((resolve, reject) => {
      const onCanPlay = () => {
        audioElement.value?.removeEventListener('canplay', onCanPlay);
        audioElement.value?.removeEventListener('error', onError);
        resolve();
      };
      
      const onError = (e: Event) => {
        audioElement.value?.removeEventListener('canplay', onCanPlay);
        audioElement.value?.removeEventListener('error', onError);
        if ((e.target as HTMLAudioElement)?.error?.code === MediaError.MEDIA_ERR_ABORTED) {
          resolve();
          return;
        }
        reject(e);
      };
      
      audioElement.value?.addEventListener('canplay', onCanPlay);
      audioElement.value?.addEventListener('error', onError);
    });
  }

  async function play() {
    if (!audioElement.value) return;
    
    if (!currentTrack.value) {
      await fetchAndPlay();
      return;
    }
    
    try {
      await audioElement.value.play();
      isPlaying.value = true;
      playState.value = 'playing';
      startProgressTracking();
      
      if (roomState.value?.isOwner) {
        emitRoomControl('resume');
      }
    } catch (e) {
      console.error('Play failed:', e);
      playState.value = 'error';
    }
  }

  function pause() {
    if (!audioElement.value) return;
    
    audioElement.value.pause();
    isPlaying.value = false;
    playState.value = 'paused';
    stopProgressTracking();
    
    if (roomState.value?.isOwner) {
      emitRoomControl('pause');
    }
  }

  function togglePlay() {
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  }

  async function playNext() {
    if (currentTrack.value) {
      history.value.unshift(currentTrack.value);
      if (history.value.length > HISTORY_MAX) {
        history.value = history.value.slice(0, HISTORY_MAX);
      }
    }
    
    if (preloadQueue.value.length > 0) {
      playState.value = 'loading';
      const track = preloadQueue.value.shift()!;
      currentTrack.value = track;
      
      await loadTrack(track.url);
      await play();
      
      if (roomState.value?.isOwner) {
        emitRoomControl('next', { track });
      }
      
      fillPreloadQueue();
    } else {
      await fetchAndPlay();
    }
  }

  async function playPrev() {
    if (history.value.length > 0) {
      const prevTrack = history.value.shift()!;
      
      if (currentTrack.value) {
        preloadQueue.unshift(currentTrack.value);
      }
      
      currentTrack.value = prevTrack;
      playState.value = 'loading';
      await loadTrack(prevTrack.url);
      await play();
    } else {
      await fetchAndPlay();
    }
  }

  function setVolume(vol: number) {
    volume.value = Math.max(0, Math.min(1, vol));
    if (audioElement.value) {
      audioElement.value.volume = volume.value;
    }
    saveSettings();
  }

  function toggleMute() {
    muted.value = !muted.value;
    if (audioElement.value) {
      audioElement.value.muted = muted.value;
    }
    saveSettings();
  }

  function setSource(src: MusicSource) {
    source.value = src;
    saveSettings();
  }

  function startProgressTracking() {
    stopProgressTracking();
    
    progressInterval = window.setInterval(() => {
      if (audioElement.value) {
        currentTime.value = audioElement.value.currentTime;
      }
    }, 100);
  }

  function stopProgressTracking() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  function togglePanel() {
    showPanel.value = !showPanel.value;
  }

  function enterRoom(roomId: string, isOwner: boolean) {
    roomState.value = {
      roomId,
      isOwner,
      ownerControlEnabled: true
    };
    
    const socket = getSocket();
    if (socket) {
      socket.emit('room:music:join', { roomId });
    }
  }

  function leaveRoom() {
    if (roomState.value) {
      const socket = getSocket();
      if (socket) {
        socket.emit('room:music:leave', { roomId: roomState.value.roomId });
      }
      roomState.value = null;
    }
  }

  function setRoomOwner(isOwner: boolean) {
    if (roomState.value) {
      roomState.value.isOwner = isOwner;
    }
  }

  async function autoPlayAfterLogin() {
    if (!autoPlayEnabled.value) return;
    
    init();
    
    try {
      await fetchAndPlay();
    } catch (e) {
      console.warn('Auto-play failed (likely blocked by browser):', e);
    }
  }

  function destroy() {
    stopProgressTracking();
    
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value.src = '';
      audioElement.value = null;
    }
    
    preloadAudioPool.value.forEach((audio) => {
      audio.pause();
      audio.removeAttribute('src');
    });
    preloadAudioPool.value.clear();
    
    const socket = getSocket();
    if (socket) {
      socket.off('room:music:sync', handleMusicSync);
      socket.off('room:music:control', handleMusicControl);
    }
    
    socketBound = false;
  }

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    playState,
    source,
    history,
    preloadQueue,
    showPanel,
    autoPlayEnabled,
    roomState,
    init,
    play,
    pause,
    togglePlay,
    playNext,
    playPrev,
    setVolume,
    toggleMute,
    togglePanel,
    enterRoom,
    leaveRoom,
    setRoomOwner,
    autoPlayAfterLogin,
    fetchAndPlay,
    saveSettings,
    destroy
  };
});
