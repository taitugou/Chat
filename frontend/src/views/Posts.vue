<template>
  <div class="min-h-screen pb-20 bg-background text-foreground transition-colors duration-300">
    <TopNav title="动态广场" />

    <div class="max-w-7xl mx-auto px-4 py-4 sm:py-6 lg:py-8 pb-24">
      <!-- 顶部操作区 -->
      <div class="flex items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-3">
          <button 
            @click="openPublishModal" 
            class="glass-btn-primary px-4 sm:px-6 py-2.5 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <span class="text-xl">+</span>
            <span class="hidden sm:inline">发布新动态</span>
            <span class="sm:hidden">发布</span>
          </button>
        </div>
        
        <div class="flex items-center gap-2 glass p-1 rounded-xl">
          <button 
            @click="sortBy = 'latest'; fetchPosts()" 
            class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="sortBy === 'latest' ? 'bg-foreground/10 text-white shadow-sm' : 'text-foreground/40 hover:text-foreground/60'"
          >
            最新
          </button>
          <button 
            @click="sortBy = 'hot'; fetchPosts()" 
            class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="sortBy === 'hot' ? 'bg-foreground/10 text-white shadow-sm' : 'text-foreground/40 hover:text-foreground/60'"
          >
            热门
          </button>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="py-24 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-6"></div>
        <p class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">Loading posts...</p>
      </div>

      <!-- 帖子列表 -->
      <div v-else-if="posts.length > 0" class="space-y-4">
        <transition-group name="post-fade">
          <div
            v-for="post in posts"
            :key="post.id"
            class="glass-card cursor-pointer glass-hover group overflow-hidden"
            @click="$router.push(`/post/${post.id}`)"
          >
            <!-- 帖子头部 -->
            <div class="p-4 flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div class="relative" @click.stop="goToProfile(post.username || '')">
                  <img
                    :src="getImageUrl(post.avatar)"
                    :alt="post.nickname"
                    class="w-10 h-10 rounded-full ring-2 ring-foreground/10 group-hover:ring-primary/30 transition-all object-cover"
                  />
                  <div v-if="post.username && post.username.includes('admin')" class="absolute -bottom-1 -right-1 bg-primary text-[8px] px-1 rounded-sm font-black text-white uppercase tracking-tighter">Staff</div>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-white group-hover:text-primary transition-colors text-sm" @click.stop="goToProfile(post.username || '')">{{ post.nickname }}</span>
                    <span v-if="getVipLabel(post.username || '')" class="text-[9px] bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-1.5 py-0.5 rounded-md font-black italic uppercase tracking-tighter">{{ getVipLabel(post.username || '') }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-[10px] text-foreground/30 font-medium uppercase tracking-wider">
                    <span>@{{ post.username }}</span>
                    <span>·</span>
                    <span>{{ formatTime(post.created_at) }}</span>
                  </div>
                </div>
              </div>
              
              <div v-if="authStore.user && (post.user_id === authStore.user.id || authStore.isAdmin)" class="flex items-center">
                <button 
                  class="p-2 text-foreground/20 hover:text-red-400 transition-colors active:scale-90"
                  @click.stop="deletePost(post)"
                  title="删除帖子"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 帖子内容 -->
            <div class="px-4 pb-4 space-y-4">
              <p class="text-foreground/80 text-sm leading-relaxed break-words whitespace-pre-wrap" v-html="formatPostContent(post.content)"></p>
              
              <!-- 引用内容 -->
              <div 
                v-if="post.quote_type && post.quote_type !== 'none'" 
                class="glass rounded-2xl p-3 border-l-4 border-primary/30 hover:bg-foreground/5 transition-colors"
                @click.stop="handleQuoteClick(post.quote_type, post.quote_id || 0)"
              >
                <div class="flex items-center gap-2 mb-1.5" @click.stop="goToProfile(post.quote_user_username || '')">
                  <img
                    :src="getImageUrl(post.quote_user_avatar)"
                    :alt="post.quote_user_name"
                    class="w-5 h-5 rounded-full border border-foreground/10"
                  />
                  <span class="text-[11px] font-bold text-foreground/80 hover:text-primary transition-colors">{{ post.quote_user_name }}</span>
                </div>
                <div class="text-[11px] text-foreground/50 line-clamp-2 italic">
                  {{ post.quote_content }}
                </div>
              </div>

              <!-- 话题标签 -->
              <div v-if="post.tags && post.tags.length > 0" class="flex flex-wrap gap-2">
                <span 
                  v-for="tag in post.tags" 
                  :key="tag" 
                  class="text-[10px] font-bold text-primary/80 hover:text-primary cursor-pointer transition-colors bg-primary/10 px-2 py-0.5 rounded-full"
                  @click.stop="$router.push(`/search?q=${tag}&type=topics`)"
                >
                  #{{ tag }}
                </span>
              </div>

              <!-- 图片网格 -->
              <div v-if="post.images && post.images.length > 0" class="rounded-2xl overflow-hidden border border-foreground/5 bg-foreground/5">
                <div 
                  class="grid gap-1"
                  :class="{
                    'grid-cols-1': post.images.length === 1,
                    'grid-cols-2': post.images.length === 2,
                    'grid-cols-2 sm:grid-cols-3': post.images.length >= 3
                  }"
                >
                  <div 
                    v-for="(img, idx) in post.images" 
                    :key="idx"
                    class="aspect-square relative group/img overflow-hidden bg-foreground/5"
                    @click.stop="previewImage(img, post)"
                  >
                    <img 
                      :src="getImageUrl(img)" 
                      class="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                      loading="lazy"
                    />
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 文件链接 -->
              <div v-if="post.file_url" class="mt-2">
                <a 
                  :href="getImageUrl(post.file_url)" 
                  :download="post.file_url.split('/').pop().split('_').slice(2).join('_') || 'download'"
                  class="flex items-center gap-3 glass p-3 rounded-xl border border-foreground/10 hover:bg-foreground/5 transition-all group"
                  @click.stop
                >
                  <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-foreground/90 truncate">{{ post.file_url.split('/').pop().split('_').slice(2).join('_') || '查看文件' }}</div>
                    <div class="text-[10px] text-foreground/30 uppercase tracking-widest font-black">Download Attachment</div>
                  </div>
                  <div class="text-foreground/20 group-hover:text-primary transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                </a>
              </div>

              <!-- 投票信息 -->
              <div v-if="post.poll_info" class="glass p-4 rounded-2xl border border-foreground/10 space-y-3" @click.stop>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase tracking-widest text-foreground/40">Poll</span>
                    <span v-if="post.poll_info.is_anonymous" class="text-[8px] bg-foreground/5 text-foreground/30 px-1.5 py-0.5 rounded uppercase tracking-tighter">Anonymous</span>
                  </div>
                  <span class="text-[10px] text-foreground/20 font-medium uppercase tracking-widest">
                    {{ post.poll_info.total_votes || 0 }} Votes · {{ formatTime(post.poll_info.expire_at || '') }}
                  </span>
                </div>
                
                <div class="space-y-2">
                  <div 
                    v-for="(option, idx) in post.poll_info.options" 
                    :key="idx"
                    class="relative h-10 rounded-xl border border-foreground/5 bg-foreground/5 overflow-hidden group/poll cursor-pointer active:scale-[0.99] transition-all"
                    @click="handleVote(post, idx)"
                  >
                    <div 
                      class="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-1000 ease-out"
                      :style="{ width: `${calculateOptionPercentage(post, idx)}%` }"
                    ></div>
                    
                    <div class="absolute inset-0 px-4 flex items-center justify-between text-xs">
                      <span class="font-bold text-foreground/90">{{ option }}</span>
                      <div class="flex items-center gap-2">
                        <span v-if="hasVoted(post) && post.poll_info.votes?.[authStore.user?.id || 0]?.includes(idx)" class="text-primary text-sm">✓</span>
                        <span class="font-black tabular-nums text-foreground/40">{{ calculateOptionPercentage(post, idx) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 链接卡片 -->
              <div v-if="post.link_info" class="mt-2" @click.stop>
                <a 
                  :href="post.link_info.url" 
                  target="_blank" 
                  class="block glass border border-foreground/10 rounded-2xl overflow-hidden hover:bg-foreground/5 transition-all group/link active:scale-[0.99]"
                >
                  <div v-if="post.link_info.image_url" class="w-full h-32 overflow-hidden bg-foreground/5 border-b border-foreground/5">
                    <img :src="post.link_info.image_url" class="w-full h-full object-cover group-hover/link:scale-110 transition-transform duration-700" />
                  </div>
                  <div class="p-3">
                    <div class="flex items-center gap-2 mb-1">
                      <img v-if="getFaviconUrl(post.link_info.url)" :src="getFaviconUrl(post.link_info.url)" class="w-3 h-3 rounded-sm" />
                      <span class="text-[9px] font-black uppercase tracking-widest text-foreground/30 truncate">{{ getDomain(post.link_info.url) }}</span>
                    </div>
                    <div class="text-xs font-bold text-foreground/90 line-clamp-1 group-hover/link:text-primary transition-colors">{{ post.link_info.title }}</div>
                  </div>
                </a>
              </div>
            </div>

            <!-- 帖子交互 -->
            <div class="px-4 py-3 border-t border-foreground/5 flex items-center justify-between">
              <div class="flex items-center gap-6">
                <button 
                  class="flex items-center gap-1.5 group/btn transition-all active:scale-90"
                  :class="post.isLiked ? 'text-red-500' : 'text-foreground/30 hover:text-red-400'"
                  @click.stop="toggleLike(post)"
                >
                  <div class="w-8 h-8 rounded-full flex items-center justify-center group-hover/btn:bg-red-500/10 transition-colors">
                    <span class="text-lg">{{ post.isLiked ? '❤️' : '🤍' }}</span>
                  </div>
                  <span class="text-[10px] font-black tabular-nums tracking-widest">{{ post.like_count || 0 }}</span>
                </button>
                
                <button 
                  class="flex items-center gap-1.5 group/btn text-foreground/30 hover:text-primary transition-all active:scale-90"
                  @click.stop="$router.push(`/post/${post.id}`)"
                >
                  <div class="w-8 h-8 rounded-full flex items-center justify-center group-hover/btn:bg-primary/10 transition-colors">
                    <span class="text-lg">💬</span>
                  </div>
                  <span class="text-[10px] font-black tabular-nums tracking-widest">{{ post.comment_count || 0 }}</span>
                </button>

                <button 
                  class="flex items-center gap-1.5 group/btn text-foreground/30 hover:text-green-400 transition-all active:scale-90"
                  @click.stop="handleShare(post)"
                >
                  <div class="w-8 h-8 rounded-full flex items-center justify-center group-hover/btn:bg-green-500/10 transition-colors">
                    <span class="text-lg">🔗</span>
                  </div>
                  <span class="text-[10px] font-black tabular-nums tracking-widest">{{ post.share_count || 0 }}</span>
                </button>
              </div>

              <div class="flex items-center gap-2">
                <button 
                  class="w-8 h-8 rounded-full flex items-center justify-center text-foreground/20 hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
                  @click.stop="openQuoteModal(post)"
                  title="引用发布"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </transition-group>
      </div>

      <!-- 空状态 -->
      <div v-else class="py-24 text-center glass-card">
        <div class="text-6xl mb-6 opacity-20">📭</div>
        <h3 class="text-xl font-bold text-white mb-2">暂无动态</h3>
        <p class="text-foreground/40 text-sm mb-8">关注好友或发布你的第一条动态吧</p>
      </div>
    </div>

    <!-- 发布帖子模态框 -->
    <transition name="modal-fade">
      <div v-if="showPostModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showPostModal = false"></div>
        <div class="glass-card w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
          <div class="p-4 border-b border-foreground/10 flex items-center justify-between">
            <h3 class="text-sm font-black text-white uppercase tracking-widest">Create Post</h3>
            <button @click="showPostModal = false" class="w-8 h-8 rounded-full flex items-center justify-center text-foreground/40 hover:text-white transition-colors">✕</button>
          </div>

          <div class="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            <!-- 引用展示 -->
            <div v-if="quoteTarget" class="glass border border-primary/30 rounded-2xl p-4 relative group animate-in slide-in-from-top-2">
              <button @click="quoteTarget = null" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              <div class="flex items-center gap-2 mb-2">
                <img :src="getImageUrl(quoteTarget.userAvatar)" class="w-5 h-5 rounded-full object-cover" />
                <span class="text-xs font-bold text-foreground/60">@{{ quoteTarget.userName }}</span>
                <span class="text-[9px] text-foreground/20 uppercase tracking-widest font-black">· QUOTING</span>
              </div>
              <p class="text-xs text-foreground/40 line-clamp-2 leading-relaxed italic" v-html="formatPostContent(quoteTarget.content || '')"></p>
            </div>

            <!-- 输入区域 -->
            <div class="space-y-4">
              <MentionInput
                v-model="postContent"
                placeholder="分享新鲜事..."
                :rows="6"
                :max-length="2000"
                class="rounded-2xl"
              />
              <div class="text-[10px] text-right text-foreground/10 uppercase tracking-widest">{{ postContent.length }}/2000</div>
            </div>

            <!-- 话题标签 -->
            <div class="space-y-3">
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="(tag, idx) in selectedTags" 
                  :key="idx"
                  class="px-3 py-1 bg-primary/20 text-primary rounded-full text-[10px] font-bold flex items-center gap-2 group"
                >
                  #{{ tag }}
                  <button @click="removeTag(idx)" class="hover:text-white transition-colors">✕</button>
                </span>
              </div>
              <div class="flex gap-2">
                <input 
                  v-model="tagInput"
                  type="text"
                  placeholder="添加话题标签 (空格或回车)..."
                  class="glass-input flex-1 px-4 py-2.5 rounded-xl text-xs"
                  @keydown.enter.prevent="addTag"
                  @keydown.space.prevent="addTag"
                />
                <button 
                  @click="addTag"
                  class="glass-btn px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                  :disabled="!tagInput.trim()"
                >
                  添加
                </button>
              </div>
            </div>

            <!-- 链接输入 -->
            <div v-if="enableLink" class="space-y-3 animate-in slide-in-from-top-2">
              <div class="flex gap-2">
                <input 
                  v-model="linkUrl"
                  type="text"
                  placeholder="粘贴链接 URL..."
                  class="glass-input flex-1 px-4 py-2.5 rounded-xl text-xs"
                  @keydown.enter.prevent="addLink"
                />
                <button @click="addLink" class="glass-btn px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest">Add</button>
              </div>
              <div v-for="(link, idx) in addedLinks" :key="idx" class="glass border border-foreground/5 p-3 rounded-xl flex items-center justify-between group">
                <div class="flex items-center gap-3 overflow-hidden">
                  <div class="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center flex-shrink-0">
                    <img v-if="getFaviconUrl(link.url)" :src="getFaviconUrl(link.url)" class="w-4 h-4" />
                    <span v-else class="text-lg">🔗</span>
                  </div>
                  <div class="min-w-0">
                    <div class="text-[10px] text-foreground/80 truncate">{{ link.url }}</div>
                  </div>
                </div>
                <button @click="addedLinks.splice(idx, 1)" class="text-foreground/20 hover:text-red-400 transition-colors">✕</button>
              </div>
            </div>

            <!-- 投票设置 -->
            <div v-if="enablePoll" class="space-y-4 animate-in slide-in-from-top-2">
              <div class="grid grid-cols-1 gap-2">
                <div v-for="(_, idx) in pollOptions" :key="idx" class="flex gap-2">
                  <input 
                    v-model="pollOptions[idx]"
                    type="text"
                    :placeholder="`选项 ${idx + 1}`"
                    class="glass-input flex-1 px-4 py-2.5 rounded-xl text-xs"
                  />
                  <button v-if="pollOptions.length > 2" @click="pollOptions.splice(idx, 1)" class="text-foreground/20 hover:text-red-400 p-2">✕</button>
                </div>
              </div>
              <button v-if="pollOptions.length < 6" @click="pollOptions.push('')" class="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity">+ Add Option</button>
            </div>

            <!-- 媒体预览 -->
            <div v-if="selectedFiles.length > 0" class="grid grid-cols-3 gap-2">
              <div v-for="(file, idx) in selectedFiles" :key="idx" class="aspect-square relative group rounded-xl overflow-hidden border border-foreground/10 bg-foreground/5 flex flex-col items-center justify-center p-2">
                <template v-if="file.type === 'image'">
                  <img :src="file.preview" class="w-full h-full object-cover" />
                </template>
                <template v-else>
                  <div class="flex flex-col items-center gap-2">
                    <span class="text-3xl">📄</span>
                    <span class="text-[10px] text-foreground/60 line-clamp-1 text-center px-1">{{ file.name }}</span>
                  </div>
                </template>
                <button @click="selectedFiles.splice(idx, 1)" class="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">✕</button>
              </div>
            </div>
          </div>

          <div class="p-4 bg-foreground/5 border-t border-foreground/10 flex items-center justify-between">
            <div class="flex items-center gap-1">
              <button @click="fileInput?.click()" class="w-10 h-10 rounded-full flex items-center justify-center text-foreground/40 hover:text-primary hover:bg-primary/10 transition-all" title="图片/视频">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button @click="fileInput?.click()" class="w-10 h-10 rounded-full flex items-center justify-center text-foreground/40 hover:text-primary hover:bg-primary/10 transition-all" title="文件">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <button @click="enablePoll = !enablePoll" class="w-10 h-10 rounded-full flex items-center justify-center transition-all" :class="enablePoll ? 'text-primary bg-primary/10' : 'text-foreground/40 hover:text-primary hover:bg-primary/10'" title="投票">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
              <button @click="enableLink = !enableLink" class="w-10 h-10 rounded-full flex items-center justify-center transition-all" :class="enableLink ? 'text-primary bg-primary/10' : 'text-foreground/40 hover:text-primary hover:bg-primary/10'" title="链接">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-2.828 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <input ref="fileInput" type="file" class="hidden" multiple @change="handleFileSelect" />
            </div>

            <button 
              @click="submitPost"
              class="glass-btn-primary px-8 py-2.5 rounded-full font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20"
              :disabled="posting || (!postContent.trim() && !enablePoll && !enableLink && selectedFiles.length === 0)"
            >
              {{ posting ? 'Posting...' : 'Post' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <BottomNav />
    <ImagePreview 
      v-model="showImagePreview" 
      :image-url="previewImageUrl"
      :show-like="!!previewingPost"
      :is-liked="previewingPost?.isLiked"
      :like-count="previewingPost?.like_count"
      @like="previewingPost && toggleLike(previewingPost)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';
import ImagePreview from '@/components/ImagePreview.vue';
import MentionInput from '@/components/MentionInput.vue';
import { getImageUrl } from '@/utils/imageUrl';
import { formatPostContent } from '@/utils/contentRenderer';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Interfaces
interface LinkInfo {
  url: string;
  title?: string;
  image_url?: string;
  description?: string;
}

interface PollInfo {
  options: string[];
  votes?: Record<number, number[]>;
  total_votes?: number;
  expire_at?: string;
  is_anonymous?: boolean;
}

interface Post {
  id: number;
  user_id: number;
  nickname: string;
  username?: string;
  avatar: string | null;
  created_at: string;
  content: string;
  tags?: string[];
  images?: string[];
  link_info?: LinkInfo;
  poll_info?: PollInfo;
  isLiked?: boolean;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  quote_type?: string;
  quote_id?: number;
  quote_content?: string;
  quote_user_id?: number;
  quote_user_name?: string;
  quote_user_avatar?: string;
  quote_user_username?: string;
}

// State
const posts = ref<Post[]>([]);
const loading = ref(false);
const sortBy = ref('latest');

// Post creation state
const showPostModal = ref(false);
const postContent = ref('');
const posting = ref(false);
const enableLink = ref(false);
const enablePoll = ref(false);
const linkUrl = ref('');
const addedLinks = ref<any[]>([]);
const pollOptions = ref<string[]>(['', '']);
const selectedTags = ref<string[]>([]);
const tagInput = ref('');
const selectedFiles = ref<any[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const quoteTarget = ref<{
  id: number;
  type: string;
  content: string;
  userName: string;
  userAvatar: string | null;
} | null>(null);

// Preview state
const showImagePreview = ref(false);
const previewImageUrl = ref('');
const previewingPost = ref<Post | null>(null);

function openPublishModal() {
  quoteTarget.value = null;
  showPostModal.value = true;
}

// Fetch posts
async function fetchPosts() {
  loading.value = true;
  try {
    const params: any = { sort: sortBy.value };
    if (route.query.username) {
      params.username = route.query.username;
    }
    const response = await api.get('/posts/timeline', { params });
    posts.value = response.data.posts || [];
  } catch (error) {
    console.error('获取帖子失败:', error);
    posts.value = [];
  } finally {
    loading.value = false;
  }
}

// Interactions
async function toggleLike(post: Post) {
  if (!authStore.user) return alert('请先登录');
  try {
    const response = await api.post(`/posts/${post.id}/like`);
    post.isLiked = response.data.liked;
    post.like_count = response.data.liked 
      ? (post.like_count || 0) + 1 
      : Math.max(0, (post.like_count || 0) - 1);
  } catch (error) {
    console.error('点赞失败:', error);
  }
}

async function handleShare(post: Post) {
  if (!authStore.user) return alert('请先登录');
  try {
    await api.post(`/posts/${post.id}/share`, { content: '' });
    post.share_count = (post.share_count || 0) + 1;
    alert('分享成功');
  } catch (error) {
    console.error('分享失败:', error);
  }
}

async function deletePost(post: Post) {
  if (!confirm('确定要删除这条动态吗？')) return;
  try {
    await api.delete(`/posts/${post.id}`);
    posts.value = posts.value.filter(p => p.id !== post.id);
  } catch (error) {
    console.error('删除帖子失败:', error);
  }
}

async function handleVote(post: Post, optionIndex: number) {
  if (!authStore.user) return alert('请先登录');
  if (hasVoted(post)) return;
  try {
    await api.post(`/posts/${post.id}/vote`, { option_index: optionIndex });
    await fetchPosts(); // Refresh to get updated vote counts
  } catch (error) {
    console.error('投票失败:', error);
  }
}

// Creation functions
function addTag() {
  const tag = tagInput.value.trim();
  if (tag && !selectedTags.value.includes(tag)) {
    selectedTags.value.push(tag);
    tagInput.value = '';
  }
}

function removeTag(index: number) {
  selectedTags.value.splice(index, 1);
}

function addLink() {
  const rawUrl = linkUrl.value.trim();
  if (!rawUrl) return;
  const url = rawUrl.startsWith('http') ? rawUrl : `http://${rawUrl}`;
  addedLinks.value.push({ url });
  linkUrl.value = '';
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files) return;

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        selectedFiles.value.push({ 
          file, 
          preview: e.target?.result as string,
          type: 'image',
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    } else {
      selectedFiles.value.push({ 
        file, 
        preview: null, 
        type: 'file',
        name: file.name
      });
    }
  }
  input.value = '';
}

async function submitPost() {
  posting.value = true;
  try {
    const formData = new FormData();
    formData.append('content', postContent.value);
    
    if (selectedTags.value.length > 0) {
      formData.append('tags', JSON.stringify(selectedTags.value));
    }
    
    if (addedLinks.value.length > 0) {
      formData.append('links', JSON.stringify(addedLinks.value));
      formData.append('link_url', addedLinks.value[0].url);
    }
    
    let postType = 'text';
    if (enablePoll) postType = 'poll';
    else if (enableLink) postType = 'link';
    formData.append('post_type', postType);

    for (const fileObj of selectedFiles.value) {
      formData.append('media', fileObj.file);
    }

    if (enablePoll) {
      const validOptions = pollOptions.value.filter(o => o.trim());
      if (validOptions.length >= 2) {
        formData.append('poll_options', JSON.stringify(validOptions));
      }
    }

    if (quoteTarget.value) {
      formData.append('quote_id', quoteTarget.value.id.toString());
      formData.append('quote_type', quoteTarget.value.type);
    }

    await api.post('/posts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    // Reset
    postContent.value = '';
    selectedTags.value = [];
    addedLinks.value = [];
    selectedFiles.value = [];
    pollOptions.value = ['', ''];
    enableLink.value = false;
    enablePoll.value = false;
    quoteTarget.value = null;
    showPostModal.value = false;

    await fetchPosts();
  } catch (error) {
    console.error('发布失败:', error);
    alert('发布失败，请重试');
  } finally {
    posting.value = false;
  }
}

function openQuoteModal(post: Post) {
  quoteTarget.value = {
    id: post.id,
    type: 'post',
    content: post.content,
    userName: post.nickname,
    userAvatar: post.avatar
  };
  showPostModal.value = true;
}

// Helpers
function formatTime(time: string) {
  const date = new Date(time);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 0) return '即将截止';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString();
}

function getVipLabel(username: string) {
  if (username.includes('vip')) return 'VIP';
  if (username.includes('admin')) return 'ADMIN';
  return '';
}

function getFaviconUrl(url: string) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch { return ''; }
}

function getDomain(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function calculateOptionPercentage(post: Post, idx: number) {
  if (!post.poll_info?.total_votes) return 0;
  const votes = Object.values(post.poll_info.votes || {}).filter(v => v.includes(idx)).length;
  return Math.round((votes / post.poll_info.total_votes) * 100);
}

function hasVoted(post: Post) {
  if (!authStore.user || !post.poll_info?.votes) return false;
  return post.poll_info.votes[authStore.user.id] !== undefined;
}

function previewImage(url: string, post?: Post) {
  previewImageUrl.value = getImageUrl(url);
  previewingPost.value = post || null;
  showImagePreview.value = true;
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}

function handleQuoteClick(quoteType: string, quoteId: number) {
  if (quoteType === 'topic') {
    router.push(`/topic/${quoteId}`);
  } else {
    router.push(`/post/${quoteId}`);
  }
}

// Lifecycle
onMounted(async () => {
  fetchPosts();
  
  const storedQuote = localStorage.getItem('quoteTarget');
  if (storedQuote) {
    try {
      const parsed = JSON.parse(storedQuote);
      quoteTarget.value = {
        id: parsed.id,
        type: parsed.type,
        content: parsed.content,
        userName: parsed.userName,
        userAvatar: parsed.userAvatar
      };
      showPostModal.value = true;
      localStorage.removeItem('quoteTarget');
    } catch {}
  }
});

watch(() => route.query.username, () => {
  fetchPosts();
});
</script>

<style scoped>
.post-fade-enter-active,
.post-fade-leave-active {
  transition: all 0.3s ease;
}
.post-fade-enter-from,
.post-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>


