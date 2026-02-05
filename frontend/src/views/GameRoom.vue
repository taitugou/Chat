<template>
  <div class="h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
    <div class="glass px-4 py-3 flex items-center z-50 shadow-sm border-b border-foreground/5">
      <button
        @click="goBackOneLevel"
        class="p-2 -ml-2 rounded-full text-foreground/70 hover:text-white hover:bg-foreground/10 transition-all active:scale-90"
        title="返回上一页"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0 ml-2">
        <div class="text-sm font-bold text-foreground/80">游戏房间 {{ room?.name || '' }}</div>
        <div class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Game Room</div>
      </div>
    </div>

    <div class="flex-1 px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto pb-20">
      <div class="lg:col-span-2 space-y-6">
        <div class="glass-card p-6">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-base font-bold text-white/90">房间信息</div>
              <div class="text-xs text-white/40">房间代码：<span class="font-mono">{{ room?.room_code }}</span></div>
            </div>
            <div class="flex items-center gap-3">
              <button 
                v-if="!isOwner && room?.status === 'waiting'"
                @click="handleToggleReady"
                class="px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                :class="isReady ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-primary/20 text-primary border border-primary/20'"
              >
                {{ isReady ? '取消准备' : '准备游戏' }}
              </button>
              <div class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                   :class="room?.status === 'waiting' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'">
                {{ room?.status === 'waiting' ? '等待中' : '游戏中' }}
              </div>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <div class="text-xs text-white/40">玩法</div>
              <div class="text-sm font-semibold text-white/90">{{ room?.game_name || '未知' }}</div>
            </div>
            <div class="space-y-2">
              <div class="text-xs text-white/40">人数</div>
              <div class="text-sm font-semibold text-white/90">{{ players.length }}/{{ room?.max_players || 0 }}</div>
            </div>
          </div>
          <div class="mt-6">
            <div class="text-xs text-white/40 mb-2">玩家列表</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div v-for="p in players" :key="p.user_id || p.id" class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm">👤</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-white/90 truncate">
                    {{ p.nickname || p.username || ('用户' + (p.user_id || p.id)) }}
                  </div>
                  <div class="text-[10px] text-white/30 truncate">
                    {{ (p.user_id || p.id) == room?.creator_id ? '房主' : '玩家' }} · {{ p.is_online ? '在线' : '离线' }}
                  </div>
                </div>
                <div v-if="p.is_ready" class="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 text-[10px] font-bold">
                  <span>✓</span> 已准备
                </div>
                <div v-else-if="(p.user_id || p.id) != room?.creator_id" class="text-[10px] text-white/20">
                  未准备
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card p-6">
          <div class="text-base font-bold text-white/90 mb-4">房间操作</div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              class="glass-btn-primary py-3 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
              :disabled="!canStartGame"
              @click="handleStartGame"
            >
              ▶ 开始游戏
            </button>
            <button
              class="glass-btn py-3 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="room?.status !== 'playing'"
              @click="goToGameplay"
              :title="room?.status !== 'playing' ? '游戏尚未开始' : '进入对局'"
            >
              进入对局页
            </button>
            <button
              class="glass-btn py-3 rounded-xl font-bold text-sm active:scale-95 transition-all"
              @click="leaveRoom"
            >
              ⏏ 离开房间
            </button>
          </div>
          <div class="mt-4 text-[12px] text-white/40">
            <div>提示：</div>
            <div>- 只有房主且房间状态为“等待中”时可开始游戏</div>
            <div>- 进入对局页可进行具体操作并查看状态更新</div>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="glass-card p-6">
          <div class="text-base font-bold text-white/90 mb-3">状态快照</div>
          <pre class="text-xs bg-black/40 p-3 rounded-xl overflow-auto max-h-[320px]">{{ safeJson(stateSnapshot) }}</pre>
        </div>
        <div class="glass-card p-6">
          <div class="text-base font-bold text-white/90 mb-3">最近事件</div>
          <div class="space-y-2 max-h-[240px] overflow-auto">
            <div v-for="(e, idx) in recentEvents" :key="idx" class="text-[12px] text-white/70">
              {{ e }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import { getSocket, initSocket } from '@/utils/socket';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// 无操作自动退出逻辑
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10分钟无操作自动退出
let inactivityTimer: any = null;

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    console.log('检测到长时间无操作，正在自动退出房间...');
    leaveRoomAndExit();
  }, INACTIVITY_TIMEOUT);
}

function setupInactivityListeners() {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => {
    window.addEventListener(event, resetInactivityTimer);
  });
}

function removeInactivityListeners() {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => {
    window.removeEventListener(event, resetInactivityTimer);
  });
  if (inactivityTimer) clearTimeout(inactivityTimer);
}

async function leaveRoomAndExit() {
  try {
    await api.post('/rooms/leave-all');
  } catch (e) {
    console.warn('自动退出房间失败', e);
  } finally {
    router.push('/game');
  }
}

const roomId = computed(() => String(route.params.roomId || ''));
const room = ref<any>(null);
const players = ref<any[]>([]);
const recentEvents = ref<string[]>([]);
const stateSnapshot = ref<any>({});
const isOwner = ref(false);
const refreshTimer = ref<any>(null);

const currentUserId = computed(() => authStore.user?.id);

const isReady = computed(() => {
  const me = players.value.find(p => String(p.user_id) === String(currentUserId.value));
  return me ? !!me.is_ready : false;
});

const canStartGame = computed(() => {
  if (!room.value || room.value.status !== 'waiting' || !isOwner.value) return false;
  
  const minPlayers = room.value.min_players || 2;
  if (players.value.length < minPlayers) return false;
  
  // 检查是否除房主外所有人都已准备
  return players.value.every(p => {
    if (String(p.user_id || p.id) === String(room.value.creator_id)) return true;
    return !!p.is_ready;
  });
});

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  router.push('/home');
}

function safeJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

async function fetchRoom() {
  try {
    const res = await api.get(`/rooms/${roomId.value}`);
    if (res.data.success !== false && res.data.room) {
      room.value = res.data.room;
      players.value = res.data.room.players || res.data.players || [];
      isOwner.value = !!room.value && String(room.value.creator_id) === String(authStore.user?.id);
      
      // 自动重新加入逻辑：如果用户不在玩家列表中，尝试重新加入
      const isMeInRoom = players.value.some(p => String(p.user_id || p.id) === String(authStore.user?.id));
      if (!isMeInRoom && room.value.room_code) {
        console.log('检测到用户不在房间中，尝试自动重新加入...');
        try {
          const joinRes = await api.post('/rooms/join', { roomCode: room.value.room_code });
          if (joinRes.data.success) {
            console.log('自动重新加入成功');
            // 重新获取房间信息以更新玩家列表
            const refreshRes = await api.get(`/rooms/${roomId.value}`);
            if (refreshRes.data.room) {
              room.value = refreshRes.data.room;
              players.value = refreshRes.data.room.players || [];
            }
          }
        } catch (joinErr) {
          console.error('自动重新加入失败:', joinErr);
        }
      }
      
      console.log('Room fetched:', {
        roomId: roomId.value,
        playersCount: players.value.length,
        isOwner: isOwner.value
      });
    } else {
      console.error('获取房间信息失败: 响应格式不正确', res.data);
    }
  } catch (err) {
    console.error('获取房间信息失败', err);
  }
}

function ensureSocket() {
  let s = getSocket();
  if (!s) {
    const token = localStorage.getItem('token') || '';
    s = initSocket(token);
  }
  return s;
}

function bindSocketEvents() {
  const s = ensureSocket();
  if (!s) return;

  s.emit('game:join_room', { roomId: roomId.value });
  recentEvents.value.unshift(`emit game:join_room ${roomId.value}`);

  s.on('game:player_joined', (payload: any) => {
    recentEvents.value.unshift(`[player_joined] ${payload.userId}`);
    // 如果 payload 中包含完整的 room 信息，直接更新，避免额外的 fetchRoom 调用
    if (payload.room) {
      room.value = payload.room;
      players.value = payload.room.players || [];
    } else {
      fetchRoom();
    }
  });

  s.on('game:player_left', (payload: any) => {
    recentEvents.value.unshift(`[player_left] ${payload.userId}`);
    // 从本地列表中移除玩家，避免 race condition
    const userId = String(payload.userId);
    players.value = players.value.filter(p => String(p.user_id || p.id) !== userId);
    
    // 如果有房主变更信息，更新房主
    if (payload.newOwnerId) {
      if (room.value) room.value.creator_id = payload.newOwnerId;
      isOwner.value = String(payload.newOwnerId) === String(authStore.user?.id);
    }
    
    // 依然调用 fetchRoom 以确保同步
    fetchRoom();
  });

  s.on('game:owner_changed', (payload: any) => {
    recentEvents.value.unshift(`[owner_changed] 新房主: ${payload.newOwnerId}`);
    fetchRoom(); // 重新获取完整房间信息以更新 isOwner 状态
  });

  s.on('game:player_ready', (payload: any) => {
    recentEvents.value.unshift(`[player_ready] ${safeJson(payload)}`);
    const { userId, isReady } = payload;
    const player = players.value.find(p => String(p.user_id || p.id) === String(userId));
    if (player) {
      player.is_ready = isReady;
    }
  });

  s.on('game:started', (payload: any) => {
    console.log('收到 game:started 事件:', payload);
    recentEvents.value.unshift(`[started] ${safeJson(payload)}`);
    if (room.value) room.value.status = 'playing';
    
    const incomingRoomId = String(payload?.roomId || payload?.room?.id || '');
    const currentRoomId = String(roomId.value);
    
    console.log(`正在检查房间匹配: incoming=${incomingRoomId}, current=${currentRoomId}`);
    
    if (incomingRoomId === currentRoomId) {
      const gType = payload?.gameType || room.value?.game_code || 'generic';
      const targetPath = `/game/room/${currentRoomId}/${gType}`;
      console.log(`匹配成功，准备跳转至: ${targetPath}`);
      
      // 使用 replace 而不是 push，避免返回时回到这个中间状态
      router.replace(targetPath).catch(err => {
        console.error('自动跳转失败:', err);
      });
    } else {
      console.warn('房间 ID 不匹配，跳过自动跳转');
    }
  });

  s.on('game:state_update', (data: any) => {
    stateSnapshot.value = data.gameState || data;
    recentEvents.value.unshift(`[state_update] ${Date.now()}`);
  });

  s.on('game:finished', (result: any) => {
    recentEvents.value.unshift(`[finished] ${safeJson(result)}`);
    stateSnapshot.value = { finished: true, result };
  });
}

function unbindSocketEvents() {
  const s = getSocket();
  if (!s) return;
  s.off('game:player_joined');
  s.off('game:player_left');
  s.off('game:owner_changed');
  s.off('game:player_ready');
  s.off('game:started');
  s.off('game:state_update');
  s.off('game:finished');
}

function handleStartGame() {
  const s = ensureSocket();
  if (!s || !room.value) return;
  s.emit('game:start', { roomId: roomId.value });
  recentEvents.value.unshift('emit game:start');
}

function handleToggleReady() {
  const s = ensureSocket();
  if (!s || !room.value) return;
  const newReadyState = !isReady.value;
  s.emit('game:player_ready', { roomId: roomId.value, isReady: newReadyState });
  recentEvents.value.unshift(`emit game:player_ready ${newReadyState}`);
}

function goToGameplay() {
  const gameType = room.value?.game_code || 'generic';
  router.push(`/game/room/${roomId.value}/${gameType}`);
}

async function leaveRoom() {
  try {
    await api.post('/rooms/leave-all');
  } catch (e) {
    console.warn('离开房间失败', e);
  } finally {
    router.push('/game');
  }
}

onMounted(async () => {
  await fetchRoom();
  bindSocketEvents();
  setupInactivityListeners();
  resetInactivityTimer();
  
  // 每秒自动无感刷新房间数据
  refreshTimer.value = setInterval(() => {
    fetchRoom();
  }, 1000);
});

onUnmounted(() => {
  unbindSocketEvents();
  removeInactivityListeners();
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
});
</script>
