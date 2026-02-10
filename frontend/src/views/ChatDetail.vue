<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
    <!-- 顶部导航 - iOS 风格 -->
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
      
      <div class="flex items-center flex-1 min-w-0 ml-1 cursor-pointer" @click.stop="goToProfile(otherUser?.username)">
        <div class="relative">
          <img
            :src="getImageUrl(otherUser?.avatar)"
            :alt="otherUser?.nickname"
            class="w-10 h-10 rounded-full ring-2 ring-foreground/10"
          />
          <span 
            class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black"
            :class="{
              'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]': otherUserStatus === 'online',
              'bg-gray-400': !otherUserStatus || otherUserStatus === 'offline'
            }"
          ></span>
        </div>
        <div class="ml-3 flex-1 min-w-0">
          <div class="font-bold flex items-center text-white">
            <span class="truncate">{{ otherUser?.nickname }}</span>
            <!-- P2P Status Indicator -->
            <span 
              v-if="p2pBadge"
              class="ml-2 px-1.5 py-0.5 text-[0.6rem] rounded-md font-bold flex items-center gap-1"
              :class="p2pBadge.badgeClass"
              :title="p2pBadge.title"
            >
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" :class="p2pBadge.dotClass"></span>
              {{ p2pBadge.text }}
            </span>
          </div>
          <div class="text-[0.65rem] text-foreground/40 flex items-center">
            {{ otherUserStatus === 'online' ? '当前在线' : '离线' }}
          </div>
        </div>
      </div>

      <button
        @click="callStore.startCall(otherUserId, 'audio', otherUser)"
        class="h-10 px-2 flex items-center gap-1 rounded-full text-foreground/40 hover:text-white hover:bg-foreground/10 transition-all mr-1"
        title="语音通话"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
      </button>

      <button
        @click="callStore.startCall(otherUserId, 'video', otherUser)"
        class="h-10 px-2 flex items-center gap-1 rounded-full text-foreground/40 hover:text-white hover:bg-foreground/10 transition-all mr-1"
        title="视频通话"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
      </button>

      <button
        @click="showSettings = true"
        class="h-10 px-3 flex items-center gap-1 rounded-full text-foreground/40 hover:text-white hover:bg-foreground/10 transition-all"
      >
        <span class="text-xs font-bold">更多</span>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>
    </div>

    <!-- 消息列表区域容器 -->
    <div class="flex-1 relative overflow-hidden">
      <!-- 聊天背景 - 独立于滚动容器，实现固定效果 -->
      <div 
        v-if="chatSettings.backgroundImage" 
        class="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-500"
        :style="{
          backgroundImage: `url(${getImageUrl(chatSettings.backgroundImage)})`,
        }"
      >
        <!-- 背景蒙层，确保文字清晰 -->
        <div class="absolute inset-0 bg-black/40"></div>
      </div>

      <!-- 滚动消息容器 -->
      <div 
        ref="messagesContainer" 
        class="absolute inset-0 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar z-10"
      >
        <div
          v-for="(message, index) in messages"
          :key="message.id"
          class="relative z-10 flex flex-col"
          :class="[
            message.sender_id === currentUserId ? 'items-end' : 'items-start'
          ]"
        >
          <!-- 时间分割 -->
          <div v-if="shouldShowTime(message, index)" class="relative z-10 w-full flex justify-center my-4">
            <span class="text-[0.65rem] px-3 py-1 glass rounded-full text-foreground/30">
              {{ formatFullTime(message.created_at) }}
            </span>
          </div>

          <div
            :class="[
              'max-w-[80%] px-4 py-2.5 rounded-2xl relative group transition-all',
              message.sender_id === currentUserId
                ? 'glass-btn-primary rounded-tr-none'
                : 'glass rounded-tl-none',
              message.is_snapchat ? 'border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : ''
            ]"
          >
            <!-- 阅后即焚标记 -->
            <div v-if="message.is_snapchat && message.is_read && !message.is_burned" class="absolute -top-7 right-0 bg-red-500 text-white text-[0.6rem] px-2 py-0.5 rounded-full font-bold animate-pulse">
              {{ snapchatTimers[message.id] || message.snapchat_duration }}s
            </div>
            <div v-if="message.is_snapchat && !message.is_burned" class="absolute -top-3 -right-3 bg-red-500 text-white text-[0.6rem] px-2 py-0.5 rounded-full shadow-lg z-10 border border-foreground/20">
              阅后即焚
            </div>
            
            <!-- 消息内容 -->
            <div v-if="!message.is_deleted && !message.is_recalled">
              <!-- 文本消息 -->
              <template v-if="!message.message_type || message.message_type === 'text'">
                <div
                  @click="handleSnapchatMessageClick(message)"
                  :class="[
                    'cursor-pointer select-none text-sm sm:text-base break-words leading-relaxed',
                    message.is_snapchat && !message.is_read ? 'text-foreground/40 italic flex items-center gap-2' : 'text-white',
                    message.is_burned ? 'opacity-50' : ''
                  ]"
                >
                  <template v-if="message.is_snapchat && !message.is_read">
                    <span class="text-lg">🔥</span> 点击查看加密消息
                  </template>
                  <span v-else v-html="formatPostContent(message.content)"></span>
                </div>
              </template>
              
              <!-- 图片消息 -->
              <template v-else-if="message.message_type === 'image'">
                <div v-if="message.is_burned && !authStore.isAdmin" class="text-foreground/40 italic text-sm">
                  [图片已焚毁]
                </div>
                <template v-else>
                  <div 
                    v-if="!message.is_snapchat || message.is_read" 
                    class="overflow-hidden rounded-xl bg-foreground/5"
                    :class="{ 'opacity-50': message.is_burned }"
                  >
                    <img
                      :src="message.file_url"
                      :alt="message.content || '图片消息'"
                      class="max-w-full h-auto cursor-pointer hover:brightness-110 transition-all"
                      @click="handleSnapchatMessageClick(message)"
                    />
                  </div>
                  <div 
                    v-else 
                    class="text-foreground/60 cursor-pointer flex flex-col items-center gap-2 py-4 px-8 border border-foreground/10 rounded-xl glass" 
                    @click="handleSnapchatMessageClick(message)"
                  >
                    <span class="text-2xl">🖼️</span>
                    <span class="text-sm">点击查看图片</span>
                  </div>
                </template>
              </template>
 
              <template v-else-if="message.message_type === 'video'">
                <video v-if="message.file_url" class="max-w-full rounded-xl" controls playsinline :src="message.file_url"></video>
                <div v-else class="text-foreground/40 italic text-sm">[视频不可用]</div>
              </template>
 
              <template v-else-if="message.message_type === 'audio'">
                <div v-if="message.file_url" class="flex items-center gap-3">
                  <button class="glass px-3 py-2 rounded-xl text-white" @click="playAudio(message)">播放</button>
                  <div class="text-xs text-foreground/50 truncate">{{ message.content || '音频' }}</div>
                </div>
                <div v-else class="text-foreground/40 italic text-sm">[音频不可用]</div>
              </template>
 
              <template v-else-if="message.message_type === 'file'">
                <div v-if="message.file_url" class="space-y-1">
                  <a
                    class="text-sm text-primary hover:underline"
                    :href="message.file_url"
                    target="_blank"
                    rel="noreferrer"
                    @click.prevent="downloadChatFile(message)"
                  >
                    📎 {{ message.content || '文件' }}
                  </a>
                  <div v-if="downloadingFiles[message.id]?.active" class="text-[0.65rem] text-foreground/40">
                    下载中 {{ downloadingFiles[message.id]?.progress }}%
                    <span v-if="downloadingFiles[message.id]?.bytesTotal">
                      · {{ formatFileSize(downloadingFiles[message.id]?.bytesNow || 0) }} / {{ formatFileSize(downloadingFiles[message.id]?.bytesTotal || 0) }}
                    </span>
                  </div>
                </div>
                <div v-else class="space-y-1">
                  <div class="text-sm text-white/80">📎 {{ message.content || '文件' }}</div>
                  <div class="text-[0.65rem] text-foreground/40">
                    {{ message.sender_id === currentUserId ? '快传中（文件不经服务器）' : '对方正在直传（文件不经服务器）' }}
                    <span v-if="message.file_size"> · {{ formatFileSize(message.file_size) }}</span>
                  </div>
                  <div v-if="activeP2PMessageId === message.id && p2pTransferring" class="pt-1 space-y-1">
                    <div class="w-full h-1.5 bg-blue-500/10 rounded-full overflow-hidden">
                      <div class="h-full bg-blue-500 transition-all duration-300" :style="{ width: `${p2pProgress}%` }"></div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-[0.65rem] text-foreground/50">
                        {{ p2pBytesTotal > 0 ? `${formatFileSize(p2pBytesNow)} / ${formatFileSize(p2pBytesTotal)}` : formatFileSize(p2pBytesNow) }}
                      </span>
                      <span class="text-[0.65rem] text-blue-400 font-bold">{{ formatSpeed(p2pSpeedBps) }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div v-else-if="message.is_deleted" class="text-foreground/30 italic text-sm flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              消息已删除
            </div>
            <div v-else-if="message.is_recalled" class="text-foreground/30 italic text-sm flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              消息已撤回
            </div>

            <!-- 消息脚部信息 -->
            <div class="flex items-center justify-end gap-1.5 mt-1">
              <span class="text-[0.6rem] opacity-40 text-white">{{ formatTime(message.created_at) }}</span>
              <span v-if="message.sender_id === currentUserId" class="text-[0.6rem] opacity-40">
                <template v-if="message.is_read">✓✓</template>
                <template v-else>✓</template>
              </span>
            </div>
            
            <!-- 撤回按钮 (Hover 显示) -->
            <button
              v-if="message.sender_id === currentUserId && !message.is_deleted && !message.is_recalled && canRecall(message)"
              @click="recallMessage(message)"
              class="absolute -left-12 top-1/2 -translate-y-1/2 p-2 rounded-full glass opacity-0 group-hover:opacity-100 transition-all hover:text-red-400"
              title="撤回消息"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="typing" class="relative z-10 flex justify-start">
          <div class="glass px-4 py-2 rounded-2xl rounded-tl-none animate-pulse flex items-center gap-2">
            <div class="flex gap-1">
              <div class="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"></div>
              <div class="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div class="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
            <span class="text-xs text-foreground/40 font-medium">对方正在输入</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div v-if="!isReadonly" class="glass-modal border-t border-foreground/10 px-4 py-4 pb-8 sm:pb-6 relative z-50">
      <!-- P2P 传输进度 -->
      <Transition name="fade">
        <div v-if="p2pTransferring" class="absolute -top-16 left-4 right-4 glass p-3 rounded-2xl border border-blue-500/30">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-blue-400 font-bold">
              🚀 P2P{{ p2pDirection === 'send' ? '发送' : (p2pDirection === 'recv' ? '接收' : '') }}: {{ p2pFileName }}
            </span>
            <span class="text-[0.65rem] text-blue-400">{{ p2pProgress }}%</span>
          </div>
          <div class="w-full h-1.5 bg-blue-500/10 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 transition-all duration-300" :style="{ width: `${p2pProgress}%` }"></div>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-[0.65rem] text-foreground/50">
              {{ p2pBytesTotal > 0 ? `${formatFileSize(p2pBytesNow)} / ${formatFileSize(p2pBytesTotal)}` : formatFileSize(p2pBytesNow) }}
            </span>
            <span class="text-[0.65rem] text-blue-400 font-bold">{{ formatSpeed(p2pSpeedBps) }}</span>
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="uploadingChatFile" class="absolute -top-16 left-4 right-4 glass p-3 rounded-2xl border border-primary/30">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-primary font-bold">⬆️ 上传中</span>
            <span class="text-[0.65rem] text-primary">{{ uploadingChatFileProgress }}%</span>
          </div>
          <div class="w-full h-1.5 bg-primary/10 rounded-full overflow-hidden">
            <div class="h-full bg-primary transition-all duration-300" :style="{ width: `${uploadingChatFileProgress}%` }"></div>
          </div>
        </div>
      </Transition>

      <!-- 阅后即焚设置浮层 (仅在勾选时显示) -->
      <Transition name="fade">
        <div v-if="isSnapchat" class="absolute -top-12 left-4 flex items-center gap-3 glass px-4 py-2 rounded-full border border-red-500/30">
          <span class="text-xs text-red-400 font-bold">🔥 阅后即焚:</span>
          <input
            v-model.number="snapchatDuration"
            type="number"
            min="5"
            :max="maxSnapchatDuration"
            class="bg-transparent w-12 text-xs text-white focus:outline-none"
          />
          <span class="text-[0.65rem] text-foreground/40">秒后销毁</span>
        </div>
      </Transition>

      <div class="flex items-end gap-3">
        <!-- P2P 文件传输按钮 -->
        <button 
          @click="$refs.p2pFile?.click()" 
          class="p-3 rounded-2xl transition-all active:scale-90 glass text-foreground/40 hover:text-white hover:bg-foreground/10"
          title="发送文件（经服务器）"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 10.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101m-.758-4.826L12 14" />
          </svg>
        </button>
        <input ref="p2pFile" type="file" class="hidden" @change="sendFileWithServerBackup" />

        <button 
          @click="isSnapchat = !isSnapchat" 
          :class="[
            'p-3 rounded-2xl transition-all active:scale-90',
            isSnapchat ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'glass text-foreground/40'
          ]"
          title="阅后即焚"
        >
          🔥
        </button>
        
        <div class="flex-1 relative">
          <MentionInput
            v-model="inputMessage"
            placeholder="输入消息..."
            :rows="1"
            :maxLength="1000"
            :showCharCount="false"
            @keyup.enter="sendMessage()"
            @input="handleTyping"
            class="glass-input rounded-2xl min-h-[44px] max-h-32 transition-all"
          />
        </div>

        <button
          @click="sendMessage"
          class="glass-btn-primary p-3 rounded-2xl min-w-[50px] transition-all active:scale-90 shadow-lg shadow-primary/20"
          :disabled="!inputMessage.trim()"
        >
          <svg class="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      
      <div class="flex items-center justify-end mt-2 px-1">
        <div class="text-[0.65rem] text-foreground/40">
          {{ inputMessage.length }}/1000
        </div>
      </div>
    </div>

    <!-- 设置抽屉 - iOS 风格半屏 -->
    <Transition name="slide-up">
      <div
        v-if="showSettings"
        class="fixed inset-0 z-[100] flex items-end"
        @click="showSettings = false"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div class="glass-modal w-full rounded-t-[32px] p-6 pb-12 relative z-[101] shadow-2xl border-t border-foreground/10" @click.stop>
          <div class="w-12 h-1.5 bg-foreground/20 rounded-full mx-auto mb-6"></div>
          
          <h3 class="text-xl font-bold mb-6 text-white text-center">聊天设置</h3>
          
          <div class="space-y-4">
            <div class="glass p-4 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-white font-medium">文件快传（大文件）</span>
                  <span class="text-[0.7rem] text-foreground/40">仅 IPv6 Host 直连；文件内容不经服务器</span>
                </div>
                <button
                  @click="openP2PLargeFilePicker"
                  :class="[
                    'text-xs px-3 py-2 rounded-xl glass-btn-primary',
                    isP2PV6HostDirect ? '' : 'opacity-70'
                  ]"
                >
                  {{ isP2PV6HostDirect ? '选择文件' : '先选文件' }}
                </button>
              </div>

              <div class="flex items-center justify-between text-[0.7rem] text-foreground/40">
                <span>直连状态</span>
                <span :class="p2pBadge ? p2pBadge.textClass : 'text-foreground/40'">
                  {{ p2pBadge ? p2pBadge.text : '未直连' }}
                </span>
              </div>

              <input ref="p2pLargeFile" type="file" class="hidden" @change="sendLargeFileP2POnly" />
            </div>

            <div class="glass p-4 rounded-2xl flex items-center justify-between">
              <span class="text-white font-medium">置顶聊天</span>
              <input v-model="chatSettings.isPinned" type="checkbox" class="w-6 h-6 rounded-full border-foreground/20 bg-foreground/5 text-primary focus:ring-primary transition-all cursor-pointer" />
            </div>
            
            <div class="glass p-4 rounded-2xl flex items-center justify-between">
              <span class="text-white font-medium">消息免打扰</span>
              <input v-model="chatSettings.isMuted" type="checkbox" class="w-6 h-6 rounded-full border-foreground/20 bg-foreground/5 text-primary focus:ring-primary transition-all cursor-pointer" />
            </div>

            <!-- 聊天背景设置 -->
            <div class="glass p-4 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-white font-medium">聊天背景</span>
                <div class="flex items-center gap-2">
                  <button 
                    v-if="chatSettings.backgroundImage" 
                    @click="removeBackground" 
                    class="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    恢复默认
                  </button>
                  <button 
                    @click="backgroundInput?.click()" 
                    class="text-xs text-primary hover:text-primary-light transition-colors flex items-center gap-1"
                    :disabled="uploadingBackground"
                  >
                    <template v-if="uploadingBackground">
                      <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      上传中...
                    </template>
                    <template v-else>
                      {{ chatSettings.backgroundImage ? '更换背景' : '选择背景' }}
                    </template>
                  </button>
                </div>
              </div>
              
              <input 
                ref="backgroundInput" 
                type="file" 
                accept="image/*" 
                class="hidden" 
                @change="handleBackgroundUpload" 
              />
            </div>

            <button 
              @click="clearChatHistory" 
              class="w-full glass p-4 rounded-2xl text-red-400 font-medium hover:bg-red-500/10 transition-all text-center"
            >
              清空聊天记录
            </button>
            
            <button @click="saveSettings" class="glass-btn-primary w-full py-4 rounded-2xl font-bold mt-4 shadow-xl shadow-primary/20 transition-all active:scale-[0.98]">
              保存并返回
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 应用范围确认弹窗 -->
    <Transition name="fade">
      <div v-if="showApplyAllModal" class="fixed inset-0 z-[200] flex items-center justify-center px-6">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showApplyAllModal = false"></div>
        <div class="glass-modal w-full max-w-sm rounded-[32px] p-8 relative z-[201] shadow-2xl border border-foreground/10 text-center">
          <div class="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span class="text-4xl text-primary">🖼️</span>
          </div>
          <h3 class="text-xl font-bold text-white mb-2">设置聊天背景</h3>
          <p class="text-foreground/60 text-sm mb-8 leading-relaxed">
            图片已上传成功，请选择应用范围
          </p>
          <div class="space-y-3">
            <button 
              @click="applyBackground(false)" 
              class="w-full py-4 rounded-2xl bg-foreground/10 text-white font-bold hover:bg-foreground/20 transition-all active:scale-[0.98]"
            >
              应用到当前
            </button>
            <button 
              @click="applyBackground(true)" 
              class="w-full py-4 rounded-2xl glass-btn-primary font-bold shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
            >
              应用到所有
            </button>
            <button 
              @click="showApplyAllModal = false" 
              class="w-full py-4 rounded-2xl text-foreground/40 text-sm hover:text-white transition-all"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import { initSocket, getSocket } from '@/utils/socket';
import { formatPostContent } from '@/utils/contentRenderer';
import { getImageUrl } from '@/utils/imageUrl';
import MentionInput from '@/components/MentionInput.vue';
import { P2PConnection, type P2PTransportInfo } from '@/utils/webrtc';
import { sendChatFileChunked } from '@/utils/chunkedUpload';
import { downloadToBlobParallel, triggerDownload } from '@/utils/parallelDownload';
import { useCallStore } from '@/stores/call';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const callStore = useCallStore();
const otherUserId = parseInt(route.params.userId as string);
const roomId = route.query.room_id as string | undefined;
const isReadonly = route.query.readonly === 'true';
const currentUserId = authStore.user?.id;

const otherUser = ref<any>(null);
const otherUserStatus = ref('offline');
const messages = ref<any[]>([]);
const inputMessage = ref('');
const typing = ref(false);
const isSnapchat = ref(false);
const snapchatDuration = ref(30);
const showSettings = ref(false);
const chatSettings = ref({ 
  isPinned: false, 
  isMuted: false,
  backgroundImage: null as string | null
});
const messagesContainer = ref<HTMLElement | null>(null);
const backgroundInput = ref<HTMLInputElement | null>(null);
const uploadingBackground = ref(false);
const showApplyAllModal = ref(false);
const pendingBackgroundUrl = ref<string | null>(null);
const p2pLargeFile = ref<HTMLInputElement | null>(null);
const uploadingChatFile = ref(false);
const uploadingChatFileProgress = ref(0);
const downloadingFiles = ref<Record<number, { progress: number; bytesNow: number; bytesTotal: number; active: boolean }>>({});

// P2P State
const p2pConnection = ref<P2PConnection | null>(null);
const p2pState = ref<RTCPeerConnectionState>('new');
const p2pProgress = ref(0);
const p2pFileName = ref('');
const p2pTransport = ref<P2PTransportInfo | null>(null);
const LARGE_FILE_THRESHOLD_BYTES = 20 * 1024 * 1024;
const pendingLargeFile = ref<File | null>(null);
const pendingLargeFileDeadline = ref<number | null>(null);
const isSendingLargeFile = ref(false);
const p2pDirection = ref<'send' | 'recv' | ''>('');
const p2pBytesNow = ref(0);
const p2pBytesTotal = ref(0);
const p2pSpeedBps = ref(0);
const p2pSpeedSample = ref<{ t: number; bytes: number } | null>(null);
const p2pTransferring = ref(false);
const activeP2PMessageId = ref<number | null>(null);

const isP2PV6HostDirect = computed(() => {
  const info = p2pTransport.value;
  return !!info?.isConnected && !!info.isDirect && !!info.isIPv6;
});

const p2pBadge = computed(() => {
  const info = p2pTransport.value;
  if (!info?.isConnected) return null;
  if (info.isDirect && info.isIPv6) {
    return {
      text: 'V6直连',
      title: 'IPv6 Host 直连',
      badgeClass: 'bg-blue-500/20 text-blue-400',
      dotClass: 'bg-blue-400',
      textClass: 'text-blue-400'
    };
  }
  if (info.isDirect) {
    return {
      text: '直连',
      title: 'Host 直连',
      badgeClass: 'bg-green-500/20 text-green-400',
      dotClass: 'bg-green-400',
      textClass: 'text-green-400'
    };
  }
  return {
    text: '中继',
    title: '已连接（非 Host 直连）',
    badgeClass: 'bg-yellow-500/20 text-yellow-300',
    dotClass: 'bg-yellow-300',
    textClass: 'text-yellow-300'
  };
});

function resetP2PMetrics(direction: 'send' | 'recv', totalBytes: number) {
  p2pDirection.value = direction;
  p2pBytesNow.value = 0;
  p2pBytesTotal.value = totalBytes || 0;
  p2pSpeedBps.value = 0;
  p2pSpeedSample.value = { t: performance.now(), bytes: 0 };
  p2pTransferring.value = true;
}

function updateP2PSpeed(bytesNow: number) {
  const sample = p2pSpeedSample.value;
  const now = performance.now();
  if (!sample) {
    p2pSpeedSample.value = { t: now, bytes: bytesNow };
    return;
  }

  const dt = (now - sample.t) / 1000;
  if (dt < 0.25) return;

  const db = bytesNow - sample.bytes;
  const inst = dt > 0 ? Math.max(0, db / dt) : 0;
  p2pSpeedBps.value = p2pSpeedBps.value ? (p2pSpeedBps.value * 0.75 + inst * 0.25) : inst;
  p2pSpeedSample.value = { t: now, bytes: bytesNow };
}

function openP2PLargeFilePicker() {
  p2pLargeFile.value?.click();
}

function initP2P() {
  if (p2pConnection.value) return;
  const myId = authStore.user?.id;
  if (!myId) return;

  const p2pRoomId = roomId || [myId, otherUserId].sort().join('_');
  
  p2pConnection.value = new P2PConnection(
    otherUserId,
    (data) => {
      if (data.type === 'file-start') {
        p2pFileName.value = data.name;
        p2pProgress.value = 0;
        activeP2PMessageId.value = typeof data.messageId === 'number' ? data.messageId : null;
        resetP2PMetrics('recv', typeof data.totalBytes === 'number' ? data.totalBytes : 0);
      } else if (data.type === 'file-progress') {
        p2pProgress.value = data.progress;
        if (typeof data.receivedBytes === 'number') {
          p2pBytesNow.value = data.receivedBytes;
          if (typeof data.totalBytes === 'number') p2pBytesTotal.value = data.totalBytes;
          updateP2PSpeed(p2pBytesNow.value);
        }
      } else if (data.type === 'file-complete') {
        const url = URL.createObjectURL(data.blob);
        const messageId = data.messageId;
        if (messageId) {
          const idx = messages.value.findIndex(m => m.id === messageId);
          if (idx >= 0) {
            messages.value[idx].server_file_url = messages.value[idx].file_url;
            messages.value[idx].file_url = url;
            messages.value[idx].is_p2p = true;
          } else {
            messages.value.push({
              id: messageId,
              sender_id: otherUserId,
              receiver_id: currentUserId,
              message_type: data.mimeType?.startsWith('image/') ? 'image' : 'file',
              content: data.name,
              file_url: url,
              created_at: new Date().toISOString(),
              is_p2p: true
            });
          }
        } else {
          messages.value.push({
            id: Date.now(),
            sender_id: otherUserId,
            receiver_id: currentUserId,
            message_type: data.mimeType?.startsWith('image/') ? 'image' : 'file',
            content: data.name,
            file_url: url,
            created_at: new Date().toISOString(),
            is_p2p: true
          });
        }
        p2pProgress.value = 0;
        p2pSpeedBps.value = 0;
        p2pBytesNow.value = 0;
        p2pBytesTotal.value = 0;
        p2pDirection.value = '';
        p2pTransferring.value = false;
        activeP2PMessageId.value = null;
        scrollToBottom();
      }
    },
    (state) => {
      p2pState.value = state;
      if (state !== 'connected') {
        p2pTransport.value = null;
      }
    },
    (info) => {
      p2pTransport.value = info;
    },
    { iceServers: [], iceCandidatePoolSize: 4 },
    p2pRoomId,
    myId
  );
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function detectMessageType(file: File): 'image' | 'video' | 'audio' | 'file' {
  const t = file.type || '';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'file';
}

async function downloadChatFile(message: any) {
  const url = message?.file_url;
  const id = Number(message?.id);
  if (!url || !Number.isFinite(id)) return;

  const filename = (message?.content && String(message.content).trim()) || 'file';

  downloadingFiles.value = {
    ...downloadingFiles.value,
    [id]: { progress: 0, bytesNow: 0, bytesTotal: Number(message?.file_size) || 0, active: true }
  };

  try {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      downloadingFiles.value = { ...downloadingFiles.value, [id]: { progress: 100, bytesNow: Number(message?.file_size) || 0, bytesTotal: Number(message?.file_size) || 0, active: false } };
      return;
    }

    const { blob, totalBytes } = await downloadToBlobParallel(String(url), {
      onProgress: (received, total) => {
        const progress = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
        downloadingFiles.value = {
          ...downloadingFiles.value,
          [id]: { progress, bytesNow: received, bytesTotal: total || Number(message?.file_size) || 0, active: true }
        };
      }
    });

    triggerDownload(blob, filename);
    downloadingFiles.value = {
      ...downloadingFiles.value,
      [id]: { progress: 100, bytesNow: totalBytes || Number(message?.file_size) || 0, bytesTotal: totalBytes || Number(message?.file_size) || 0, active: false }
    };
  } catch (e) {
    console.error('下载失败:', e);
    downloadingFiles.value = {
      ...downloadingFiles.value,
      [id]: { progress: 0, bytesNow: 0, bytesTotal: Number(message?.file_size) || 0, active: false }
    };
    window.open(String(url), '_blank', 'noreferrer');
  }
}

async function sendFileWithServerBackup(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const messageType = detectMessageType(file);
    uploadingChatFile.value = true;
    uploadingChatFileProgress.value = 0;
    const useChunked = file.size >= 8 * 1024 * 1024;
    let fileHash: string | undefined;

    if (file.size < LARGE_FILE_THRESHOLD_BYTES) {
      const buffer = await file.arrayBuffer();
      fileHash = await sha256Hex(buffer);
    }

    let saved: any = null;
    if (useChunked) {
      saved = await sendChatFileChunked({
        file,
        receiverId: otherUserId,
        messageType,
        fileHash,
        onProgress: (uploaded, total) => {
          uploadingChatFileProgress.value = total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0;
        }
      });
    } else {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('receiverId', String(otherUserId));
      formData.append('messageType', messageType);
      if (fileHash) formData.append('fileHash', fileHash);

      const resp = await api.post('/chat/send-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      saved = resp.data?.data;
    }

    if (saved && !messages.value.find(m => m.id === saved.id)) {
      messages.value.push(saved);
      scrollToBottom();
    }

  } catch (e) {
    console.error('发送文件失败:', e);
    alert('发送文件失败');
  } finally {
    uploadingChatFile.value = false;
    uploadingChatFileProgress.value = 0;
    input.value = '';
  }
}

async function sendLargeFileP2POnly(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    await queueOrSendLargeFile(file);
  } catch (e) {
    console.error('文件快传失败:', e);
    alert('文件快传失败');
  } finally {
    input.value = '';
  }
}

async function queueOrSendLargeFile(file: File) {
  if (!p2pConnection.value) initP2P();
  if (file.size < LARGE_FILE_THRESHOLD_BYTES) {
    alert('文件快传仅适用于大文件（≥20MB），小文件请用普通发送');
    return;
  }

  const canDirect = isP2PV6HostDirect.value;
  if (canDirect) {
    await sendLargeFileP2POnlyFile(file);
    return;
  }

  pendingLargeFile.value = file;
  pendingLargeFileDeadline.value = Date.now() + 60_000;
  p2pConnection.value?.initiate().catch(() => {});
  alert('当前未建立 IPv6 Host 直连：已先选择文件，直连后 60 秒内会自动开始快传');
}

async function sendLargeFileP2POnlyFile(file: File) {
  if (file.size < LARGE_FILE_THRESHOLD_BYTES) {
    alert('文件快传仅适用于大文件（≥20MB），小文件请用普通发送');
    return;
  }

  const canDirect = isP2PV6HostDirect.value;
  if (!canDirect || !p2pConnection.value) {
    alert('当前未建立 IPv6 Host 直连，无法快传');
    return;
  }

  const resp = await api.post('/chat/send-p2p-file-meta', {
    receiverId: otherUserId,
    messageType: 'file',
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream'
  });

  const saved = resp.data?.data;
  if (saved && !messages.value.find(m => m.id === saved.id)) {
    messages.value.push(saved);
    scrollToBottom();
  }

  const messageId = saved?.id;
  if (!messageId) {
    alert('创建快传消息失败');
    return;
  }

  p2pFileName.value = file.name;
  p2pProgress.value = 0;
  activeP2PMessageId.value = messageId;
  resetP2PMetrics('send', file.size);

  const CHUNK_SIZE = 256 * 1024;
  const CHANNELS = 4;
  const transferId = crypto.getRandomValues(new Uint32Array(1))[0];
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  const okStart = p2pConnection.value.send({
    type: 'file-start',
    transferId,
    name: file.name,
    size: file.size,
    totalChunks,
    chunkSize: CHUNK_SIZE,
    channels: CHANNELS,
    mimeType: file.type || 'application/octet-stream',
    messageId
  });
  if (!okStart) throw new Error('P2P通道未就绪');

  await p2pConnection.value.sendFileChunksParallel(
    file,
    { transferId, chunkSize: CHUNK_SIZE, channels: CHANNELS },
    (sentBytes) => {
      p2pBytesNow.value = sentBytes;
      p2pProgress.value = Math.min(100, Math.round((sentBytes / file.size) * 100));
      updateP2PSpeed(sentBytes);
    }
  );

  const okEnd = p2pConnection.value.send({ type: 'file-end', transferId, name: file.name, messageId });
  if (!okEnd) throw new Error('P2P连接已断开');
  p2pProgress.value = 0;
  p2pSpeedBps.value = 0;
  p2pBytesTotal.value = 0;
  p2pBytesNow.value = 0;
  p2pDirection.value = '';
  p2pTransferring.value = false;
  activeP2PMessageId.value = null;

  const url = URL.createObjectURL(file);
  const idx = messages.value.findIndex(m => m.id === messageId);
  if (idx >= 0) {
    messages.value[idx].file_url = url;
    messages.value[idx].is_p2p = true;
  }
}

watch(p2pTransport, (info) => {
  const deadline = pendingLargeFileDeadline.value;
  if (deadline && Date.now() > deadline) {
    pendingLargeFile.value = null;
    pendingLargeFileDeadline.value = null;
    return;
  }

  const canDirect = !!info?.isConnected && !!info.isDirect && !!info.isIPv6;
  if (!canDirect) return;

  const file = pendingLargeFile.value;
  if (!file || isSendingLargeFile.value) return;

  pendingLargeFile.value = null;
  pendingLargeFileDeadline.value = null;
  isSendingLargeFile.value = true;
  sendLargeFileP2POnlyFile(file)
    .catch(() => {})
    .finally(() => {
      isSendingLargeFile.value = false;
    });
});

watch(showSettings, (open) => {
  if (!open) return;
  if (!p2pConnection.value) initP2P();
  p2pConnection.value?.initiate().catch(() => {});
});

async function fetchChatSettings() {
  try {
    const conversationId = [currentUserId, otherUserId].sort().join('_');
    const response = await api.get('/settings/chat', {
      params: { conversationId }
    });
    
    let settings = null;
    if (response.data.settings && response.data.settings.length > 0) {
      settings = response.data.settings.find((s: any) => s.conversation_id === conversationId);
      // 如果没有特定会话的设置，看看有没有全局默认设置 (conversation_id === null)
      if (!settings) {
        settings = response.data.settings.find((s: any) => s.conversation_id === null);
      }
    }

    if (settings) {
      chatSettings.value = {
        isPinned: !!settings.is_pinned,
        isMuted: !!settings.is_muted,
        backgroundImage: settings.background_image
      };
    }
  } catch (error) {
    console.error('获取聊天设置失败:', error);
  }
}

async function handleBackgroundUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('background', file);

  try {
    uploadingBackground.value = true;
    const response = await api.post('/settings/chat/background', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    pendingBackgroundUrl.value = response.data.url;
    showApplyAllModal.value = true;
  } catch (error) {
    console.error('上传背景失败:', error);
    alert('上传背景失败');
  } finally {
    uploadingBackground.value = false;
    if (event.target) {
      (event.target as HTMLInputElement).value = '';
    }
  }
}

async function applyBackground(toAll: boolean) {
  if (!pendingBackgroundUrl.value) return;

  try {
    if (toAll) {
      await api.put('/settings/chat/background/all', {
        backgroundImage: pendingBackgroundUrl.value
      });
      chatSettings.value.backgroundImage = pendingBackgroundUrl.value;
      alert('已应用到所有聊天');
    } else {
      chatSettings.value.backgroundImage = pendingBackgroundUrl.value;
      await saveSettings();
    }
  } catch (error) {
    console.error('应用背景失败:', error);
    alert('应用背景失败');
  } finally {
    showApplyAllModal.value = false;
    pendingBackgroundUrl.value = null;
  }
}

function removeBackground() {
  chatSettings.value.backgroundImage = null;
  saveSettings();
}

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  router.push('/chat');
}

function goToProfile(username: string) {
  if (!username) return;
  router.push(`/profile/${username}`);
}

// 辅助函数：判断是否显示时间
function shouldShowTime(message: any, index: number) {
  if (index === 0) return true;
  const prevMessage = messages.value[index - 1];
  const currentTime = new Date(message.created_at).getTime();
  const prevTime = new Date(prevMessage.created_at).getTime();
  return (currentTime - prevTime) > 300000; // 5分钟显示一次时间
}

function formatFullTime(time: string) {
  const date = new Date(time);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return `今天 ${formatTime(time)}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(time)}`;
}

async function clearChatHistory() {
  if (confirm('确定要清空所有聊天记录吗？此操作不可撤销')) {
    try {
      await api.delete(`/chat/conversations/${roomId}/messages`);
      messages.value = [];
      alert('聊天记录已清空');
    } catch (error) {
      console.error('清空聊天记录失败:', error);
      alert('清空失败');
    }
  }
}

// 固定的默认值，移除VIP相关逻辑
const maxSnapchatDuration = 30; // 最大阅后即焚时长（秒）
const recallTimeLimit = 120; // 撤回时间限制（秒）
// 阅后即焚计时器
const snapchatTimers = ref<Record<number, number>>({});
// 阅后即焚倒计时
const snapchatTimerIntervals = ref<Record<number, any>>({});

onMounted(async () => {
  await fetchUserInfo();
  await fetchChatSettings();
  await fetchMessages();
  initSocketConnection();
  initP2P();
  scrollToBottom();
});

onUnmounted(() => {
  const socket = getSocket();
  if (socket) {
    // 触发离开聊天页面事件，但不影响全局在线状态
    socket.emit('chat:leave', { receiverId: otherUserId, roomId: roomId });
    
    socket.off('message:receive');
    socket.off('typing:start');
    socket.off('typing:stop');
    socket.off('user:status_change');
    socket.off('message:destroyed');
    socket.off('message:read');
    socket.off('webrtc:signal');
    socket.off('webrtc:call');
  }
  
  // 断开 P2P 连接
  if (p2pConnection.value) {
    p2pConnection.value.disconnect();
  }

  // 清理所有阅后即焚计时器
  for (const messageId in snapchatTimerIntervals.value) {
    clearInterval(snapchatTimerIntervals.value[messageId]);
  }

  // 退出聊天页面，清理匹配状态
  api.post('/match/cancel').catch(err => console.error('清理匹配状态失败', err));
});

async function handleSnapchatMessageClick(message: any) {
  if (!message.is_snapchat || message.is_read || message.is_burned) return;
  
  try {
    // 标记消息为已读
    const response = await api.put(`/chat/messages/${message.id}/read`);
    
    // 更新本地消息数据，获取真实内容
    if (response.data && response.data.data) {
      // 保留原有的发送者信息（如果存在）
      const senderInfo = {
        sender_id: message.sender_id,
        sender_nickname: message.sender_nickname,
        sender_avatar: message.sender_avatar
      };
      Object.assign(message, response.data.data, senderInfo);
    }
    
    message.is_read = true;
    
    // 开始倒计时
    startSnapchatTimer(message);
  } catch (error) {
    console.error('无法标记消息为已读', error);
  }
}

// 开始阅后即焚倒计时
function startSnapchatTimer(message: any) {
  // 初始化倒计时
  snapchatTimers.value[message.id] = message.snapchat_duration || 30;
  
  // 清除已存在的计时器
  if (snapchatTimerIntervals.value[message.id]) {
    clearInterval(snapchatTimerIntervals.value[message.id]);
  }
  
  // 创建新的计时器
  snapchatTimerIntervals.value[message.id] = setInterval(() => {
    snapchatTimers.value[message.id]--;
    
    // 时间到，销毁消息
    if (snapchatTimers.value[message.id] <= 0) {
      destroySnapchatMessage(message.id);
    }
  }, 1000);
}

// 销毁阅后即焚消息
async function destroySnapchatMessage(messageId: number) {
  // 清除计时器
  if (snapchatTimerIntervals.value[messageId]) {
    clearInterval(snapchatTimerIntervals.value[messageId]);
    delete snapchatTimerIntervals.value[messageId];
    delete snapchatTimers.value[messageId];
  }
  
  // 更新本地消息状态
  const messageIndex = messages.value.findIndex(m => m.id === messageId);
  if (messageIndex !== -1) {
    messages.value[messageIndex].is_burned = true;
    messages.value[messageIndex].content = null;
  }
}


async function fetchUserInfo() {
  try {
    const response = await api.get(`/user/${otherUserId}`);
    otherUser.value = response.data.user;
    // 初始化在线状态
    if (otherUser.value) {
      otherUserStatus.value = otherUser.value.online_status || 'offline';
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
}

async function fetchMessages() {
  try {
    const response = await api.get(`/chat/messages/${otherUserId}`, {
      params: { room_id: roomId }
    });
    messages.value = response.data.messages || [];
    scrollToBottom();
  } catch (error) {
    console.error('获取消息失败:', error);
  }
}

function initSocketConnection() {
  const token = authStore.token;
  if (!token) return;

  const socket = initSocket(token);
  
  // 触发进入聊天页面事件
  socket.emit('chat:join', { receiverId: otherUserId, roomId: roomId });

  socket.on('webrtc:error', (data: any) => {
    pendingLargeFile.value = null;
    pendingLargeFileDeadline.value = null;
    p2pProgress.value = 0;
    p2pSpeedBps.value = 0;
    p2pBytesNow.value = 0;
    p2pBytesTotal.value = 0;
    p2pDirection.value = '';
    p2pTransferring.value = false;
    activeP2PMessageId.value = null;
    alert(data?.error || '直连失败');
  });

  socket.on('message:receive', (message: any) => {
    // 检查消息是否属于当前会话（无论是发送者还是接收者）
    const isCorrectUser = message.sender_id === otherUserId || message.receiver_id === otherUserId;
    const isCorrectRoom = !roomId || message.conversation_id === roomId;

    if (isCorrectUser && isCorrectRoom) {
      // 检查是否已经存在该 ID 的消息，避免重复（针对自己发送的消息）
      if (!messages.value.find(m => m.id === message.id)) {
        messages.value.push(message);
        scrollToBottom();
      }
    }
  });
 
  // 异步持久化成功，更新临时消息ID
  socket.on('message:persisted', (data: any) => {
    const { tempId, id } = data || {};
    const idx = messages.value.findIndex(m => m.id === tempId);
    if (idx >= 0) {
      messages.value[idx].id = id;
      messages.value[idx].is_temp = false;
    }
  });

  // 监听发送确认，处理自己发送的消息显示
  socket.on('message:sent', (data: any) => {
    // 如果需要更实时的显示，可以在 emit 时就 push，但这里我们依赖服务器统一回传 message:receive
    // 或者在这里根据 messageId 更新消息状态
    console.log('消息发送成功确认', data);
  });

  socket.on('typing:start', (data: any) => {
    if (data.userId === otherUserId) {
      typing.value = true;
    }
  });

  socket.on('typing:stop', (data: any) => {
      if (data.userId === otherUserId) {
        typing.value = false;
      }
    });

    socket.on('message:destroyed', (data: any) => {
      const { messageId } = data;

      // 清理计时器
      if (snapchatTimerIntervals.value[messageId]) {
        clearInterval(snapchatTimerIntervals.value[messageId]);
        delete snapchatTimerIntervals.value[messageId];
        delete snapchatTimers.value[messageId];
      }

      const messageIndex = messages.value.findIndex(m => m.id === messageId);
      if (messageIndex >= 0) {
        const msg = messages.value[messageIndex];
        msg.is_burned = true;
        
        // 如果不是管理员，立即屏蔽内容
        if (!authStore.isAdmin) {
          msg.content = '[消息已焚毁]';
          if (msg.message_type === 'image' || msg.message_type === 'file' || msg.message_type === 'audio') {
            msg.file_url = null;
          }
        }
      }
    });

    socket.on('message:read', (data: any) => {
    const { messageId } = data;
    const message = messages.value.find(m => m.id === messageId);
    if (message && message.is_snapchat && !message.is_read) {
      message.is_read = true;
      startSnapchatTimer(message);
    }
  });

  socket.on('message:recall', (data: any) => {
    const { messageId } = data;
    const message = messages.value.find(m => m.id === messageId);
    if (message) {
      message.is_recalled = true;
      message.content = null;
      // 如果是阅后即焚消息，也需要清理计时器
      if (snapchatTimerIntervals.value[messageId]) {
        clearInterval(snapchatTimerIntervals.value[messageId]);
        delete snapchatTimerIntervals.value[messageId];
        delete snapchatTimers.value[messageId];
      }
    }
  });

  // 监听全局状态变更，解决匹配用户显示离线的问题
  socket.on('user:status_change', (data: any) => {
    if (data.userId === otherUserId) {
      otherUserStatus.value = data.status || 'offline';
    }
  });
}

function sendMessage() {
  if (!inputMessage.value.trim()) return;

  const socket = getSocket();
  if (!socket) {
    alert('连接未建立，请刷新页面');
    return;
  }

  socket.emit('message:send', {
    receiverId: otherUserId,
    content: inputMessage.value,
    messageType: 'text',
    isSnapchat: isSnapchat.value,
    snapchatDuration: isSnapchat.value ? snapchatDuration.value : 0,
    roomId: roomId,
  });

  inputMessage.value = '';
  isSnapchat.value = false;
  snapchatDuration.value = 30;
}

function handleTyping() {
  const socket = getSocket();
  if (socket) {
    socket.emit('typing:start', { receiverId: otherUserId });
    setTimeout(() => {
      socket.emit('typing:stop', { receiverId: otherUserId });
    }, 3000);
  }
}

async function saveSettings() {
  try {
    const conversationId = [currentUserId, otherUserId].sort().join('_');
    await api.put(`/settings/chat/${conversationId}`, {
      isPinned: chatSettings.value.isPinned,
      isMuted: chatSettings.value.isMuted,
      backgroundImage: chatSettings.value.backgroundImage
    });
    showSettings.value = false;
    // 不再弹窗，除非是手动点击保存按钮
  } catch (error) {
    console.error('保存设置失败:', error);
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function formatTime(time: any) {
  if (!time) return '--:--';
  const date = new Date(time);
  if (isNaN(date.getTime())) return '--:--';
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 判断消息是否可以撤回
function canRecall(message: any): boolean {
  if (message.sender_id !== currentUserId) return false;
  if (message.is_deleted || message.is_recalled) return false;
  
  const messageTime = new Date(message.created_at).getTime();
  const currentTime = Date.now();
  const timeDiff = (currentTime - messageTime) / 1000;
  return timeDiff <= recallTimeLimit;
}

// 撤回消息
async function recallMessage(message: any) {
  try {
    await api.put(`/chat/messages/${message.id}/recall`);
    // 更新本地消息状态
    message.is_recalled = true;
    message.content = null;
    alert('消息已成功撤回');
  } catch (error: any) {
    console.error('撤回消息失败:', error);
    alert(error.response?.data?.error || '撤回消息失败');
  }
}

// 音频播放
function playAudio(message: any) {
  const audio = new Audio(message.file_url);
  audio.play().catch(error => {
    console.error('播放音频失败:', error);
    alert('播放音频失败');
  });
}

// 格式化时长
function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bps: number): string {
  if (!bps || !Number.isFinite(bps)) return '0 B/s';
  return `${formatFileSize(Math.round(bps))}/s`;
}

// 导出工具函数供模板使用
defineExpose({
  playAudio,
  formatDuration,
  formatFileSize,
  formatSpeed
});


</script>
