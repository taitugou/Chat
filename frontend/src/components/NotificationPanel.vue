<template>
  <div v-if="variant === 'page'" class="w-full space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-black text-white tracking-tight">通知</h1>
      <div class="flex items-center gap-2">
        <button
          v-if="unreadCount > 0"
          @click="markAllRead"
          class="glass-btn px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
        >
          全部已读
        </button>
        <button
          @click="clearAll"
          class="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-red-400 border-red-500/20 active:scale-95 transition-all"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 标签页 -->
    <div class="flex flex-wrap items-center gap-2 pb-2">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeTab = tab.key"
        class="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all active:scale-95 flex items-center gap-2"
        :class="[
          activeTab === tab.key ? 'glass-btn-primary' : 'glass text-foreground/40 hover:text-white border border-foreground/5'
        ]"
      >
        {{ tab.label }}
        <span
          v-if="tab.count > 0"
          class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full shadow-lg"
        >
          {{ tab.count }}
        </span>
      </button>
    </div>

    <!-- 通知列表 -->
    <div class="space-y-4">
      <div v-if="loading" class="py-20 text-center">
        <div class="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary mx-auto mb-4"></div>
        <p class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Loading...</p>
      </div>

      <div v-else class="space-y-3" ref="listRef">
        <template v-if="activeTab === 'all' || activeTab === 'friend_request'">
          <!-- 好友申请 -->
          <div
            v-for="request in friendRequests"
            :key="'request-' + request.id"
            class="glass-card p-4 flex items-center gap-4 animate-in slide-in-from-left-2"
          >
            <div class="relative group cursor-pointer" @click.stop="goToProfile(request.username)">
              <img
                v-if="request.avatar"
                :src="getImageUrl(request.avatar)"
                class="w-12 h-12 rounded-xl object-cover border border-foreground/10 group-hover:border-primary transition-colors"
              />
              <div v-else class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl border border-primary/20">
                👥
              </div>
            </div>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-black text-primary uppercase tracking-widest">好友申请</span>
                <span class="text-[9px] text-foreground/20 font-black uppercase tracking-widest">{{ formatTime(request.created_at) }}</span>
              </div>
              <p class="text-sm text-foreground/80 leading-relaxed">
                <span class="font-bold text-white cursor-pointer hover:text-primary transition-colors" @click.stop="goToProfile(request.username)">
                  {{ request.nickname }}
                </span>
                申请添加你为好友
              </p>
              <div v-if="request.message" class="mt-2 p-2.5 bg-foreground/5 rounded-xl border border-foreground/5 text-[11px] text-foreground/40 italic">
                "{{ request.message }}"
              </div>
              
              <div class="flex gap-2 mt-4">
                <button @click.stop="handleFriendRequest(request.id, 'accept')" class="glass-btn-primary px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                  通过
                </button>
                <button @click.stop="handleFriendRequest(request.id, 'reject')" class="glass-btn px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                  拒绝
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-if="activeTab !== 'friend_request'">
          <!-- 普通通知 -->
          <div
            v-for="notification in notifications.filter(n => n.related_type !== 'friend_request')"
            :key="notification.id"
            @click="handleNotificationClick(notification)"
            class="glass-card p-4 flex items-center gap-4 group cursor-pointer active:scale-[0.99] transition-all"
            :class="{ 'border-primary/30 bg-primary/5': !notification.is_read }"
          >
            <div class="relative flex-shrink-0" @click.stop="goToProfile(notification.sender_username)">
              <img
                v-if="notification.sender_avatar"
                :src="getImageUrl(notification.sender_avatar)"
                class="w-12 h-12 rounded-xl object-cover border border-foreground/10 group-hover:border-primary transition-colors"
              />
              <div
                v-else
                class="w-12 h-12 rounded-xl flex items-center justify-center text-xl border border-foreground/10"
                :class="`bg-${notification.type}-500/10`"
              >
                {{ getTypeIcon(notification.type) }}
              </div>
              <div v-if="!notification.is_read" class="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-black shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">
                  {{ notification.title || getTypeTitle(notification.type) }}
                </span>
                <span class="text-[9px] text-foreground/20 font-black uppercase tracking-widest">{{ formatTime(notification.created_at) }}</span>
              </div>
              <div class="text-sm text-foreground/80 leading-relaxed break-words">
                <span 
                  v-if="notification.sender_nickname"
                  class="font-bold text-white hover:text-primary transition-colors"
                  @click.stop="goToProfile(notification.sender_username)"
                >
                  {{ notification.sender_nickname }}
                </span>
                {{ notification.content }}
              </div>
            </div>

            <button
              @click.stop="deleteNotification(notification.id)"
              class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-foreground/20 hover:text-red-400 hover:bg-red-400/10 active:scale-90 transition-all opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        </template>

        <div v-if="isEmpty" class="py-20 text-center glass-card">
          <span class="text-4xl block mb-4 opacity-20">🔔</span>
          <p class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">暂无通知记录</p>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore && activeTab !== 'friend_request'" class="pt-6 pb-12 text-center">
          <button
            @click="loadMore"
            :disabled="loadingMore"
            class="glass-btn px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-20"
          >
            {{ loadingMore ? 'Loading...' : 'Load More' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 下拉框模式 (通常在顶部导航) -->
  <div v-else class="relative" ref="containerRef">
    <button
      ref="triggerRef"
      @click="toggleDropdown"
      class="relative w-10 h-10 rounded-full glass-btn flex items-center justify-center active:scale-90 transition-all"
      :class="{ 'bg-primary/20 text-primary': unreadCount > 0 }"
    >
      <span class="text-xl">🔔</span>
      <span
        v-if="unreadCount > 0"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-black"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <teleport to="body">
      <Transition name="fade">
        <div
          v-if="variant === 'dropdown' && showDropdown"
          ref="dropdownRef"
          class="fixed z-[1000] mt-3 w-80 max-h-[80vh] glass-modal rounded-[2rem] border border-foreground/10 shadow-2xl overflow-hidden flex flex-col"
          :style="dropdownStyle"
        >
          <div class="p-4 border-b border-foreground/5 flex items-center justify-between bg-foreground/5">
            <h3 class="text-sm font-bold text-white">通知</h3>
            <div class="flex gap-3">
              <button v-if="unreadCount > 0" @click="markAllRead" class="text-[10px] font-black text-primary uppercase tracking-widest hover:opacity-70">全部已读</button>
              <button @click="clearAll" class="text-[10px] font-black text-red-400/60 uppercase tracking-widest hover:text-red-400">清空</button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto custom-scrollbar">
            <div v-if="loading" class="p-10 text-center">
              <div class="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            </div>
            <div v-else-if="isEmpty" class="p-12 text-center text-foreground/20">
              <p class="text-xs font-bold uppercase tracking-widest">暂无新通知</p>
            </div>
            <div v-else class="divide-y divide-white/[0.03]">
               <!-- 简化的下拉通知�?-->
               <div 
                 v-for="notification in notifications.slice(0, 10)" 
                 :key="notification.id"
                 @click="handleNotificationClick(notification)"
                 class="p-4 hover:bg-foreground/5 cursor-pointer transition-colors flex gap-3"
                 :class="{ 'bg-primary/5': !notification.is_read }"
               >
                  <img :src="getImageUrl(notification.sender_avatar)" class="w-8 h-8 rounded-lg object-cover border border-foreground/10" />
                  <div class="flex-1 min-w-0">
                     <p class="text-xs text-foreground/80 line-clamp-2 leading-relaxed">{{ notification.content }}</p>
                     <p class="text-[9px] text-foreground/20 font-black uppercase tracking-widest mt-1">{{ formatTime(notification.created_at) }}</p>
                  </div>
               </div>
            </div>
          </div>

          <router-link to="/notifications" class="p-3 bg-foreground/5 border-t border-foreground/5 text-center text-[10px] font-black text-primary uppercase tracking-widest hover:bg-foreground/10 transition-colors" @click="showDropdown = false">
            查看全部通知 >
          </router-link>
        </div>
      </Transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useElementBounding, useWindowSize, onClickOutside } from '@vueuse/core';
import api from '@/utils/api';
import { getSocket } from '@/utils/socket';
import { getImageUrl } from '@/utils/imageUrl';

const props = withDefaults(defineProps<{
  variant?: 'bell' | 'dropdown' | 'page';
}>(), {
  variant: 'bell'
});

const variant = computed(() => props.variant);

interface Notification {
  id: number;
  type: string;
  title: string | null;
  content: string | null;
  sender_id: number | null;
  sender_avatar: string | null;
  sender_nickname: string | null;
  sender_username: string | null;
  related_id: number | null;
  related_type: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

const router = useRouter();
const containerRef = ref<HTMLElement>();
const triggerRef = ref<HTMLElement>();
const dropdownRef = ref<HTMLElement>();
const listRef = ref<HTMLElement>();

const { bottom, right } = useElementBounding(triggerRef);
const { width: windowWidth } = useWindowSize();

const dropdownStyle = computed(() => {
  if (!triggerRef.value) return {};
  return {
    top: `${bottom.value + 12}px`,
    right: `${windowWidth.value - right.value}px`,
  };
});

onClickOutside(containerRef, (event) => {
  if (dropdownRef.value && dropdownRef.value.contains(event.target as Node)) return;
  showDropdown.value = false;
});

const showDropdown = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const notifications = ref<Notification[]>([]);
const friendRequests = ref<any[]>([]);
const unreadCount = ref(0);
const page = ref(1);
const limit = 20;
const hasMore = ref(false);
const activeTab = ref('all');

const tabs = ref([
  { key: 'all', label: '全部', count: 0 },
  { key: 'comment', label: '评论回复', count: 0 },
  { key: 'like', label: '收到的赞', count: 0 },
  { key: 'follow', label: '新增关注', count: 0 },
  { key: 'mention', label: '@提及', count: 0 },
  { key: 'message', label: '私信消息', count: 0 },
  { key: 'profile_message', label: '留言通知', count: 0 },
  { key: 'match', label: '匹配成功', count: 0 },
  { key: 'friend_request', label: '好友申请', count: 0 },
  { key: 'system', label: '系统通知', count: 0 }
]);

const isEmpty = computed(() => {
  if (activeTab.value === 'friend_request') return friendRequests.value.length === 0;
  return notifications.value.length === 0 && friendRequests.value.length === 0;
});

watch(activeTab, (newTab) => {
  page.value = 1;
  if (newTab === 'friend_request') {
    fetchFriendRequests();
  } else {
    fetchNotifications();
  }
});

onMounted(() => {
  fetchUnreadCount();
  fetchFriendRequests();
  if (variant.value !== 'bell') fetchNotifications();
  
  const socket = getSocket();
  if (socket) {
    socket.on('notification:new', (data) => {
      fetchUnreadCount();
      if (data.related_type === 'friend_request' || data.related_type === 'friend_accept') fetchFriendRequests();
      if (variant.value === 'page' || showDropdown.value) {
        if (activeTab.value === 'all' || activeTab.value === data.type) fetchNotifications();
      }
    });
  }
  
  refreshIntervalId.value = window.setInterval(() => {
    fetchUnreadCount();
    fetchFriendRequests();
  }, 30000);
});

onUnmounted(() => {
  if (refreshIntervalId.value) window.clearInterval(refreshIntervalId.value);
  const socket = getSocket();
  if (socket) socket.off('notification:new');
});

const totalStandardUnread = ref(0);
const refreshIntervalId = ref<number | null>(null);

async function fetchFriendRequests() {
  try {
    const response = await api.get('/user/friend-requests');
    friendRequests.value = response.data.requests || [];
    const frTab = tabs.value.find(tab => tab.key === 'friend_request');
    if (frTab) frTab.count = friendRequests.value.length;
    updateTotalUnreadCount();
  } catch (error) {}
}

function updateTotalUnreadCount() {
  const friendRequestCount = friendRequests.value.length;
  unreadCount.value = Math.max(totalStandardUnread.value, friendRequestCount);
  tabs.value[0].count = unreadCount.value;
}

async function fetchNotifications(append = false) {
  try {
    if (!append) loading.value = true;
    else loadingMore.value = true;

    const response = await api.get('/notification', {
      params: {
        page: page.value,
        limit,
        type: activeTab.value === 'all' || activeTab.value === 'friend_request' ? undefined : activeTab.value
      }
    });

    const fetched = response.data.notifications || [];
    notifications.value = append ? [...notifications.value, ...fetched] : fetched;
    hasMore.value = notifications.value.length < response.data.total;
    fetchUnreadCount();
  } catch (error) {} finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function fetchUnreadCount() {
  try {
    const response = await api.get('/notification/unread-count');
    totalStandardUnread.value = response.data.total || 0;
    tabs.value.forEach(tab => {
      if (tab.key === 'message') tab.count = response.data.messageCount || 0;
      if (tab.key === 'profile_message') tab.count = response.data.profileMessageCount || 0;
      if (tab.key === 'mention') tab.count = response.data.mentionCount || 0;
      if (tab.key === 'comment') tab.count = response.data.commentCount || 0;
      if (tab.key === 'like') tab.count = response.data.likeCount || 0;
      if (tab.key === 'follow') tab.count = response.data.followCount || 0;
      if (tab.key === 'system') tab.count = response.data.systemCount || 0;
      if (tab.key === 'match') tab.count = response.data.matchCount || 0;
    });
    updateTotalUnreadCount();
  } catch (error) {}
}

async function handleFriendRequest(requestId: number, action: string) {
  try {
    await api.put(`/user/friend-requests/${requestId}`, { action });
    await fetchFriendRequests();
    await fetchUnreadCount();
  } catch (error) {}
}

function toggleDropdown() {
  if (variant.value === 'bell') { router.push('/notifications'); return; }
  if (variant.value !== 'dropdown') return;
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) {
    page.value = 1;
    fetchNotifications();
    fetchFriendRequests();
    fetchUnreadCount();
  }
}

async function handleNotificationClick(notification: Notification) {
  if (!notification.is_read) await markAsRead(notification.id);
  if (variant.value === 'dropdown') showDropdown.value = false;
  
  if (notification.related_id && notification.related_type) {
    const map: Record<string, string> = {
      'post': `/post/${notification.related_id}`,
      'topic': `/topic/${notification.related_id}`,
      'user_message': `/profile/${notification.sender_id}`,
      'comment': `/post/${notification.related_id}`,
      'bio': `/profile/${notification.related_id}`,
      'group': `/group-chat/${notification.related_id}`,
      'announcement': `/group-chat/${notification.related_id}`,
      'chat': `/chat/${notification.sender_id}`,
      'sponsorship': '/rankings'
    };
    if (notification.related_type === 'friend_request') activeTab.value = 'friend_request';
    else if (map[notification.related_type]) router.push(map[notification.related_type]);
  }
}

async function markAsRead(id: number) {
  try {
    await api.put(`/notification/${id}/read`);
    const n = notifications.value.find(item => item.id === id);
    if (n) { n.is_read = true; n.read_at = new Date().toISOString(); }
    totalStandardUnread.value = Math.max(0, totalStandardUnread.value - 1);
    updateTotalUnreadCount();
  } catch (error) {}
}

async function markAllRead() {
  try {
    await api.put('/notification/mark-all-read');
    notifications.value.forEach(n => { n.is_read = true; n.read_at = new Date().toISOString(); });
    totalStandardUnread.value = 0;
    updateTotalUnreadCount();
  } catch (error) {}
}

async function deleteNotification(id: number) {
  try {
    await api.delete(`/notification/${id}`);
    const n = notifications.value.find(item => item.id === id);
    if (n && !n.is_read) {
      totalStandardUnread.value = Math.max(0, totalStandardUnread.value - 1);
      updateTotalUnreadCount();
    }
    notifications.value = notifications.value.filter(item => item.id !== id);
  } catch (error) {}
}

async function clearAll() {
  if (!confirm('确定要清空所有通知吗？')) return;
  try {
    await api.delete('/notification/clear-all');
    notifications.value = [];
    totalStandardUnread.value = 0;
    updateTotalUnreadCount();
  } catch (error) {}
}

function loadMore() {
  page.value++;
  fetchNotifications(true);
}

function goToProfile(username: string | null) {
  if (!username) return;
  showDropdown.value = false;
  router.push(`/profile/${username}`);
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    message: '💬', 
    comment: '💭', 
    like: '❤️', 
    follow: '👥', 
    mention: '🔔', 
    system: '⚙️', 
    profile_message: '📝',
    match: '💖'
  };
  return icons[type] || '📌';
}

function getTypeTitle(type: string): string {
  const titles: Record<string, string> = {
    message: '新消息', 
    comment: '新评论', 
    like: '收到点赞', 
    follow: '新关注', 
    mention: '有人@了你', 
    system: '系统通知', 
    profile_message: '新留言',
    match: '匹配成功'
  };
  return titles[type] || '通知';
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'now';
}
</script>

<style scoped>
</style>

