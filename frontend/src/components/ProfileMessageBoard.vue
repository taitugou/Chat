<template>
  <div class="profile-message-board w-full">
    <div class="message-board-header flex justify-between items-center mb-5">
      <h2 class="text-lg font-semibold text-white drop-shadow-md">留言</h2>
      <button
        @click="showMessageModal = true"
        class="btn btn-primary px-3 py-1.5 text-sm !bg-foreground/20 hover:!bg-white/30 text-white border border-foreground/30"
      >
        写留言
      </button>
    </div>

    <div v-if="loading" class="message-board-loading text-center py-10 text-gray-500">
      加载中...
    </div>

    <div v-else-if="messages.length === 0" class="message-board-empty text-center py-10 text-foreground/70">
      暂无留言，快来抢沙发吧~
    </div>

    <div v-else class="message-board-list flex flex-col gap-4">
      <div
          v-for="message in displayMessages"
          :key="message.id"
          class="message-item bg-transparent rounded-xl p-4 backdrop-blur-xl bg-foreground/10 border border-foreground/20 shadow-lg"
        >
        <div class="message-main flex gap-3">
          <div class="message-avatar-link flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" @click.stop="goToProfile(message.sender_username)">
            <img
              :src="getImageUrl(message.sender_avatar)"
              :alt="message.sender_nickname"
              class="message-avatar w-12 h-12 rounded-full object-cover"
            />
          </div>
          
          <div class="message-content-wrapper flex-1 min-w-0">
            <div class="message-header flex items-center gap-2 mb-2">
              <div
                class="message-author font-medium text-white cursor-pointer hover:text-blue-300 transition-colors"
                @click.stop="goToProfile(message.sender_username)"
              >
                {{ message.sender_nickname }}
              </div>
              <span class="message-time text-xs text-foreground/60">{{ formatTime(message.created_at) }}</span>
            </div>
            
            <div class="message-text text-foreground/80 leading-relaxed break-words mb-3" v-html="formatPostContent(message.content)"></div>
            
            <div class="message-actions flex gap-4">
              <button
                @click="toggleLike(message)"
                class="message-action-btn flex items-center gap-1 px-2 py-1 border-none bg-transparent text-white cursor-pointer rounded text-sm transition-all hover:bg-foreground/20"
                :class="{ 'text-red-400': message.is_liked }"
              >
                <span>{{ message.is_liked ? '❤️' : '🤍' }}</span>
                <span class="font-medium">{{ message.like_count || 0 }}</span>
              </button>
              
              <button
                @click="toggleReplies(message.id)"
                class="message-action-btn flex items-center gap-1 px-2 py-1 border-none bg-transparent text-white cursor-pointer rounded text-sm transition-all hover:bg-foreground/20"
              >
                <span>💬</span>
                <span class="font-medium">{{ message.reply_count || 0 }}</span>
              </button>
              
              <button
                v-if="canDelete(message)"
                @click="confirmDelete(message)"
                class="message-action-btn delete-btn flex items-center gap-1 px-2 py-1 border-none bg-transparent text-red-400 cursor-pointer rounded text-sm transition-all hover:bg-red-500/20"
              >
                <span>🗑</span>
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="expandedReplies.has(message.id) && message.replies && message.replies.length > 0"
          class="message-replies mt-4 pt-4 border-t border-foreground/20"
        >
          <div
            v-for="reply in message.replies"
            :key="reply.id"
            class="reply-item flex gap-2.5 mb-3"
          >
            <div class="reply-avatar-link flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" @click.stop="goToProfile(reply.sender_username)">
              <img
                :src="getImageUrl(reply.sender_avatar)"
                :alt="reply.sender_nickname"
                class="reply-avatar w-8 h-8 rounded-full object-cover"
              />
            </div>
            
            <div class="reply-content-wrapper flex-1 min-w-0">
              <div class="reply-header flex items-center gap-2 mb-1">
                <div
                  class="reply-author font-medium text-white cursor-pointer hover:text-blue-300 transition-colors text-sm"
                  @click.stop="goToProfile(reply.sender_username)"
                >
                  {{ reply.sender_nickname }}
                </div>
                <span class="reply-time text-xs text-foreground/60">{{ formatTime(reply.created_at) }}</span>
              </div>
              
              <div class="reply-text text-foreground/80 leading-relaxed text-sm break-words mb-2" v-html="formatPostContent(reply.content)"></div>
              
              <div class="reply-actions flex gap-3">
                <button
                  @click="toggleLike(reply, message.id)"
                  class="reply-action-btn flex items-center gap-1 px-1.5 py-0.5 border-none bg-transparent text-white cursor-pointer rounded text-xs transition-all hover:bg-foreground/20"
                  :class="{ 'text-red-400': reply.is_liked }"
                >
                  <span>{{ reply.is_liked ? '❤️' : '🤍' }}</span>
                  <span class="font-medium">{{ reply.like_count || 0 }}</span>
                </button>
                
                <button
                  v-if="canDelete(reply)"
                  @click="confirmDelete(reply)"
                  class="reply-action-btn delete-btn flex items-center gap-1 px-1.5 py-0.5 border-none bg-transparent text-red-400 cursor-pointer rounded text-xs transition-all hover:bg-red-500/20"
                >
                  <span>🗑</span>
                </button>
              </div>
            </div>
          </div>
          
          <div class="reply-input-wrapper mt-3 flex gap-2 items-end">
            <MentionInput
              v-model="replyContent[message.id]"
              :placeholder="'回复 ' + message.sender_nickname"
              :rows="2"
              :maxLength="500"
              @mention-created="handleReplyMention"
            />
            <button
              @click="submitReply(message.id)"
              class="btn btn-primary btn-sm px-3 py-1 text-sm !bg-foreground/20 hover:!bg-white/30 text-white border border-foreground/30"
              :disabled="!replyContent[message.id]?.trim()"
            >
              回复
            </button>
          </div>
        </div>
      </div>
      
      <div
        v-if="messages.length > 3"
        @click="showAllMessagesModal = true"
        class="view-all-btn text-center py-3 text-blue-300 cursor-pointer transition-colors rounded-xl hover:bg-foreground/20 backdrop-blur-sm bg-foreground/10 border border-foreground/10"
      >
        查看全部 {{ messages.length }} 条留言
      </div>
      
      <div
        v-if="hasMore"
        @click="loadMore"
        class="load-more-btn text-center py-3 text-blue-300 cursor-pointer transition-colors rounded-xl hover:bg-foreground/20 backdrop-blur-sm bg-foreground/10 border border-foreground/10"
      >
        {{ loadingMore ? '加载中...' : '加载更多' }}
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showMessageModal" class="modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-[9999999]! p-5 backdrop-blur-sm isolate" @click.self="showMessageModal = false">
        <div class="modal-content !bg-transparent backdrop-blur-xl bg-foreground/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-foreground/20 shadow-xl z-[9999999]! relative">
        <div class="modal-header flex justify-between items-center p-4 border-b border-foreground/20">
          <h3 class="m-0 text-lg font-semibold text-white drop-shadow-md">写留言</h3>
          <button @click="showMessageModal = false" class="!bg-transparent !border-none modal-close cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-foreground/20 text-2xl text-foreground/70 hover:text-white">×</button>
        </div>
        
        <div class="modal-body p-5">
          <MentionInput
            v-model="newMessageContent"
            placeholder="写下你的留言..."
            :rows="5"
            :maxLength="1000"
            @mention-created="handleMessageMention"
          />
        </div>
        
        <div class="modal-footer flex justify-end gap-3 p-4 border-t border-foreground/20">
          <button
            @click="showMessageModal = false"
            class="btn btn-secondary px-4 py-2 text-sm font-medium !bg-foreground/20 hover:!bg-white/30 text-white border border-foreground/30"
          >
            取消
          </button>
          <button
            @click="submitMessage"
            class="btn btn-primary px-4 py-2 text-sm font-medium !bg-white/30 hover:!bg-white/40 text-white border border-foreground/30"
            :disabled="!newMessageContent.trim() || submitting"
          >
            {{ submitting ? '发送中...' : '发送' }}
          </button>
        </div>
      </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-[9999999]! p-5 backdrop-blur-sm isolate" @click.self="showDeleteConfirm = false">
        <div class="modal-content modal-sm !bg-transparent backdrop-blur-xl bg-foreground/10 rounded-2xl w-full max-w-md border border-foreground/20 shadow-xl z-[9999999]! relative">
        <div class="modal-header flex justify-between items-center p-4 border-b border-foreground/20">
          <h3 class="m-0 text-lg font-semibold text-white drop-shadow-md">确认删除</h3>
          <button @click="showDeleteConfirm = false" class="!bg-transparent !border-none modal-close cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-foreground/20 text-2xl text-foreground/70 hover:text-white">×</button>
        </div>
        
        <div class="modal-body p-5">
          <p class="m-0 text-foreground/90 leading-relaxed">确定要删除这条留言吗？</p>
        </div>
        
        <div class="modal-footer flex justify-end gap-3 p-4 border-t border-foreground/20">
          <button
            @click="showDeleteConfirm = false"
            class="!bg-transparent !border-none btn btn-secondary backdrop-blur-sm bg-foreground/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all text-white border border-foreground/30"
          >
            取消
          </button>
          <button
            @click="executeDelete"
            class="!bg-transparent !border-none btn btn-danger backdrop-blur-sm bg-red-500/30 hover:bg-red-500/40 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all text-white border border-red-500/30"
          >
            删除
          </button>
        </div>
      </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showAllMessagesModal" class="modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-[9999999]! p-5 backdrop-blur-sm isolate" @click.self="showAllMessagesModal = false">
        <div class="modal-content !bg-transparent backdrop-blur-xl bg-foreground/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-foreground/20 shadow-xl z-[9999999]! relative">
        <div class="modal-header flex justify-between items-center p-4 border-b border-foreground/20">
          <h3 class="m-0 text-lg font-semibold text-white drop-shadow-md">全部留言 ({{ messages.length }})</h3>
          <button @click="showAllMessagesModal = false" class="!bg-transparent !border-none modal-close cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-foreground/20 text-2xl text-foreground/70 hover:text-white">×</button>
        </div>
        
        <div class="modal-body p-5">
          <div class="all-messages-list flex flex-col gap-4">
            <div
              v-for="message in messages"
              :key="message.id"
              class="message-item bg-transparent rounded-xl p-4 backdrop-blur-xl bg-foreground/10 border border-foreground/20"
            >
              <div class="message-main flex gap-3">
                <div class="message-avatar-link flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" @click.stop="goToProfile(message.sender_username)">
                  <img
                    :src="getImageUrl(message.sender_avatar)"
                    :alt="message.sender_nickname"
                    class="message-avatar w-12 h-12 rounded-full object-cover"
                  />
                </div>
                
                <div class="message-content-wrapper flex-1 min-w-0">
                  <div class="message-header flex items-center gap-2 mb-2">
                    <div
                      class="message-author font-medium text-white cursor-pointer hover:text-blue-300 transition-colors"
                      @click.stop="goToProfile(message.sender_username)"
                    >
                      {{ message.sender_nickname }}
                    </div>
                    <span class="message-time text-xs text-foreground/60">{{ formatTime(message.created_at) }}</span>
                  </div>
                  
                  <div class="message-text text-foreground/80 leading-relaxed break-words mb-3" v-html="formatPostContent(message.content)"></div>
                  
                  <div class="message-actions flex gap-4">
                    <button
                      @click="toggleLike(message)"
                      class="message-action-btn flex items-center gap-1 px-2 py-1 border-none bg-transparent text-white cursor-pointer rounded text-sm transition-all hover:bg-foreground/20"
                      :class="{ 'text-red-400': message.is_liked }"
                    >
                      <span>{{ message.is_liked ? '❤️' : '🤍' }}</span>
                      <span class="font-medium">{{ message.like_count || 0 }}</span>
                    </button>
                    
                    <button
                      @click="toggleReplies(message.id)"
                      class="message-action-btn flex items-center gap-1 px-2 py-1 border-none bg-transparent text-white cursor-pointer rounded text-sm transition-all hover:bg-foreground/20"
                    >
                      <span>💬</span>
                      <span class="font-medium">{{ message.reply_count || 0 }}</span>
                    </button>
                    
                    <button
                      v-if="canDelete(message)"
                      @click="confirmDelete(message)"
                      class="message-action-btn delete-btn flex items-center gap-1 px-2 py-1 border-none bg-transparent text-red-400 cursor-pointer rounded text-sm transition-all hover:bg-red-500/20"
                    >
                      <span>🗑</span>
                    </button>
                  </div>
                </div>
              </div>

              <div
                v-if="expandedReplies.has(message.id) && message.replies && message.replies.length > 0"
                class="message-replies mt-4 pt-4 border-t border-foreground/20"
              >
                <div
                    v-for="reply in message.replies"
                    :key="reply.id"
                    class="reply-item flex gap-2.5 mb-3"
                  >
                    <div class="reply-avatar-link flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" @click.stop="goToProfile(reply.sender_username)">
                      <img
                        :src="getImageUrl(reply.sender_avatar)"
                        :alt="reply.sender_nickname"
                        class="reply-avatar w-8 h-8 rounded-full object-cover"
                      />
                    </div>
                    
                    <div class="reply-content-wrapper flex-1 min-w-0">
                      <div class="reply-header flex items-center gap-2 mb-1">
                        <div
                          class="reply-author font-medium text-white cursor-pointer hover:text-blue-300 transition-colors text-sm"
                          @click.stop="goToProfile(reply.sender_username)"
                        >
                        {{ reply.sender_nickname }}
                      </div>
                      <span class="reply-time text-xs text-foreground/60">{{ formatTime(reply.created_at) }}</span>
                    </div>
                    
                    <div class="reply-text text-foreground/80 leading-relaxed text-sm break-words mb-2" v-html="formatPostContent(reply.content)"></div>
                    
                    <div class="reply-actions flex gap-3">
                      <button
                        @click="toggleLike(reply, message.id)"
                        class="reply-action-btn flex items-center gap-1 px-1.5 py-0.5 border-none bg-transparent text-white cursor-pointer rounded text-xs transition-all hover:bg-foreground/20"
                        :class="{ 'text-red-400': reply.is_liked }"
                      >
                        <span>{{ reply.is_liked ? '❤️' : '🤍' }}</span>
                        <span class="font-medium">{{ reply.like_count || 0 }}</span>
                      </button>
                      
                      <button
                        v-if="canDelete(reply)"
                        @click="confirmDelete(reply)"
                        class="reply-action-btn delete-btn flex items-center gap-1 px-1.5 py-0.5 border-none bg-transparent text-red-400 cursor-pointer rounded text-xs transition-all hover:bg-red-500/20"
                      >
                        <span>🗑</span>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div class="reply-input-wrapper mt-3 flex gap-2 items-end">
                  <MentionInput
                    v-model="replyContent[message.id]"
                    :placeholder="'回复 ' + message.sender_nickname"
                    :rows="2"
                    :maxLength="500"
                    @mention-created="handleReplyMention"
                  />
                  <button
                    @click="submitReply(message.id)"
                    class="!bg-transparent !border-none btn btn-primary btn-sm backdrop-blur-sm bg-white/30 hover:bg-foreground/50 px-3 py-1 text-sm rounded text-white border border-foreground/30"
                    :disabled="!replyContent[message.id]?.trim()"
                  >
                    回复
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer flex justify-end p-4 border-t border-foreground/20">
          <button
            @click="showAllMessagesModal = false"
            class="btn btn-secondary px-4 py-2 text-sm font-medium !bg-foreground/20 hover:!bg-white/30 text-white border border-foreground/30"
          >
            关闭
          </button>
        </div>
      </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, Teleport } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import MentionInput from './MentionInput.vue';
import { formatPostContent } from '@/utils/contentRenderer';
import { getImageUrl } from '@/utils/imageUrl';

interface Message {
  id: number;
  profile_user_id: number;
  sender_id: number;
  parent_id: number | null;
  parent_sender_id?: number | null;
  sender_username: string;
  sender_nickname: string;
  sender_avatar: string | null;
  content: string;
  like_count: number;
  reply_count: number;
  is_liked: number;
  created_at: string;
  replies?: Message[];
}

interface Props {
  profileUserId: number;
}

const props = defineProps<Props>();

const router = useRouter();
const authStore = useAuthStore();

function goToProfile(username: string) {
  if (username) {
    router.push(`/profile/${username}`);
  }
}

const messages = ref<Message[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const page = ref(1);
const limit = 20;

const showMessageModal = ref(false);
const showAllMessagesModal = ref(false);
const showDeleteConfirm = ref(false);
const messageToDelete = ref<Message | null>(null);

const newMessageContent = ref('');
const submitting = ref(false);

const replyContent = ref<Record<number, string>>({});
const expandedReplies = ref<Set<number>>(new Set());

const currentUser = computed(() => authStore.user);

const displayMessages = computed(() => {
  return messages.value.slice(0, 3);
});

onMounted(() => {
  fetchMessages();
});

async function fetchMessages(append = false) {
  try {
    if (!append) {
      loading.value = true;
    } else {
      loadingMore.value = true;
    }

    const response = await api.get(`/guestbook/${props.profileUserId}`, {
      params: {
        page: page.value,
        limit
      }
    });

    const fetchedMessages = response.data.messages || [];
    
    if (append) {
      messages.value = [...messages.value, ...fetchedMessages];
    } else {
      messages.value = fetchedMessages;
    }

    hasMore.value = messages.value.length < response.data.total;
  } catch (error) {
    console.error('获取留言失败:', error);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function loadMore() {
  page.value++;
  fetchMessages(true);
}

async function submitMessage() {
  if (!newMessageContent.value.trim() || submitting.value) return;

  submitting.value = true;

  try {
    await api.post(`/guestbook/${props.profileUserId}`, {
      content: newMessageContent.value
    });

    showMessageModal.value = false;
    newMessageContent.value = '';
    
    page.value = 1;
    await fetchMessages();
  } catch (error) {
    console.error('发送留言失败:', error);
    alert('发送留言失败，请重试');
  } finally {
    submitting.value = false;
  }
}

async function submitReply(messageId: number) {
  const content = replyContent.value[messageId];
  if (!content?.trim()) return;

  try {
    await api.post(`/guestbook/${props.profileUserId}`, {
      content,
      parentId: messageId
    });

    replyContent.value[messageId] = '';
    
    page.value = 1;
    await fetchMessages();
  } catch (error) {
    console.error('回复失败:', error);
    alert('回复失败，请重试');
  }
}

async function toggleLike(message: Message, parentId?: number) {
  try {
    const response = await api.post(`/guestbook/${message.id}/like`);
    const liked = response.data.liked;
    
    if (parentId) {
      const parentMessage = messages.value.find(m => m.id === parentId);
      if (parentMessage && parentMessage.replies) {
        const reply = parentMessage.replies.find(r => r.id === message.id);
        if (reply) {
          reply.is_liked = liked ? 1 : 0;
          reply.like_count = liked ? (reply.like_count || 0) + 1 : (reply.like_count || 0) - 1;
        }
      }
    } else {
      message.is_liked = liked ? 1 : 0;
      message.like_count = liked ? (message.like_count || 0) + 1 : (message.like_count || 0) - 1;
    }
  } catch (error) {
    console.error('点赞失败:', error);
  }
}

function toggleReplies(messageId: number) {
  if (expandedReplies.value.has(messageId)) {
    expandedReplies.value.delete(messageId);
  } else {
    expandedReplies.value.add(messageId);
  }
}

function canDelete(message: Message): boolean {
  if (!currentUser.value) return false;
  return (
    message.sender_id === currentUser.value.id || 
    message.profile_user_id === currentUser.value.id ||
    message.parent_sender_id === currentUser.value.id
  );
}

function confirmDelete(message: Message) {
  messageToDelete.value = message;
  showDeleteConfirm.value = true;
}

async function executeDelete() {
  if (!messageToDelete.value) return;

  try {
    await api.delete(`/guestbook/${messageToDelete.value.id}`);
    
    // 如果删除的是主留言
    if (!messageToDelete.value.parent_id) {
      messages.value = messages.value.filter(m => m.id !== messageToDelete.value!.id);
    } else {
      // 如果删除的是回复
      const parentMessage = messages.value.find(m => m.id === messageToDelete.value!.parent_id);
      if (parentMessage && parentMessage.replies) {
        parentMessage.replies = parentMessage.replies.filter(r => r.id !== messageToDelete.value!.id);
        parentMessage.reply_count = (parentMessage.reply_count || 1) - 1;
      }
    }
    
    showDeleteConfirm.value = false;
    messageToDelete.value = null;
  } catch (error) {
    console.error('删除留言失败:', error);
    alert('删除失败，请重试');
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

function handleMessageMention(mentions: any[]) {
  console.log('留言提及:', mentions);
}

function handleReplyMention(mentions: any[]) {
  console.log('回复提及:', mentions);
}
</script>

<style scoped>
.profile-message-board {
  width: 100%;
}

.message-board-loading,
.message-board-empty {
  text-align: center;
  padding: 2.5rem 0;
  color: #6b7280;
}

.message-board-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-item {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 0.75rem;
  padding: 1rem;
  backdrop-filter: blur(0.25rem);
}

.message-main {
  display: flex;
  gap: 0.75rem;
}

.message-avatar-link {
  flex-shrink: 0;
  text-decoration: none;
}

.message-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  object-fit: cover;
}

.message-content-wrapper {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.message-author {
  font-weight: 500;
  color: #1f2937;
  text-decoration: none;
}

.message-author:hover {
  color: #3b82f6;
}

.message-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.message-text {
  color: #4b5563;
  line-height: 1.625;
  word-break: break-words;
  margin-bottom: 0.75rem;
}

.message-actions {
  display: flex;
  gap: 1rem;
}

.message-action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.message-action-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.message-action-btn.delete-btn {
  color: #ef4444;
}

.message-action-btn.delete-btn:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.message-replies {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 0.0625rem solid #e5e7eb;
}

.reply-item {
  display: flex;
  gap: 0.625rem;
  margin-bottom: 0.75rem;
}

.reply-avatar-link {
  flex-shrink: 0;
  text-decoration: none;
}

.reply-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
}

.reply-content-wrapper {
  flex: 1;
  min-width: 0;
}

.reply-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.reply-author {
  font-weight: 500;
  color: #1f2937;
  text-decoration: none;
  font-size: 0.875rem;
}

.reply-author:hover {
  color: #3b82f6;
}

.reply-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.reply-text {
  color: #4b5563;
  line-height: 1.5;
  font-size: 0.875rem;
  word-break: break-words;
  margin-bottom: 0.5rem;
}

.reply-actions {
  display: flex;
  gap: 0.75rem;
}

.reply-action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.reply-action-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.reply-action-btn.delete-btn {
  color: #ef4444;
}

.reply-action-btn.delete-btn:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.reply-input-wrapper {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  backdrop-filter: blur(0.25rem);
  isolation: isolate;
}

.modal-content {
  background-color: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(0.75rem);
  border-radius: 0.75rem;
  border: 0.0625rem solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 1.25rem 1.5625rem -0.3125rem rgba(0, 0, 0, 0.1);
  position: relative;
}

.modal-sm {
  max-width: 28rem;
  width: 100%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 0.0625rem solid rgba(255, 255, 255, 0.2);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.modal-close {
  background-color: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  transition: all 0.2s;
  font-size: 1.5rem;
  color: #6b7280;
}

.modal-close:hover {
  background-color: rgba(255, 255, 255, 0.3);
  color: #1f2937;
}

.modal-body {
  padding: 1.25rem;
}

.modal-body p {
  margin: 0;
  color: #374151;
  line-height: 1.625;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem;
  border-top: 0.0625rem solid rgba(255, 255, 255, 0.2);
}

.all-messages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 40rem) {
  .message-avatar {
    width: 2.5rem;
    height: 2.5rem;
  }

  .message-text {
    font-size: 0.875rem;
  }

  .message-action-btn {
    font-size: 0.75rem;
  }
}
</style>


