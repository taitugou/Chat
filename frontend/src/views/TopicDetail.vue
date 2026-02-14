<template>
  <div class="min-h-screen pb-20">
    <TopNav title="话题详情" />

    <div class="max-w-4xl mx-auto px-4 py-4 sm:py-6 lg:py-8">
      <!-- 话题信息卡片 -->
      <div v-if="topic" class="ios-card mb-4 sm:mb-6 overflow-hidden">
        <!-- 话题封面 -->
        <div v-if="topic.cover_image" class="relative h-48 sm:h-56 lg:h-64 cursor-pointer overflow-hidden group" @click="previewImage(getImageUrl(topic.cover_image), topic)">
          <img
            :src="getImageUrl(topic.cover_image)"
            :alt="topic.title"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
          <div v-if="topic.is_hot" class="absolute top-2 sm:top-4 right-2 sm:right-4 bg-red-500 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full">
            热门
          </div>
          <div v-if="topic.is_top" class="absolute top-2 sm:top-4 left-2 sm:left-4 bg-ios-blue text-white text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full">
            置顶
          </div>
        </div>
        
        <!-- 话题内容 -->
        <div class="p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
            <div class="flex items-center gap-3">
              <div @click.stop="goToProfile(topic.username)" class="cursor-pointer">
                <img
                  :src="getImageUrl(topic.avatar)"
                  :alt="topic.nickname"
                  class="w-10 h-10 sm:w-12 sm:h-12 rounded-full hover:opacity-80 transition-opacity ring-2 ring-foreground/10"
                  :class="{ 'bg-gray-800': !topic.avatar }"
                />
              </div>
              <div>
                <div @click.stop="goToProfile(topic.username)" class="font-semibold text-sm sm:text-base cursor-pointer hover:text-ios-blue transition-colors text-ios-label-primary">{{ topic.nickname }}</div>
                <div class="text-xs sm:text-sm text-ios-label-secondary">{{ formatTime(topic.created_at) }}</div>
              </div>
            </div>
            <button
              @click="toggleFollow"
              class="px-3 sm:px-4 py-2 rounded-full text-sm sm:text-sm font-medium transition-all active:scale-95 min-h-[var(--tap-target)]"
              :class="topic.isFollowed ? 'ios-glass' : 'ios-btn-primary'"
            >
              {{ topic.isFollowed ? '已关注' : '+ 关注' }}
            </button>
          </div>
          
          <h2 class="text-xl sm:text-2xl font-bold mb-3 text-ios-label-primary">{{ topic.title }}</h2>
          <div v-if="topic.description" class="text-ios-label-primary text-sm sm:text-base mb-4 post-content" v-html="formatPostContent(topic.description)">
          </div>
          
          <!-- 话题标签 -->
          <div v-if="topic.tags && topic.tags.length > 0" class="flex flex-wrap gap-1 sm:gap-2 mb-4">
            <span
              v-for="(tag, index) in topic.tags"
              :key="index"
              class="text-xs sm:text-sm ios-glass text-blue-300 px-2 sm:px-3 py-1 rounded-full"
            >
              #{{ tag }}
            </span>
          </div>
          
          <!-- 话题统计 -->
          <div class="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-ios-label-secondary border-t border-ios-separator pt-4">
            <div class="flex items-center gap-1">
              <span class="text-sm sm:text-base">👁️</span>
              <span>{{ topic.view_count || 0 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-sm sm:text-base">💬</span>
              <span>{{ topic.post_count || 0 }}</span>
            </div>
            <button 
              @click="toggleTopicLike"
              class="flex items-center gap-1 hover:text-red-500 transition-colors"
            >
              <span class="text-sm sm:text-base">{{ topic.isLiked ? '❤️' : '🤍' }}</span>
              <span>{{ topic.like_count || 0 }}</span>
            </button>
            <button
              @click="openQuoteTopicModal"
              class="flex items-center gap-1 hover:text-ios-blue transition-colors"
              title="引用此话题"
            >
              <span class="text-sm sm:text-base">📋</span>
            </button>
            <button
              v-if="authStore.user && authStore.user.id === topic.user_id"
              @click="deleteTopic"
              class="flex items-center gap-1 hover:text-red-500 transition-colors ml-auto"
            >
              <span class="text-sm sm:text-base">🗑️</span>
              <span class="text-xs sm:text-sm">删除话题</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 帖子列表 -->
      <div class="ios-card overflow-hidden">
        <div class="flex items-center justify-between mb-4 px-4 pt-4">
          <h2 class="text-lg sm:text-xl font-bold text-ios-label-primary">相关评论</h2>
          <span class="text-xs sm:text-sm text-ios-label-secondary">{{ comments.length }} 条评论</span>
        </div>
        
        <!-- 发表评论按钮 -->
        <div class="px-4 pb-4 border-b border-ios-separator">
          <button
            @click="showPostModal = true"
            class="w-full ios-btn-primary min-h-[var(--tap-target)] transition-all active:scale-[0.98]"
          >
            ✍️ 发表评论
          </button>
        </div>
        
        <!-- 加载状态 -->
        <div v-if="loadingPosts" class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-ios-blue"></div>
        </div>
        
        <!-- 评论列表 -->
        <div v-else-if="comments.length > 0" class="divide-y divide-ios-separator">
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="p-3 sm:p-4 hover:bg-ios-systemGray5 transition-colors"
          >
            <div class="flex items-start gap-3">
              <div @click.stop="goToProfile(comment.username)" class="cursor-pointer">
                <img
                  :src="getImageUrl(comment.avatar)"
                  :alt="comment.nickname"
                  class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0 hover:opacity-80 transition-opacity ring-1 ring-foreground/10"
                  :class="{ 'bg-gray-800': !comment.avatar }"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-2">
                  <div @click.stop="goToProfile(comment.username)" class="font-medium text-sm sm:text-base cursor-pointer hover:text-ios-blue transition-colors text-ios-label-primary">{{ comment.nickname }}</div>
                  <div class="text-xs sm:text-sm text-ios-label-tertiary flex-shrink-0">{{ formatTime(comment.created_at) }}</div>
                </div>

                <!-- 评论的引用卡片 -->
                <div 
                  v-if="comment.quote_id" 
                  class="ios-glass rounded-lg p-3 mt-2 mb-3 border-l-4 border-ios-blue cursor-pointer hover:bg-ios-systemGray5 transition-colors"
                  @click="$router.push(`/post/${comment.quote_id}`)"
                >
                  <div class="flex items-center gap-1 mb-1">
                    <span class="text-xs font-medium text-ios-label-secondary">{{ comment.quote_user_name }}</span>
                  </div>
                  <p class="text-xs text-ios-label-tertiary line-clamp-2">{{ comment.quote_content }}</p>
                </div>

                <div class="text-ios-label-primary text-sm sm:text-base mb-3 post-content" v-html="formatPostContent(comment.content)"></div>

                <!-- 图片网格 -->
                <div v-if="comment.images && comment.images.length > 0" class="mb-3 rounded-xl overflow-hidden border border-ios-separator bg-ios-systemGray5">
                  <div 
                    class="grid gap-1"
                    :class="{
                      'grid-cols-1': comment.images.length === 1,
                      'grid-cols-2': comment.images.length === 2,
                      'grid-cols-2 sm:grid-cols-3': comment.images.length >= 3
                    }"
                  >
                    <div 
                      v-for="(img, idx) in comment.images" 
                      :key="idx"
                      class="aspect-square relative group/img overflow-hidden bg-ios-systemGray5"
                      @click.stop="previewImage(getImageUrl(img), comment)"
                    >
                      <img 
                        :src="getImageUrl(img)" 
                        class="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>

                <!-- 文件链接 -->
                <div v-if="comment.file_url" class="mb-3">
                  <a 
                    :href="getImageUrl(comment.file_url)" 
                    :download="comment.file_url.split('/').pop().split('_').slice(2).join('_') || 'download'"
                    class="flex items-center gap-3 ios-glass p-3 rounded-xl border border-ios-separator hover:bg-ios-systemGray5 transition-all group"
                    @click.stop
                  >
                    <div class="w-10 h-10 rounded-lg bg-ios-blue/10 flex items-center justify-center text-ios-blue group-hover:scale-110 transition-transform">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-bold text-ios-label-primary truncate">{{ comment.file_url.split('/').pop().split('_').slice(2).join('_') || '查看文件' }}</div>
                      <div class="text-[10px] text-ios-label-tertiary uppercase tracking-widest font-black">Download Attachment</div>
                    </div>
                  </a>
                </div>

                <!-- 链接内容 -->
                <div v-if="(comment.links && comment.links.length > 0) || comment.link_info" class="mb-3 space-y-2">
                  <!-- 处理多个链接 -->
                  <template v-if="comment.links && comment.links.length > 0">
                    <div
                      v-for="(link, index) in comment.links"
                      :key="index"
                      class="ios-glass rounded-lg p-3 hover:bg-ios-systemGray5 transition-all"
                    >
                      <a :href="link.url" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3">
                        <img
                          :src="getFaviconUrl(link.url)"
                          :alt="getDomain(link.url)"
                          class="w-6 h-6 flex-shrink-0"
                          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium text-ios-label-primary truncate">{{ getDomain(link.url) }}</div>
                          <div class="text-xs text-blue-400 truncate">{{ link.url }}</div>
                        </div>
                      </a>
                    </div>
                  </template>
                  
                  <!-- 处理单个预览链接 (link_info) -->
                  <div 
                    v-if="comment.link_info && (!comment.links || !comment.links.some((l: any) => l.url === comment.link_info.url))"
                    class="ios-glass rounded-lg overflow-hidden hover:bg-ios-systemGray5 transition-all"
                  >
                    <a :href="comment.link_info.url" target="_blank" rel="noopener noreferrer" class="block">
                      <div v-if="comment.link_info.image_url" class="w-full h-32 overflow-hidden bg-ios-systemGray5">
                        <img :src="comment.link_info.image_url" :alt="comment.link_info.title" class="w-full h-full object-cover" />
                      </div>
                      <div class="p-3">
                        <div class="flex items-center gap-2 mb-1">
                          <img
                            :src="getFaviconUrl(comment.link_info.url)"
                            :alt="getDomain(comment.link_info.url)"
                            class="w-4 h-4 flex-shrink-0"
                          />
                          <div class="text-xs text-ios-label-tertiary truncate">{{ getDomain(comment.link_info.url) }}</div>
                        </div>
                        <div class="text-sm font-bold text-ios-label-primary line-clamp-1 mb-1">{{ comment.link_info.title || comment.link_info.url }}</div>
                        <div v-if="comment.link_info.description" class="text-xs text-ios-label-secondary line-clamp-2">{{ comment.link_info.description }}</div>
                      </div>
                    </a>
                  </div>
                </div>

                <!-- 投票内容 -->
                <div v-if="comment.poll_info && comment.poll_info.options && comment.poll_info.options.length >= 2" class="mb-3 p-4 ios-glass rounded-lg">
                  <h3 class="text-sm font-semibold mb-3 text-ios-label-primary">投票</h3>
                  <div class="space-y-3">
                    <div
                      v-for="(option, index) in comment.poll_info.options"
                      :key="index"
                      class="p-3 border border-ios-separator rounded-xl cursor-pointer hover:bg-ios-systemGray5 transition-all active:scale-[0.98]"
                      @click="handleVote(comment, index as number)"
                    >
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-sm text-ios-label-primary">{{ option }}</span>
                        <span class="text-xs text-ios-label-secondary">{{ calculateOptionPercentage(comment, index as number) }}%</span>
                      </div>
                      <div class="w-full bg-ios-systemGray5 rounded-full h-2">
                        <div 
                          class="bg-ios-blue h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                          :style="{ width: `${calculateOptionPercentage(comment, index as number)}%` }"
                        ></div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between mt-4">
                      <div class="text-xs text-ios-label-tertiary">
                        总投票数: {{ comment.poll_info.total_votes }} | 
                        {{ comment.poll_info.expire_at ? formatTime(comment.poll_info.expire_at) : '永久有效' }}
                      </div>
                      <button 
                        v-if="hasVoted(comment)"
                        @click.stop="cancelVote(comment)"
                        class="text-xs text-red-400 hover:text-red-300 px-3 py-1 ios-glass rounded-full hover:bg-red-500/10 transition-colors"
                      >
                        取消投票
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- 回复按钮 -->
                <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-ios-label-tertiary">
                  <button 
                    @click="toggleCommentLike(comment)"
                    class="flex items-center gap-1 hover:text-red-500 transition-colors min-h-[var(--tap-target)] px-2"
                  >
                    <span class="text-sm sm:text-base">{{ comment.isLiked ? '❤️' : '🤍' }}</span>
                    <span>{{ comment.like_count || 0 }}</span>
                  </button>
                  <button 
                    @click="openCommentModal(comment)"
                    class="flex items-center gap-1 hover:text-ios-blue transition-colors min-h-[var(--tap-target)] px-2"
                  >
                    💬 <span>回复</span>
                  </button>
                  <button
                    @click="openQuoteModal(comment)"
                    class="flex items-center gap-1 hover:text-ios-blue transition-colors min-h-[var(--tap-target)] px-2"
                    title="引用此评论"
                  >
                    📋
                  </button>
                  <button
                    v-if="comment.reply_count > 0"
                    @click="toggleReplies(comment.id)"
                    class="flex items-center gap-1 hover:text-blue-400 transition-colors min-h-[var(--tap-target)] px-2"
                  >
                    {{ showAllReplies[comment.id] ? '收起回复' : `查看全部 ${comment.reply_count} 条回复` }}
                  </button>
                  <button
                    v-if="authStore.user && authStore.user.id === comment.user_id"
                    @click="deleteComment(comment)"
                    class="flex items-center gap-1 hover:text-red-500 transition-colors min-h-[var(--tap-target)] px-2"
                  >
                    🗑️<span>删除</span>
                  </button>
                </div>
                
                <!-- 回复列表 -->
                <div v-if="showAllReplies[comment.id] && comment.replies && comment.replies.length > 0" class="mt-4 space-y-4 ml-4 pl-4 border-l-2 border-ios-separator">
                  <div
                    v-for="reply in comment.replies"
                    :key="reply.id"
                    class="flex items-start gap-2"
                  >
                    <div @click.stop="goToProfile(reply.username)" class="cursor-pointer">
                      <img
                        :src="getImageUrl(reply.avatar)"
                        :alt="reply.nickname"
                        class="w-8 h-8 rounded-full flex-shrink-0 hover:opacity-80 transition-opacity ring-1 ring-foreground/10"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between mb-1">
                        <div class="font-medium text-sm text-ios-label-primary">
                          <span @click.stop="goToProfile(reply.username)" class="cursor-pointer hover:text-ios-blue transition-colors">{{ reply.nickname }}</span>
                          <span v-if="reply.reply_to_nickname" class="text-ios-label-tertiary text-xs ml-1">
                            回复 {{ reply.reply_to_nickname }}
                          </span>
                        </div>
                        <div class="text-xs text-ios-label-tertiary flex-shrink-0">{{ formatTime(reply.created_at) }}</div>
                      </div>

                      <!-- 回复的引用卡片 -->
                      <div 
                        v-if="reply.quote_id" 
                        class="ios-glass rounded-lg p-2 mt-2 mb-2 border-l-2 border-ios-blue cursor-pointer hover:bg-ios-systemGray5 transition-colors"
                        @click="$router.push(`/post/${reply.quote_id}`)"
                      >
                        <div class="flex items-center gap-1 mb-1">
                          <span class="text-xs font-medium text-ios-label-secondary">{{ reply.quote_user_name }}</span>
                        </div>
                        <p class="text-xs text-ios-label-tertiary line-clamp-2">{{ reply.quote_content }}</p>
                      </div>

                      <div class="text-sm text-ios-label-primary post-content" v-html="formatPostContent(reply.content)"></div>
                      
                      <!-- 回复操作 -->
                      <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-ios-label-tertiary mt-2">
                        <button 
                          @click="toggleCommentLike(reply)"
                          class="flex items-center gap-1 hover:text-red-500 transition-colors min-h-[var(--tap-target)] px-2"
                        >
                          <span class="text-sm sm:text-base">{{ reply.isLiked ? '❤️' : '🤍' }}</span>
                          <span>{{ reply.like_count || 0 }}</span>
                        </button>
                        <button
                          @click="openCommentModal(reply)"
                          class="flex items-center gap-1 hover:text-ios-blue transition-colors min-h-[var(--tap-target)] px-2"
                        >
                          💬 <span>回复</span>
                        </button>
                        <button
                          @click="openQuoteModal(reply)"
                          class="flex items-center gap-1 hover:text-ios-blue transition-colors min-h-[var(--tap-target)] px-2"
                          title="引用此评论"
                        >
                          📋
                        </button>
                        <button
                          v-if="authStore.user && authStore.user.id === reply.user_id"
                          @click="deleteComment(reply)"
                          class="flex items-center gap-1 hover:text-red-500 transition-colors min-h-[var(--tap-target)] px-2"
                        >
                          🗑️<span>删除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 内联回复输入区 -->
                <div v-if="replyFormVisible[comment.id]" class="mt-4 ios-glass rounded-xl p-4">
                  <div class="flex items-start gap-3">
                    <img
                      :src="getImageUrl(authStore.user?.avatar)"
                      :alt="authStore.user?.nickname"
                      class="w-8 h-8 rounded-full flex-shrink-0 ring-1 ring-foreground/10"
                    />
                    <div class="flex-1">
                      <MentionInput
                        v-model="replyInputs[comment.id]"
                        :placeholder="`回复 ${comment.nickname}...`"
                        :rows="2"
                        :max-length="500"
                        class="ios-input text-ios-label-primary"
                      />
                      <div class="flex justify-end items-center mt-3 gap-3">
                        <button
                          @click="cancelReply(comment.id)"
                          class="text-sm text-ios-label-tertiary hover:text-ios-label-primary transition-colors min-h-[var(--tap-target)] px-4"
                        >
                          取消
                        </button>
                        <button
                          @click="submitReply(comment.id)"
                          class="ios-btn-primary px-6 py-2 rounded-full text-sm transition-all active:scale-95"
                          :disabled="!replyInputs[comment.id]?.trim() || submitting"
                        >
                          {{ submitting ? '发送中...' : '发送' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-else class="text-center py-12 text-ios-label-tertiary">
          <div class="text-4xl mb-3">💬</div>
          暂无相关评论，快来发表第一条评论吧！        </div>
      </div>
    </div>

    <BottomNav />

    <!-- 发表评论模态框 -->
    <div v-if="showPostModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="closeModal">
      <div class="ios-card w-full max-w-lg overflow-hidden shadow-2xl transition-all" @click.stop>
        <div class="flex items-center justify-between p-4 border-b border-ios-separator">
          <h2 class="text-lg font-bold text-ios-label-primary">{{ replyToComment ? `回复 ${replyToComment.nickname}` : '发表评论' }}</h2>
          <button @click="closeModal" class="w-10 h-10 rounded-full flex items-center justify-center text-ios-label-tertiary hover:text-ios-label-primary hover:bg-ios-systemGray5 transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="p-4 space-y-4">
          <!-- 引用卡片显示区域 -->
          <div v-if="quoteTarget" class="ios-glass rounded-xl p-4 border border-ios-blue/30 relative">
            <div class="flex items-center justify-between gap-3">
              <div class="flex flex-col gap-1 min-w-0">
                <span class="text-xs text-ios-label-tertiary">正在引用</span>
                <span class="text-sm font-medium text-ios-label-primary truncate">
                  {{ quoteTarget.content?.substring(0, 50) }}{{ quoteTarget.content?.length > 50 ? '...' : '' }}
                </span>
              </div>
              <button @click="clearQuote" class="p-2 text-ios-label-tertiary hover:text-red-400 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <MentionInput
            v-model="postContent"
            :placeholder="replyToComment ? `回复 ${replyToComment.nickname}...` : '写下你的评论...'"
            :rows="4"
            :max-length="500"
            class="ios-input text-ios-label-primary"
          />
          
          <!-- 匿名选项 -->
          <div class="flex items-center gap-3 py-2">
            <input 
              type="checkbox" 
              id="commentAnonymous" 
              v-model="isAnonymous"
              class="w-5 h-5 rounded-full border-ios-separator bg-ios-black/40 text-black focus:ring-black transition-all cursor-pointer"
            />
            <label for="commentAnonymous" class="text-sm text-ios-label-secondary cursor-pointer select-none">匿名评论</label>
          </div>
          
          <button
            @click="submitComment"
            class="ios-btn-primary w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98]"
            :disabled="!postContent.trim() || submitting"
          >
            {{ submitting ? '发布中...' : (replyToComment ? '回复' : '发布评论') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast 提示 -->
    <Transition name="fade">
      <div 
        v-if="toast.show"
        class="fixed top-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[150] flex items-center gap-2 border backdrop-blur-md transition-all duration-300"
        :class="toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-100' : 'bg-red-500/20 border-red-500/50 text-red-100'"
      >
        <span v-if="toast.type === 'success'">✅</span>
        <span v-else>❌</span>
        {{ toast.message }}
      </div>
    </Transition>

    <ImagePreview 
      v-model="showImagePreview" 
      :image-url="previewImageUrl"
      :show-like="!!previewingTopic"
      :is-liked="previewingTopic?.isLiked"
      :like-count="previewingTopic?.like_count"
      @like="toggleTopicLike"
    />
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
import BottomNav from '@/components/BottomNav.vue';
import ImagePreview from '@/components/ImagePreview.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}

const topic = ref<any>(null);
const comments = ref<any[]>([]);
const loadingPosts = ref(false);
const showPostModal = ref(false);

const showImagePreview = ref(false);
const previewImageUrl = ref('');
const previewingTopic = ref<any>(null);

function previewImage(url: string, topicObj?: any) {
  previewImageUrl.value = url;
  previewingTopic.value = topicObj || null;
  showImagePreview.value = true;
}

const postContent = ref('');
const submitting = ref(false);
const isAnonymous = ref(false);
const replyToComment = ref<any>(null);
const replyFormVisible = ref<Record<number, boolean>>({});
const replyInputs = ref<Record<number, string>>({});
const showAllReplies = ref<Record<number, boolean>>({});

// 引用功能相关
const quoteTarget = ref<{
  id: number;
  type: 'topic_comment';
  content: string;
  userId?: number;
  userName?: string;
  userAvatar?: string;
} | null>(null);

// 辅助函数
function getFaviconUrl(url: string) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (e) {
    return '';
  }
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

function calculateOptionPercentage(post: any, optionIndex: number) {
  if (!post.poll_info || !post.poll_info.votes) return 0;
  const totalVotes = post.poll_info.total_votes || 0;
  if (totalVotes === 0) return 0;
  
  const optionVotes = post.poll_info.votes[optionIndex]?.length || 0;
  return Math.round((optionVotes / totalVotes) * 100);
}

function hasVoted(post: any) {
  if (!authStore.user || !post.poll_info || !post.poll_info.votes) return false;
  return Object.values(post.poll_info.votes).some((voters: any) => 
    voters.some((v: any) => v.user_id === authStore.user?.id)
  );
}

async function handleVote(post: any, optionIndex: number) {
  if (!authStore.isAuthenticated) {
    showToast('请先登录后投票', 'error');
    return;
  }

  try {
    const response = await api.post(`/post/${post.id}/vote`, {
      option_index: optionIndex
    });
    
    // 更新投票数据
    post.poll_info.votes = response.data.poll_info.votes;
    post.poll_info.total_votes = response.data.poll_info.total_votes;
    
    showToast('操作成功', 'success');
  } catch (error: any) {
    console.error('投票失败:', error);
    showToast(error.response?.data?.error || '投票失败，请重试', 'error');
  }
}

async function cancelVote(post: any) {
  if (!authStore.isAuthenticated || !authStore.user) return;

  try {
    const userId = authStore.user.id;
    const userVotes = post.poll_info.votes[userId];
    
    if (!userVotes || !Array.isArray(userVotes) || userVotes.length === 0) {
      return;
    }
    
    // 遍历用户投票的所有选项，逐个取消
    for (const optionIndex of [...userVotes]) {
      const response = await api.post(`/post/${post.id}/vote`, { option_index: optionIndex });
      // 更新最后一次请求返回的数据
      post.poll_info.votes = response.data.poll_info.votes;
      post.poll_info.total_votes = response.data.poll_info.total_votes;
    }
    
    showToast('已取消投票', 'success');
  } catch (error: any) {
    console.error('取消投票失败:', error);
    showToast('取消投票失败，请重试', 'error');
  }
}

const toast = ref({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error'
});

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
}

async function fetchTopicDetail() {
  try {
    const topicId = route.params.id;
    const response = await api.get(`/topics/${topicId}`);
    topic.value = response.data.topic;
  } catch (error: any) {
    console.error('获取话题详情失败:', error);
  }
}

async function fetchTopicComments() {
  loadingPosts.value = true;
  try {
    const topicId = route.params.id;
    const response = await api.get(`/topics/${topicId}/comments`);
    comments.value = (response.data.comments || []).map((comment: any) => ({
      ...comment,
      replies: []
    }));
    
    for (const comment of comments.value) {
      if (comment.reply_count > 0) {
        await fetchCommentReplies(comment.id, 3);
      }
    }
  } catch (error: any) {
    console.error('获取评论失败:', error);
  } finally {
    loadingPosts.value = false;
  }
}

async function fetchCommentReplies(commentId: number, limit: number = 3) {
  try {
    const topicId = route.params.id;
    const response = await api.get(`/topics/${topicId}/comment/${commentId}/replies?limit=${limit}`);
    const comment = comments.value.find(c => c.id === commentId);
    if (comment) {
      comment.replies = response.data.replies || [];
      showAllReplies.value[commentId] = comment.reply_count > limit;
    }
  } catch (error: any) {
    console.error('获取回复失败:', error);
    showToast('获取回复失败，请重试', 'error');
  }
}

async function toggleReplies(commentId: number) {
  const comment = comments.value.find(c => c.id === commentId);
  if (!comment) return;
  
  if (showAllReplies.value[commentId]) {
    showAllReplies.value[commentId] = false;
  } else {
    await fetchCommentReplies(commentId, 50);
    showAllReplies.value[commentId] = true;
  }
}

async function toggleFollow() {
  if (!authStore.isAuthenticated) {
    showToast('请先登录', 'error');
    return;
  }

  try {
    const topicId = route.params.id;
    const response = await api.post(`/topics/${topicId}/follow`);
    topic.value.isFollowed = response.data.followed;
    topic.value.follow_count = response.data.followed 
      ? (topic.value.follow_count || 0) + 1 
      : Math.max(0, (topic.value.follow_count || 0) - 1);
  } catch (error: any) {
    console.error('关注失败:', error);
    showToast('操作失败，请重试', 'error');
  }
}

async function toggleTopicLike() {
  if (!authStore.isAuthenticated) {
    showToast('请先登录', 'error');
    return;
  }

  try {
    const topicId = route.params.id;
    const response = await api.post(`/topics/${topicId}/like`);
    topic.value.isLiked = response.data.liked;
    topic.value.like_count = response.data.liked 
      ? (topic.value.like_count || 0) + 1 
      : Math.max(0, (topic.value.like_count || 0) - 1);
  } catch (error: any) {
    console.error('点赞失败:', error);
    showToast('操作失败，请重试', 'error');
  }
}

async function submitComment() {
  if (!postContent.value.trim()) {
    showToast('请输入评论内容', 'error');
    return;
  }

  submitting.value = true;
  try {
    const topicId = route.params.id;
    const commentData: any = {
      content: postContent.value,
      parentId: replyToComment.value?.id || null,
      is_anonymous: isAnonymous.value
    };
    
    // 添加引用信息
    if (quoteTarget.value) {
      commentData.quoteId = quoteTarget.value.id;
      commentData.quote_type = 'topic_comment';
    }
    
    await api.post(`/topics/${topicId}/comment`, commentData);

    postContent.value = '';
    closeModal();
    await fetchTopicComments();
    
    if (topic.value) {
      topic.value.post_count = (topic.value.post_count || 0) + 1;
    }
    
    showToast('评论成功', 'success');
  } catch (error: any) {
    console.error('评论失败:', error);
    showToast(error.response?.data?.error || '评论失败，请重试', 'error');
  } finally {
    submitting.value = false;
  }
}

function openCommentModal(comment: any = null) {
  replyToComment.value = comment;
  showPostModal.value = true;
}

function openQuoteModal(comment: any) {
  quoteTarget.value = {
    id: comment.id,
    type: 'topic_comment',
    content: comment.content,
    userId: comment.user_id,
    userName: comment.nickname,
    userAvatar: comment.avatar
  };
  showPostModal.value = true;
}

function clearQuote() {
  quoteTarget.value = null;
}

function openQuoteTopicModal() {
  const quoteInfo = {
    id: topic.value.id,
    type: 'topic',
    content: topic.value.title + (topic.value.description ? ': ' + topic.value.description : ''),
    userId: topic.value.user_id,
    userName: topic.value.nickname,
    userAvatar: topic.value.avatar
  };
  localStorage.setItem('quoteTarget', JSON.stringify(quoteInfo));
  router.push('/posts');
}

function closeModal() {
  showPostModal.value = false;
  postContent.value = '';
  replyToComment.value = null;
  quoteTarget.value = null;
}

function cancelReply(commentId: number) {
  replyFormVisible.value[commentId] = false;
  replyInputs.value[commentId] = '';
}

async function submitReply(commentId: number) {
  if (!authStore.isAuthenticated) {
    showToast('请先登录', 'error');
    return;
  }

  const content = replyInputs.value[commentId]?.trim();
  if (!content) return;

  submitting.value = true;
  try {
    const topicId = route.params.id;
    await api.post(`/topics/${topicId}/comment`, {
      content,
      parentId: commentId,
      is_anonymous: false
    });
    
    replyInputs.value[commentId] = '';
    replyFormVisible.value[commentId] = false;
    
    await fetchTopicComments();
    
    const comment = comments.value.find(c => c.id === commentId);
    if (comment) {
      comment.reply_count = (comment.reply_count || 0) + 1;
    }
    
    if (topic.value) {
      topic.value.post_count = (topic.value.post_count || 0) + 1;
    }
    
    showToast('回复成功', 'success');
  } catch (error: any) {
    console.error('提交回复失败:', error);
    showToast('提交回复失败，请重试', 'error');
  } finally {
    submitting.value = false;
  }
}

async function deleteComment(comment: any) {
  if (!authStore.isAuthenticated) {
    showToast('请先登录', 'error');
    return;
  }

  if (comment.user_id !== authStore.user?.id) {
    showToast('只能删除自己的评论', 'error');
    return;
  }

  if (!confirm('确定要删除这条评论吗？')) {
    return;
  }

  try {
    const topicId = route.params.id;
    await api.delete(`/topics/${topicId}/comment/${comment.id}`);
    
    await fetchTopicComments();
    showToast('评论已删除', 'success');
  } catch (error: any) {
    console.error('删除评论失败:', error);
    showToast('删除失败，请重试', 'error');
  }
}

async function toggleCommentLike(comment: any) {
  if (!authStore.isAuthenticated) {
    showToast('请先登录', 'error');
    return;
  }

  try {
    const topicId = route.params.id;
    const response = await api.post(`/topics/${topicId}/comment/${comment.id}/like`);
    comment.isLiked = response.data.liked;
    comment.like_count = response.data.liked 
      ? (comment.like_count || 0) + 1 
      : Math.max(0, (comment.like_count || 0) - 1);
  } catch (error: any) {
    console.error('点赞失败:', error);
    showToast('操作失败，请重试', 'error');
  }
}

async function deleteTopic() {
  if (!authStore.isAuthenticated) {
    showToast('请先登录', 'error');
    return;
  }

  if (!confirm('确定要删除这个话题吗？删除后话题将不可见')) {
    return;
  }

  try {
    const topicId = route.params.id;
    await api.delete(`/topics/${topicId}`);
    showToast('话题已删除', 'success');
    setTimeout(() => {
      router.push('/');
    }, 1000);
  } catch (error: any) {
    console.error('删除话题失败:', error);
    showToast(error.response?.data?.error || '删除失败，请重试', 'error');
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

onMounted(async () => {
  await fetchTopicDetail();
  await fetchTopicComments();
});
</script>

