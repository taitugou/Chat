<template>
  <div class="min-h-screen pb-20 post-detail-page">
    <TopNav />

    <div class="max-w-4xl mx-auto px-4 py-4 sm:py-8 post-detail-container">
      <div class="flex items-center gap-4 mb-6 glass-card p-4">
        <button @click="goBackOneLevel" class="text-foreground/60 hover:text-white transition-colors">
          <span class="text-xl">←</span>
        </button>
        <h1 class="text-xl font-bold glass-text">帖子详情</h1>
      </div>

      <transition name="detail-fade" appear>
        <div v-if="loadingPost" class="glass-card mb-6 p-12 text-center">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p class="text-foreground/50">加载中...</p>
        </div>

        <div v-else-if="postError" class="glass-card mb-6 p-8 text-center">
          <div class="text-red-400 mb-4">{{ postError }}</div>
          <button class="glass-btn px-6 py-2" @click="fetchPostDetail">重试</button>
        </div>

        <div v-else-if="post" class="glass-card mb-6 overflow-hidden">
          <div class="p-4 sm:p-6">
            <div class="flex items-start justify-between mb-6">
              <div class="flex items-center gap-3 cursor-pointer" @click="goToProfile(post.username)">
                <img
                  :src="getImageUrl(post.avatar)"
                  :alt="post.nickname"
                  class="w-12 h-12 rounded-full border-2 border-foreground/10 hover:opacity-80 transition-opacity"
                />
                <div>
                  <div class="font-bold text-foreground/90 text-lg">{{ post.nickname }}</div>
                  <div class="text-xs text-foreground/40">@{{ post.username }} · {{ formatTime(post.created_at) }}</div>
                </div>
              </div>
              <div v-if="post.is_anonymous" class="glass-badge">匿名发布</div>
            </div>

            <div class="text-foreground/90 text-lg leading-relaxed mb-6 whitespace-pre-wrap break-words" v-html="formatPostContent(post.content)"></div>
            
            <!-- 引用卡片 -->
            <div 
              v-if="post.quote_type && post.quote_type !== 'none'" 
              class="glass rounded-2xl p-4 mb-6 border-l-4 border-primary/50 cursor-pointer hover:bg-foreground/5 transition-colors"
              @click="handleQuoteClick(post.quote_type, post.quote_id)"
            >
              <div class="flex items-center gap-2 mb-2" @click.stop="goToProfile(post.quote_user_username || '')">
                <img
                  :src="getImageUrl(post.quote_user_avatar)"
                  :alt="post.quote_user_name"
                  class="w-6 h-6 rounded-full border border-foreground/10"
                />
                <span class="text-sm font-bold text-foreground/80 hover:text-primary transition-colors">{{ post.quote_user_name }}</span>
              </div>
              <div class="text-sm text-foreground/60 line-clamp-3">
                {{ post.quote_content }}
              </div>
            </div>
            
            <!-- 标签 -->
            <div v-if="post.tags && post.tags.length > 0" class="mb-6 flex flex-wrap gap-2">
              <span
                v-for="(tag, index) in post.tags"
                :key="index"
                class="glass-badge px-3 py-1 text-xs"
              >
                #{{ tag }}
              </span>
            </div>
            
            <!-- 图片网格 -->
            <div v-if="post.images && post.images.length > 0" class="mb-6">
              <div v-if="post.images.length === 1" class="flex justify-center">
                <img
                  :src="getImageUrl(post.images[0])"
                  alt="帖子图片"
                  class="max-w-full max-h-[30rem] object-contain rounded-2xl border border-foreground/10 cursor-pointer hover:opacity-95 transition-opacity"
                  @click="previewImage(post.images[0], post)"
                />
              </div>
              <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <img
                  v-for="(img, index) in post.images"
                  :key="index"
                  :src="getImageUrl(img)"
                  alt="帖子图片"
                  class="w-full aspect-square object-cover rounded-xl border border-foreground/10 cursor-pointer hover:opacity-90 transition-opacity"
                  @click="previewImage(img, post)"
                />
              </div>
            </div>

            <!-- 文件链接 -->
            <div v-if="post.file_url" class="mb-6">
              <a 
                :href="getImageUrl(post.file_url)" 
                :download="post.file_url.split('/').pop().split('_').slice(2).join('_') || 'download'"
                class="flex items-center gap-4 glass p-4 rounded-2xl border border-foreground/10 hover:bg-foreground/5 transition-all group"
                @click.stop
              >
                <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-bold text-foreground/90 truncate">{{ post.file_url.split('/').pop().split('_').slice(2).join('_') || '查看文件附件' }}</div>
                  <div class="text-[10px] text-foreground/30 uppercase tracking-widest font-black mt-1">Download Attachment</div>
                </div>
                <div class="text-foreground/20 group-hover:text-primary transition-colors">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </a>
            </div>
            
            <!-- 投票内容 -->
            <div v-if="post.poll_info && post.poll_info.options && post.poll_info.options.length >= 2" class="mb-6 p-6 glass rounded-2xl border border-foreground/10">
              <h3 class="text-lg font-bold mb-4 glass-text flex items-center gap-2">
                <span>📊</span> 投票调查
              </h3>
              <div class="space-y-4">
                <div
                  v-for="(option, index) in post.poll_info.options"
                  :key="index"
                  class="group relative p-4 rounded-xl border border-foreground/10 cursor-pointer overflow-hidden transition-all hover:border-primary/50"
                  @click="handleVote(index as number)"
                >
                  <div 
                    class="absolute inset-0 bg-primary/10 transition-all duration-500" 
                    :style="{ width: `${calculateOptionPercentage(index as number)}%` }"
                  ></div>
                  <div class="relative flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div v-if="hasVotedFor(index)" class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      <span class="text-white font-medium">{{ option }}</span>
                    </div>
                    <span class="text-foreground/60 font-bold">{{ calculateOptionPercentage(index as number) }}%</span>
                  </div>
                </div>
              </div>
              <div class="mt-6 flex items-center justify-between text-xs text-foreground/40">
                <div class="flex gap-4">
                  <span>总计 {{ post.poll_info.total_votes }} 票</span>
                  <span>{{ post.poll_info.type === 'single' ? '单选' : '多选' }}</span>
                </div>
                <button 
                  v-if="hasVoted()"
                  @click="cancelVote"
                  class="text-red-400 hover:underline"
                >
                  取消我的投票
                </button>
              </div>
            </div>
            
            <!-- 帖子交互 -->
            <div class="flex items-center justify-between pt-6 border-t border-foreground/5">
              <div class="flex items-center gap-6 text-foreground/40">
                <button 
                  @click="toggleLike(post)" 
                  class="flex items-center gap-2 hover:text-red-500 transition-all"
                  :class="{ 'text-red-500': post.isLiked }"
                >
                  <span class="text-2xl">{{ post.isLiked ? '❤️' : '🤍' }}</span>
                  <span class="font-bold">{{ post.like_count || 0 }}</span>
                </button>
                <button class="flex items-center gap-2 hover:text-blue-400 transition-all">
                  <span class="text-2xl">💬</span>
                  <span class="font-bold">{{ post.comment_count || 0 }}</span>
                </button>
                <button @click="handleShare(post)" class="flex items-center gap-2 hover:text-green-400 transition-all">
                  <span class="text-2xl">🔗</span>
                  <span class="font-bold">{{ post.share_count || 0 }}</span>
                </button>
                <button @click="openQuoteModal(post)" class="flex items-center gap-2 hover:text-primary transition-all">
                  <span class="text-2xl">📋</span>
                </button>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-1.5 text-foreground/30 text-sm">
                  <span class="text-xl">👁️</span>
                  <span>{{ post.view_count || 0 }}</span>
                </div>
                <button 
                  v-if="authStore.user && authStore.user.id === post.user_id" 
                  @click="deletePost(post)" 
                  class="p-2 text-foreground/20 hover:text-red-500 transition-colors"
                >
                  <span class="text-xl">🗑️</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="glass-card mb-6 p-8 text-center">
          <p class="text-foreground/50">帖子不存在或已被删除</p>
        </div>
      </transition>

      <!-- 评论区 -->
      <div class="glass-card overflow-hidden">
        <div class="p-4 border-b border-foreground/5 bg-white/2">
          <h2 class="text-lg font-bold glass-text">评论 ({{ post?.comment_count || 0 }})</h2>
        </div>
        
        <!-- 发表评论 -->
        <div class="p-4 border-b border-foreground/5 bg-white/2">
          <div class="flex items-start gap-3">
            <img
              :src="getImageUrl(authStore.user?.avatar)"
              :alt="authStore.user?.nickname"
              class="w-10 h-10 rounded-full border border-foreground/10 flex-shrink-0"
            />
            <div class="flex-1">
              <MentionInput
                v-model="commentInput"
                placeholder="写下你的想法..."
                :rows="2"
                :max-length="500"
              />
              <div class="flex justify-between items-center mt-3">
                <div class="flex items-center gap-4">
                  <label class="flex items-center gap-2 cursor-pointer group">
                    <input v-model="isAnonymous" type="checkbox" class="accent-primary w-4 h-4" />
                    <span class="text-sm text-foreground/40 group-hover:text-foreground/60 transition-colors">匿名</span>
                  </label>
                  <span class="text-xs text-foreground/30 font-mono">{{ commentInput.length }}/500</span>
                </div>
                <button
                  @click="submitComment"
                  class="glass-btn-primary px-8 py-2 font-bold"
                  :disabled="!commentInput?.trim() || submittingComment"
                >
                  {{ submittingComment ? '发送中...' : '发送' }}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 评论列表 -->
        <div v-if="showComments" class="divide-y divide-white/5">
          <div v-if="loadingComments" class="py-12 text-center">
            <div class="animate-spin h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
          
          <template v-else>
            <div
              v-for="comment in comments"
              :key="comment.id"
              class="p-4 sm:p-6 hover:bg-white/[0.02] transition-colors"
            >
              <div class="flex items-start gap-3">
                <img
                  :src="getImageUrl(comment.avatar)"
                  :alt="comment.nickname"
                  class="w-10 h-10 rounded-full border border-foreground/10 flex-shrink-0 cursor-pointer"
                  @click="goToProfile(comment.username)"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <div class="font-bold text-foreground/90 hover:text-primary transition-colors cursor-pointer" @click="goToProfile(comment.username)">{{ comment.nickname }}</div>
                    <div class="text-xs text-foreground/30">{{ formatTime(comment.created_at) }}</div>
                  </div>
                  <div class="text-foreground/80 text-sm leading-relaxed mb-3" v-html="formatPostContent(comment.content)"></div>
                  
                  <!-- 评论操作 -->
                  <div class="flex items-center gap-6 text-foreground/40 text-xs">
                    <button 
                      @click="toggleCommentLike(comment)"
                      class="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                      :class="{ 'text-red-500': comment.isLiked }"
                    >
                      <span>{{ comment.isLiked ? '❤️' : '🤍' }}</span>
                      <span class="font-bold">{{ comment.like_count || 0 }}</span>
                    </button>
                    <button 
                      @click="toggleReplyForm(comment.id)"
                      class="hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <span>💬</span>
                      <span>回复</span>
                    </button>
                    <button
                      v-if="comment.reply_count > 0"
                      @click="toggleReplies(comment.id)"
                      class="text-primary hover:underline"
                    >
                      {{ showAllReplies[comment.id] ? '收起回复' : `查看 ${comment.reply_count} 条回复` }}
                    </button>
                  </div>
                  
                  <!-- 回复输入 -->
                  <div v-if="replyFormVisible[comment.id]" class="mt-4 p-4 glass rounded-2xl border border-foreground/10">
                    <MentionInput
                      v-model="replyInputs[comment.id]"
                      placeholder="回复评论..."
                      :rows="2"
                      :max-length="200"
                    />
                    <div class="flex justify-between items-center mt-3">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input v-model="replyAnonymous[comment.id]" type="checkbox" class="accent-primary w-4 h-4" />
                        <span class="text-xs text-foreground/40">匿名</span>
                      </label>
                      <div class="flex gap-2">
                        <button @click="cancelReply(comment.id)" class="px-4 py-1.5 text-xs text-foreground/40 hover:text-white transition-colors">取消</button>
                        <button
                          @click="submitReply(comment.id)"
                          class="glass-btn-primary px-6 py-1.5 text-xs font-bold"
                          :disabled="!replyInputs[comment.id]?.trim() || submittingReply"
                        >
                          提交
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <!-- 子回复列表 -->
                  <div v-if="comment.replies?.length > 0" class="mt-4 space-y-4 pl-4 border-l-2 border-foreground/5">
                    <div v-for="reply in comment.replies" :key="reply.id" class="group">
                      <div class="flex items-start gap-2">
                        <img
                          :src="getImageUrl(reply.avatar)"
                          :alt="reply.nickname"
                          class="w-8 h-8 rounded-full border border-foreground/10 flex-shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-0.5">
                            <span class="font-bold text-foreground/80 text-xs">{{ reply.nickname }}</span>
                            <span v-if="reply.reply_to_nickname" class="text-[10px] text-foreground/30">回复 {{ reply.reply_to_nickname }}</span>
                            <span class="text-[10px] text-foreground/20 ml-auto">{{ formatTime(reply.created_at) }}</span>
                          </div>
                          <div class="text-foreground/70 text-xs leading-relaxed" v-html="formatPostContent(reply.content)"></div>
                          <div class="flex items-center gap-4 mt-2 text-[10px] text-foreground/30">
                            <button 
                              @click="toggleCommentLike(reply)"
                              class="hover:text-red-500"
                              :class="{ 'text-red-500': reply.isLiked }"
                            >
                              {{ reply.isLiked ? '❤️' : '🤍' }} {{ reply.like_count || 0 }}
                            </button>
                            <button @click="toggleReplyForm(comment.id)" class="hover:text-primary">回复</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          
          <div v-if="!loadingComments && comments.length === 0" class="py-20 text-center text-foreground/30">
            <div class="text-4xl mb-4">💬</div>
            <p>暂无评论，快来抢沙发吧！</p>
          </div>
        </div>
      </div>
    </div>

    <BottomNav />

    <!-- 图片预览 -->
    <ImagePreview 
      v-model="showImagePreview" 
      :image-url="previewImageUrl"
      :show-like="!!previewingPost"
      :is-liked="previewingPost?.isLiked"
      :like-count="previewingPost?.like_count"
      @like="previewingPost && toggleLike(previewingPost)"
    />

    <!-- 引用弹窗 -->
    <transition name="modal-fade">
      <div v-if="showPostModal" class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" @click="showPostModal = false">
        <div class="glass-card w-full max-w-2xl overflow-hidden" @click.stop>
          <div class="p-4 border-b border-foreground/10 flex items-center justify-between">
            <h2 class="text-xl font-bold glass-text">发布引用</h2>
            <button @click="showPostModal = false" class="text-foreground/40 hover:text-white text-2xl">×</button>
          </div>
          <div class="p-6 space-y-6">
            <div v-if="quoteTarget" class="p-4 glass rounded-2xl border border-primary/20 bg-primary/5">
              <div class="text-xs text-primary/60 font-bold mb-2 uppercase tracking-widest">正在引用</div>
              <div class="text-sm text-foreground/70 line-clamp-2 italic">"{{ quoteTarget.content }}"</div>
            </div>
            
            <MentionInput
              v-model="postContent"
              placeholder="对原帖有什么评价？"
              :rows="4"
              :max-length="1000"
            />
            
            <div class="flex items-center justify-between">
              <span class="text-xs text-foreground/30 font-mono">{{ postContent.length }}/1000</span>
              <div class="flex gap-3">
                <button @click="showPostModal = false" class="glass-btn px-6 py-2">取消</button>
                <button 
                  @click="submitQuotedPost" 
                  class="glass-btn-primary px-10 py-2 font-bold"
                  :disabled="!postContent.trim() || posting"
                >
                  {{ posting ? '发布中...' : '发布' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';
import { formatPostContent } from '@/utils/contentRenderer';
import MentionInput from '@/components/MentionInput.vue';
import TopNav from '@/components/TopNav.vue';
import ImagePreview from '@/components/ImagePreview.vue';
import BottomNav from '@/components/BottomNav.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push('/posts');
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}

const post = ref<any>(null);
const loadingPost = ref(false);
const postError = ref('');
const comments = ref<any[]>([]);
const commentsError = ref('');
const commentInput = ref('');
const showComments = ref(true);
const loadingComments = ref(false);
const submittingComment = ref(false);
const submittingReply = ref(false);

const isAnonymous = ref(false);
const replyAnonymous = ref<Record<number, boolean>>({});

const replyFormVisible = ref<Record<number, boolean>>({});
const replyInputs = ref<Record<number, string>>({});
const showAllReplies = ref<Record<number, boolean>>({});

const showImagePreview = ref(false);
const previewImageUrl = ref('');
const previewingPost = ref<any>(null);

const showPostModal = ref(false);
const postContent = ref('');
const posting = ref(false);
const quoteTarget = ref<{
  id: number;
  type: 'post' | 'comment' | 'topic_comment' | 'topic';
  content: string;
  userId?: number;
  userName?: string;
  userAvatar?: string;
} | null>(null);

function openQuoteModal(post: any) {
  quoteTarget.value = {
    id: post.id,
    type: 'post',
    content: post.content,
    userId: post.user_id,
    userName: post.nickname,
    userAvatar: post.avatar
  };
  showPostModal.value = true;
}


async function submitQuotedPost() {
  if (!authStore.isAuthenticated) {
    alert('请先登录');
    return;
  }

  if (!postContent.value.trim() || !quoteTarget.value) return;

  posting.value = true;
  try {
    const formData = new FormData();
    formData.append('content', postContent.value);
    formData.append('quote_type', quoteTarget.value.type);
    formData.append('quote_id', quoteTarget.value.id.toString());
    formData.append('quote_content', quoteTarget.value.content);
    formData.append('quote_user_id', quoteTarget.value.userId?.toString() || '');
    formData.append('quote_user_name', quoteTarget.value.userName || '');
    formData.append('quote_user_avatar', quoteTarget.value.userAvatar || '');
    formData.append('visibility', 'public');
    formData.append('post_type', 'text');

    await api.post('/posts', formData);
    
    postContent.value = '';
    showPostModal.value = false;
    quoteTarget.value = null;
    alert('发布成功');
    router.push('/posts');
  } catch (error: any) {
    console.error('发布引用帖子失败:', error);
    alert('发布失败，请重试');
  } finally {
    posting.value = false;
  }
}

function previewImage(imgUrl: string, postObj?: any) {
  previewImageUrl.value = getImageUrl(imgUrl);
  previewingPost.value = postObj || null;
  showImagePreview.value = true;
}

async function fetchPostDetail() {
  loadingPost.value = true;
  postError.value = '';
  try {
    const postId = route.params.id;
    const response = await api.get(`/posts/${postId}`);
    post.value = response.data.post;
  } catch (error: any) {
    console.error('获取帖子详情失败:', error);
    post.value = null;
    postError.value = error?.response?.data?.error || error?.response?.data?.message || '获取帖子详情失败，请稍后重试';
  } finally {
    loadingPost.value = false;
  }
}

async function fetchComments() {
  loadingComments.value = true;
  commentsError.value = '';
  try {
    const postId = route.params.id;
    const response = await api.get(`/posts/${postId}/comments`);
    comments.value = response.data.comments || [];
    
    for (const comment of comments.value) {
      if (comment.reply_count > 0) {
        await fetchReplies(comment.id, 3);
        showAllReplies.value[comment.id] = comment.reply_count > 3;
      }
    }
  } catch (error: any) {
    console.error('获取评论失败:', error);
    console.error('错误详情:', error.response?.data || error.message);
    comments.value = [];
    commentsError.value = error?.response?.data?.error || error?.response?.data?.message || '获取评论失败，请稍后重试';
  } finally {
    loadingComments.value = false;
  }
}

async function fetchReplies(commentId: number, limit: number = 20) {
  try {
    const postId = route.params.id;
    const response = await api.get(`/posts/${postId}/comments/${commentId}/replies?limit=${limit}`);
    const comment = comments.value.find(c => c.id === commentId);
    if (comment) {
      comment.replies = response.data.replies || [];
    }
  } catch (error: any) {
    console.error('获取回复失败:', error);
  }
}


async function toggleReplies(commentId: number) {
  const comment = comments.value.find(c => c.id === commentId);
  if (!comment) return;
  
  if (showAllReplies.value[commentId]) {
    showAllReplies.value[commentId] = false;
    await fetchReplies(commentId, 3);
  } else {
    await fetchReplies(commentId, 50);
    showAllReplies.value[commentId] = true;
  }
}

async function submitComment() {
  if (!authStore.isAuthenticated) {
    alert('请先登录');
    return;
  }

  if (!commentInput.value.trim()) return;

  submittingComment.value = true;
  try {
    const postId = route.params.id;
    await api.post(`/posts/${postId}/comment`, { 
      content: commentInput.value,
      is_anonymous: isAnonymous.value
    });
    
    commentInput.value = '';
    await fetchComments();
    await fetchPostDetail();
    
    showComments.value = true;
  } catch (error: any) {
    console.error('提交评论失败:', error);
    alert('提交评论失败，请重试');
  } finally {
    submittingComment.value = false;
  }
}

function toggleReplyForm(commentId: number) {
  replyFormVisible.value[commentId] = !replyFormVisible.value[commentId];
  if (replyFormVisible.value[commentId]) {
    replyInputs.value[commentId] = '';
  }
}

function cancelReply(commentId: number) {
  replyFormVisible.value[commentId] = false;
  replyInputs.value[commentId] = '';
}

async function submitReply(commentId: number) {
  if (!authStore.isAuthenticated) {
    alert('请先登录');
    return;
  }

  const content = replyInputs.value[commentId]?.trim();
  if (!content) return;

  submittingReply.value = true;
  try {
    const postId = route.params.id;
    await api.post(`/posts/${postId}/comment`, { 
      content,
      parentId: commentId,
      is_anonymous: replyAnonymous.value[commentId] || false
    });
    
    replyInputs.value[commentId] = '';
    replyFormVisible.value[commentId] = false;
    
    await fetchComments();
  } catch (error: any) {
    console.error('提交回复失败:', error);
    alert('提交回复失败，请重试');
  } finally {
    submittingReply.value = false;
  }
}

async function toggleLike(post: any) {
  try {
    const response = await api.post(`/posts/${post.id}/like`);
    post.isLiked = response.data.liked;
    post.like_count = response.data.liked ? (post.like_count || 0) + 1 : Math.max(0, (post.like_count || 0) - 1);
  } catch (error: any) {
    console.error('点赞失败:', error);
  }
}

async function toggleCommentLike(comment: any) {
  if (!authStore.isAuthenticated) {
    alert('请先登录');
    return;
  }
  try {
    const postId = route.params.id;
    const response = await api.post(`/posts/${postId}/comment/${comment.id}/like`);
    comment.isLiked = response.data.liked;
    comment.like_count = response.data.liked ? (comment.like_count || 0) + 1 : Math.max(0, (comment.like_count || 0) - 1);
  } catch (error: any) {
    console.error('点赞评论失败:', error);
  }
}

function handleQuoteClick(quoteType: string, quoteId: number) {
  if (quoteType === 'topic') {
    router.push(`/topic/${quoteId}`);
  } else {
    router.push(`/post/${quoteId}`);
  }
}

async function handleShare(post: any) {
  try {
    await api.post(`/posts/${post.id}/share`, { content: '' });
    post.share_count = (post.share_count || 0) + 1;
    await fetchPostDetail();
    alert('分享成功');
  } catch (error: any) {
    console.error('分享失败:', error);
    if (error.response?.data?.error) {
      alert(`分享失败: ${error.response.data.error}`);
    } else {
      alert('分享失败，请重试');
    }
  }
}

async function deletePost(post: any) {
  if (confirm('确定要删除这条帖子吗？')) {
    try {
      await api.delete(`/posts/${post.id}`);
      await fetchPostDetail();
      router.push('/');
    } catch (error: any) {
      console.error('删除帖子失败:', error);
      if (error.response?.data?.error) {
        alert(`删除失败: ${error.response.data.error}`);
      } else {
        alert('删除失败，请重试');
      }
    }
  }
}

function formatTime(time: string) {
  const date = new Date(time);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // 处理未来时间 (如投票截止日期)
  if (diff < 0) {
    const futureDiff = Math.abs(diff);
    const minutes = Math.floor(futureDiff / 60000);
    const hours = Math.floor(futureDiff / 3600000);
    const days = Math.floor(futureDiff / 86400000);
    
    if (minutes < 1) return '即将截止';
    if (minutes < 60) return `${minutes}分钟后截止`;
    if (hours < 24) return `${hours}小时后截止`;
    if (days < 7) return `${days}天后截止`;
    return date.toLocaleDateString() + ' 截止';
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString();
}



async function handleVote(optionIndex: number) {
  try {
    const postId = route.params.id;
    await api.post(`/posts/${postId}/vote`, { option_index: optionIndex });
    await fetchPostDetail();
  } catch (error: any) {
    console.error('投票失败:', error);
    alert('投票失败，请重试');
  }
}

function hasVoted(): boolean {
  if (!authStore.user || !post.value.poll_info || !post.value.poll_info.votes) {
    return false;
  }
  
  const userId = authStore.user.id;
  return post.value.poll_info.votes[userId] !== undefined && 
         Array.isArray(post.value.poll_info.votes[userId]) && 
         post.value.poll_info.votes[userId].length > 0;
}

function hasVotedFor(optionIndex: number): boolean {
  if (!authStore.user || !post.value.poll_info || !post.value.poll_info.votes) {
    return false;
  }
  
  const userId = authStore.user.id;
  const userVotes = post.value.poll_info.votes[userId];
  return Array.isArray(userVotes) && userVotes.includes(optionIndex);
}

async function cancelVote() {
  if (!authStore.user) {
    alert('请先登录后再取消投票');
    return;
  }
  
  try {
    const userId = authStore.user.id;
    const userVotes = post.value.poll_info.votes[userId];
    
    if (!userVotes || !Array.isArray(userVotes) || userVotes.length === 0) {
      return;
    }
    
    for (const optionIndex of [...userVotes]) {
      await api.post(`/posts/${post.value.id}/vote`, { option_index: optionIndex });
    }
    
    await fetchPostDetail();
    alert('已取消投票');
  } catch (error: any) {
    console.error('取消投票失败:', error);
    alert('取消投票失败，请重试');
  }
}

function calculateOptionPercentage(optionIndex: number): number {
  if (!post.value.poll_info || post.value.poll_info.total_votes === 0) {
    return 0;
  }
  
  const optionVotes = calculateOptionVotes(optionIndex);
  return Math.round((optionVotes / post.value.poll_info.total_votes) * 100);
}

function calculateOptionVotes(optionIndex: number): number {
  if (!post.value.poll_info || !post.value.poll_info.votes) {
    return 0;
  }
  
  const votes = post.value.poll_info.votes;
  let optionVotes = 0;
  
  for (const userVotes of Object.values(votes)) {
    if (Array.isArray(userVotes) && userVotes.includes(optionIndex)) {
      optionVotes++;
    }
  }
  
  return optionVotes;
}

onMounted(async () => {
  await fetchPostDetail();
  if (post.value) {
    await fetchComments();
  }
});
</script>

<style scoped>
.detail-fade-enter-active {
  transition: all 0.5s ease;
}

.detail-fade-enter-from {
  opacity: 0;
  transform: translateY(1.875rem) scale(0.95);
}

.comment-fade-enter-active,
.comment-fade-leave-active {
  transition: all 0.3s ease;
}

.comment-fade-enter-from {
  opacity: 0;
  transform: translateY(1.25rem);
}

.comment-fade-leave-to {
  opacity: 0;
  transform: translateY(-1.25rem);
}

.comment-item-enter-active {
  transition: all 0.4s ease;
}

.comment-item-enter-from {
  opacity: 0;
  transform: translateX(-1.25rem);
}

@keyframes heartbeat {
  0%, 100% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.3);
  }
  50% {
    transform: scale(1);
  }
  75% {
    transform: scale(1.2);
  }
}

.animate-heartbeat {
  animation: heartbeat 0.6s ease-in-out;
}

.post-detail-page {
  overflow-x: hidden;
}

.post-detail-card-body {
  padding: 1rem;
}

.post-detail-page .rich-text-content {
  overflow-wrap: anywhere;
  word-break: break-word;
}

@media (max-width: 640px) {
  .post-detail-container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .post-detail-card,
  .post-detail-comments-card {
    border-radius: 0;
  }
}
</style>

