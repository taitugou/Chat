<template>
  <div class="min-h-screen pb-20">
    <TopNav title="我的好友" />

    <div class="max-w-7xl mx-auto px-4 py-4 sm:py-6 lg:py-8">
      <!-- 好友分组管理 -->
      <div class="ios-card mb-4 sm:mb-6 p-4 sm:p-6" :class="{ 'relative z-[60]': showAddDropdown }">
        <div class="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="text-sm font-bold text-ios-label-tertiary uppercase tracking-wider">
            好友分组
          </div>
        </div>
        <div class="flex flex-wrap gap-2 sm:gap-3">
          <div class="relative inline-block" ref="addDropdownRef">
            <button 
              @click="showAddDropdown = !showAddDropdown" 
              class="ios-btn-primary min-h-[var(--tap-target)] flex items-center gap-2 px-5 rounded-full transition-all active:scale-95"
            >
              <span class="text-lg">+</span>
              <span>添加</span>
              <span class="text-[0.6rem] opacity-50 transition-transform" :class="{ 'rotate-180': showAddDropdown }">▼</span>
            </button>
            
            <teleport to="body">
              <div 
                v-if="showAddDropdown" 
                class="fixed z-[1000] w-48 ios-modal shadow-2xl py-2 overflow-hidden"
                :style="addDropdownStyle"
              >
                <button 
                  @click="showAddFriendModal = true; showAddDropdown = false" 
                  class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary text-sm transition-colors"
                >
                  <span class="text-lg">👤</span> 添加好友
                </button>
                <button 
                  @click="showCreateGroupChatModal = true; showAddDropdown = false" 
                  class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary text-sm transition-colors"
                >
                  <span class="text-lg">💬</span> 创建群聊
                </button>
                <button 
                  @click="showGroupModal = true; showAddDropdown = false" 
                  class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary text-sm transition-colors border-t border-ios-separator"
                >
                  <span class="text-lg">📁</span> 分组管理
                </button>
              </div>
            </teleport>
          </div>
          <button
            @click="selectedGroup = null"
            :class="[
              'px-5 py-2 rounded-full text-xs sm:text-sm font-medium min-h-[var(--tap-target)] transition-all active:scale-95',
              selectedGroup === null
                ? 'ios-btn-primary shadow-[0_4px_12px_rgba(59,130,246,0.3)]'
                : 'ios-glass hover:bg-ios-systemGray5'
            ]"
          >
            全部 ({{ friends.length }})
          </button>
          <div
            v-for="group in groups"
            :key="group?.id"
            class="inline-flex items-center px-4 py-2 rounded-full text-xs sm:text-sm font-medium min-h-[var(--tap-target)] transition-all"
            :class="selectedGroup === group?.id
              ? 'ios-btn-primary shadow-[0_4px_12px_rgba(59,130,246,0.3)]'
              : 'ios-glass hover:bg-ios-systemGray5'"
          >
            <span @click="selectedGroup = group?.id" class="cursor-pointer">{{ group?.name }} ({{ getGroupFriendCount(group?.id) }})</span>
            <div class="flex items-center ml-2 border-l border-ios-separator pl-2 gap-1">
              <button
                @click.stop="editGroup(group)"
                class="p-1 text-ios-label-tertiary hover:text-ios-label-primary transition-colors"
              >
                ✏️
              </button>
              <button
                @click.stop="showDeleteGroupModal = true; selectedGroupItem = group"
                class="p-1 text-ios-label-tertiary hover:text-red-400 transition-colors"
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 好友列表 -->
      <div class="ios-card p-4 sm:p-6" :class="{ 'relative z-[60]': !!activeMoreDropdown }">
        <!-- 搜索 -->
        <div class="mb-6 space-y-4">
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-ios-label-tertiary">🔍</span>
            <input
              v-model="searchKeyword"
              type="text"
              placeholder="搜索好友姓名、账号或备注..."
              class="ios-input text-sm w-full pl-11 py-3 rounded-2xl focus:ring-2 focus:ring-ios-blue/50 transition-all"
              @input="filterFriends"
            />
          </div>

          <div class="flex items-stretch gap-3">
            <button
              @click="showBatchDeleteModal = selectedFriends.length > 0"
              :class="['ios-glass w-full flex-1 rounded-2xl min-h-[var(--tap-target)] transition-all active:scale-95 flex items-center justify-center gap-2', selectedFriends.length > 0 ? 'text-red-400 border-red-500/30 bg-red-500/5' : 'text-ios-label-tertiary cursor-not-allowed']"
              :disabled="selectedFriends.length === 0"
            >
              <span>🗑</span>
              <span>批量删除 ({{ selectedFriends.length }})</span>
            </button>

            <GlassSelect
              v-model="sortBy"
              :options="sortOptions"
              class="flex-1 text-sm h-full rounded-2xl"
              @change="sortFriends"
            />
          </div>
        </div>

        <!-- 按分组显示好友 -->
        <div v-if="selectedGroup === null" class="space-y-8">
          <!-- 未分组好友 -->
          <div v-if="getGroupFriendCount(null) > 0">
            <div class="flex items-center gap-3 mb-4">
              <div class="h-px flex-1 bg-ios-systemGray5"></div>
              <div class="text-xs font-bold text-ios-label-tertiary uppercase tracking-widest">未分组</div>
              <div class="h-px flex-1 bg-ios-systemGray5"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="friend in getGroupFriends(null)"
                :key="friend?.id"
                class="group flex items-center justify-between p-3 sm:p-4 ios-glass rounded-2xl hover:bg-ios-systemGray5 transition-all cursor-pointer border border-ios-separator active:scale-[0.98]"
                @click="startChat(friend?.id)"
              >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div class="flex items-center" @click.stop>
                    <input
                      type="checkbox"
                      :checked="selectedFriends.includes(friend?.id)"
                      @change="toggleFriendSelection(friend?.id)"
                      class="w-5 h-5 rounded-full border-ios-separator bg-ios-systemGray5 text-ios-blue focus:ring-ios-blue transition-all cursor-pointer"
                    />
                  </div>
                  <div @click.stop="goToProfile(friend?.username)" class="relative flex-shrink-0 cursor-pointer">
                    <img
                      :src="getImageUrl(friend?.avatar)"
                      :alt="friend?.nickname"
                      class="w-12 h-12 rounded-full ring-2 ring-foreground/10 group-hover:ring-ios-blue/30 transition-all"
                    />
                    <span 
                      class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-ios-separator0"
                      :class="{
                        'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]': friend?.online_status === 'online',
                        'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]': friend?.online_status === 'away',
                        'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]': friend?.online_status === 'busy',
                        'bg-gray-400': !friend?.online_status || friend?.online_status === 'offline'
                      }"
                    ></span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold flex items-center text-sm sm:text-base text-ios-label-primary">
                      <span class="hover:text-ios-blue transition-colors truncate">{{ friend?.remark || friend?.nickname }}</span>
                    </div>
                    <div class="text-xs text-ios-label-tertiary truncate">@{{ friend?.username }}</div>
                    <div v-if="friend?.tags && friend.tags.length > 0" class="flex flex-wrap gap-1 mt-1.5">
                      <span
                        v-for="tag in friend.tags"
                        :key="tag"
                        class="text-[0.65rem] ios-glass text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20"
                      >
                        {{ tag }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                  <div class="relative inline-block" :ref="(el) => setDropdownRef(el, friend?.id)" :data-dropdown-id="`more-${friend?.id}`" @click.stop>
                    <button
                      @click="toggleMoreDropdown(friend?.id)"
                      class="w-10 h-10 flex items-center justify-center rounded-full text-ios-label-tertiary hover:text-ios-label-primary hover:bg-ios-systemGray5 transition-all"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    <teleport to="body">
                      <div
                        v-if="activeMoreDropdown === friend?.id"
                        class="fixed z-[1000] w-48 ios-modal border border-ios-separator rounded-2xl shadow-2xl py-2 overflow-hidden"
                        :style="getDropdownStyle(friend?.id)"
                      >
                        <button
                          @click="openRemarkModal(friend); showRemarkModal = true; activeMoreDropdown = null"
                          class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                        >
                          <span class="text-lg">📝</span> 设置备注
                        </button>
                        <button
                          @click="openTagsModal(friend); showTagsModal = true; activeMoreDropdown = null"
                          class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                        >
                          <span class="text-lg">🏷</span> 设置标签
                        </button>
                        <button
                          @click="openPermissionModal(friend); showPermissionModal = true; activeMoreDropdown = null"
                          class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                        >
                          <span class="text-lg">🔒</span> 权限设置
                        </button>
                        <button
                          @click="openCommonFriendsModal(friend); showCommonFriendsModal = true; activeMoreDropdown = null"
                          class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                        >
                          <span class="text-lg">👥</span> 共同好友
                        </button>
                        <button
                          @click="openSetGroupModal(friend); activeMoreDropdown = null"
                          class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                        >
                          <span class="text-lg">📁</span> {{ friend?.group_name || '设置分组' }}
                        </button>
                        <button
                          @click="showRemoveFriendModal = true; selectedFriend = friend; activeMoreDropdown = null"
                          class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-red-400 transition-colors border-t border-ios-separator"
                        >
                          <span class="text-lg">🗑</span> 删除好友
                        </button>
                      </div>
                    </teleport>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 按分组显示好友 -->
          <template v-for="group in groups" :key="group?.id">
            <div v-if="getGroupFriendCount(group?.id) > 0">
              <div class="flex items-center gap-3 mb-4">
                <div class="h-px flex-1 bg-ios-systemGray5"></div>
                <div class="text-xs font-bold text-ios-label-tertiary uppercase tracking-widest">{{ group?.name }}</div>
                <div class="h-px flex-1 bg-ios-systemGray5"></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  v-for="friend in getGroupFriends(group?.id)"
                  :key="friend?.id"
                  class="group flex items-center justify-between p-3 sm:p-4 ios-glass rounded-2xl hover:bg-ios-systemGray5 transition-all cursor-pointer border border-ios-separator active:scale-[0.98]"
                  @click="startChat(friend.id)"
                >
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="flex items-center" @click.stop>
                      <input
                        type="checkbox"
                        :checked="selectedFriends.includes(friend?.id)"
                        @change="toggleFriendSelection(friend?.id)"
                        class="w-5 h-5 rounded-full border-ios-separator bg-ios-systemGray5 text-ios-blue focus:ring-ios-blue transition-all cursor-pointer"
                      />
                    </div>
                    <div class="relative flex-shrink-0 cursor-pointer" @click.stop="goToProfile(friend.username)">
                      <img
                        :src="getImageUrl(friend.avatar)"
                        :alt="friend.nickname"
                        class="w-12 h-12 rounded-full ring-2 ring-foreground/10 group-hover:ring-ios-blue/30 transition-all"
                      />
                      <span 
                        class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black"
                        :class="{
                          'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]': friend?.online_status === 'online',
                          'bg-gray-400': !friend?.online_status || friend?.online_status === 'offline'
                        }"
                      ></span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-bold flex items-center text-sm sm:text-base text-ios-label-primary">
                        <span class="truncate">{{ friend.remark || friend.nickname }}</span>
                      </div>
                      <div class="text-xs text-ios-label-tertiary truncate">@{{ friend.username }}</div>
                      <div v-if="friend?.tags && friend.tags.length > 0" class="flex flex-wrap gap-1 mt-1.5">
                        <span
                          v-for="tag in friend.tags"
                          :key="tag"
                          class="text-[0.65rem] ios-glass text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                    <div class="relative inline-block" :ref="(el) => setDropdownRef(el, `group-${group?.id}-${friend?.id}`)" :data-dropdown-id="`group-${group?.id}-${friend?.id}`" @click.stop>
                      <button
                        @click="toggleMoreDropdown(`group-${group?.id}-${friend?.id}`)"
                        class="w-10 h-10 flex items-center justify-center rounded-full text-ios-label-tertiary hover:text-ios-label-primary hover:bg-ios-systemGray5 transition-all"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      <teleport to="body">
                        <div
                          v-if="activeMoreDropdown === `group-${group?.id}-${friend?.id}`"
                          class="fixed z-[1000] w-48 ios-modal border border-ios-separator rounded-2xl shadow-2xl py-2 overflow-hidden"
                          :style="getDropdownStyle(`group-${group?.id}-${friend?.id}`)"
                        >
                          <button
                            @click="openRemarkModal(friend); showRemarkModal = true; activeMoreDropdown = null"
                            class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                          >
                            <span class="text-lg">📝</span> 设置备注
                          </button>
                          <button
                            @click="openTagsModal(friend); showTagsModal = true; activeMoreDropdown = null"
                            class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                          >
                            <span class="text-lg">🏷</span> 设置标签
                          </button>
                          <button
                            @click="openPermissionModal(friend); showPermissionModal = true; activeMoreDropdown = null"
                            class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                          >
                            <span class="text-lg">🔒</span> 权限设置
                          </button>
                          <button
                            @click="openCommonFriendsModal(friend); showCommonFriendsModal = true; activeMoreDropdown = null"
                            class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                          >
                            <span class="text-lg">👥</span> 共同好友
                          </button>
                          <button
                            @click="openSetGroupModal(friend); activeMoreDropdown = null"
                            class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-ios-label-primary transition-colors"
                          >
                            <span class="text-lg">📁</span> {{ friend?.group_name || '设置分组' }}
                          </button>
                          <button
                            @click="showRemoveFriendModal = true; selectedFriend = friend; activeMoreDropdown = null"
                            class="w-full text-left px-4 py-3 hover:bg-ios-systemGray5 flex items-center gap-3 text-red-400 transition-colors border-t border-ios-separator"
                          >
                            <span class="text-lg">🗑</span> 删除好友
                          </button>
                        </div>
                      </teleport>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div v-if="friends.length === 0" class="text-center py-16">
            <div class="text-5xl mb-4">👋</div>
            <div class="text-ios-label-tertiary mb-2 font-medium">暂无好友</div>
            <div class="text-ios-label-quaternary text-sm">快去添加你的第一个好友吧</div>
          </div>
        </div>

        <!-- 按所选分组显示好友 -->
        <div v-else class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="friend in filteredFriends"
              :key="friend?.id"
              class="group flex items-center justify-between p-3 sm:p-4 ios-glass rounded-2xl hover:bg-ios-systemGray5 transition-all cursor-pointer border border-ios-separator active:scale-[0.98]"
              @click="startChat(friend.id)"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="flex items-center" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedFriends.includes(friend?.id)"
                    @change="toggleFriendSelection(friend?.id)"
                    class="w-5 h-5 rounded-full border-ios-separator bg-ios-systemGray5 text-ios-blue focus:ring-ios-blue transition-all cursor-pointer"
                  />
                </div>
                <div class="relative flex-shrink-0 cursor-pointer" @click.stop="goToProfile(friend.username)">
                  <img
                    :src="getImageUrl(friend.avatar)"
                    :alt="friend.nickname"
                    class="w-12 h-12 rounded-full ring-2 ring-foreground/10 group-hover:ring-ios-blue/30 transition-all"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-ios-label-primary truncate">{{ friend.remark || friend.nickname }}</div>
                  <div class="text-xs text-ios-label-tertiary truncate">@{{ friend.username }}</div>
                  <div v-if="friend?.tags && friend.tags.length > 0" class="flex flex-wrap gap-1 mt-1.5">
                    <span
                      v-for="tag in friend.tags"
                      :key="tag"
                      class="text-[0.65rem] ios-glass text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  @click.stop="openRemarkModal(friend); showRemarkModal = true"
                  class="w-9 h-9 flex items-center justify-center rounded-full text-ios-label-tertiary hover:text-ios-label-primary hover:bg-ios-systemGray5 transition-all"
                  title="设置备注"
                >
                  📝
                </button>
                <button
                  @click.stop="showRemoveFriendModal = true; selectedFriend = friend"
                  class="w-9 h-9 flex items-center justify-center rounded-full text-ios-label-tertiary hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="删除好友"
                >
                  🗑
                </button>
              </div>
            </div>
          </div>

          <div v-if="filteredFriends.length === 0" class="text-center py-16">
            <div class="text-4xl mb-4">📁</div>
            <div class="text-ios-label-tertiary">该分组暂无好友</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 模态框统一使用 ios-card / iOS 风格 -->
    <!-- 添加好友模态框 -->
    <div v-if="showAddFriendModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showAddFriendModal = false">
      <div class="ios-card w-full max-w-md overflow-hidden shadow-2xl" @click.stop>
        <div class="flex items-center justify-between p-5 border-b border-ios-separator">
          <h2 class="text-xl font-bold text-ios-label-primary">添加好友</h2>
          <button @click="showAddFriendModal = false" class="w-10 h-10 rounded-full flex items-center justify-center text-ios-label-tertiary hover:text-ios-label-primary hover:bg-ios-systemGray5 transition-all">×</button>
        </div>
        <div class="p-6 space-y-5">
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-ios-label-tertiary">🔍</span>
            <input
              v-model="userSearchKeyword"
              @keyup.enter="searchUsers"
              type="text"
              placeholder="输入账号、昵称或手机号..."
              class="ios-input w-full pl-11 py-3 rounded-2xl focus:ring-2 focus:ring-ios-blue/50 transition-all"
            />
          </div>
          <button
            @click="searchUsers"
            class="ios-btn-primary w-full py-3 rounded-2xl font-bold shadow-lg shadow-ios transition-all active:scale-[0.98]"
            :disabled="!userSearchKeyword.trim() || searching"
          >
            {{ searching ? '正在搜索...' : '立即搜索' }}
          </button>

          <!-- 搜索结果 -->
          <div v-if="searchResults.length > 0" class="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            <div
              v-for="user in searchResults"
              :key="user?.id"
              class="flex items-center justify-between p-3 ios-glass rounded-2xl border border-ios-separator hover:bg-ios-systemGray5 transition-all"
            >
              <div class="flex items-center space-x-3">
                <img
                  :src="getImageUrl(user?.avatar)"
                  :alt="user?.nickname"
                  class="w-11 h-11 rounded-full ring-2 ring-foreground/10 cursor-pointer"
                  @click.stop="goToProfile(user?.username)"
                />
                <div class="min-w-0">
                  <div class="font-bold text-ios-label-primary truncate cursor-pointer hover:text-ios-blue transition-colors" @click.stop="goToProfile(user?.username)">{{ user?.nickname }}</div>
                  <div class="text-xs text-ios-label-tertiary truncate">@{{ user?.username }}</div>
                </div>
              </div>
              <button
                @click="sendFriendRequest(user)"
                class="ios-btn-primary px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95"
                :disabled="(authStore.user && user?.id === authStore.user.id) || user?.is_friend || user?.request_status === 'pending' || requestedUserIds.has(user?.id)"
              >
                <template v-if="authStore.user && user?.id === authStore.user.id">本人</template>
                <template v-else-if="user?.is_friend">好友</template>
                <template v-else-if="user?.request_status === 'pending' || requestedUserIds.has(user?.id)">已申请</template>
                <template v-else>+ 申请</template>
              </button>
            </div>
          </div>
          <div v-if="searchPerformed && searchResults.length === 0" class="text-center py-8">
            <div class="text-3xl mb-3">👻</div>
            <div class="text-ios-label-tertiary text-sm">未找到匹配的用户</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 其他模态框 (分组、备注等) 同样保持 ios-card 和圆角一致 -->
    <!-- ... 这里可以继续优化其他模态框，但关键结构已确定 ... -->

    <!-- 备注模态框 -->
    <div v-if="showRemarkModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showRemarkModal = false">
      <div class="ios-card w-full max-w-sm overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 space-y-4">
          <h2 class="text-xl font-bold text-ios-label-primary mb-2">设置备注</h2>
          <input
            v-model="remarkText"
            type="text"
            placeholder="输入好友备注..."
            class="ios-input w-full py-3 px-4 rounded-2xl focus:ring-2 focus:ring-ios-blue/50 transition-all"
            maxlength="20"
          />
          <div class="flex gap-3 pt-2">
            <button @click="showRemarkModal = false" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="saveRemark" class="ios-btn-primary w-full py-3 rounded-2xl font-bold transition-all active:scale-95">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 移除好友确认 -->
    <div v-if="showRemoveFriendModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showRemoveFriendModal = false">
      <div class="ios-card w-full max-w-sm overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 text-center space-y-4">
          <div class="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-2">⚠️</div>
          <h2 class="text-xl font-bold text-ios-label-primary">删除好友</h2>
          <p class="text-ios-label-secondary">确定要删除好友 <span class="text-ios-label-primary font-bold">{{ selectedFriend?.remark || selectedFriend?.nickname }}</span> 吗？此操作不可撤销。</p>
          <div class="flex gap-3 pt-2">
            <button @click="showRemoveFriendModal = false" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="removeFriend(selectedFriend)" class="bg-red-500 hover:bg-red-600 w-full py-3 rounded-2xl font-bold text-white transition-all active:scale-95">确认删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分组管理模态框 -->
    <div v-if="showGroupModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="closeGroupModal">
      <div class="ios-card w-full max-w-sm overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 space-y-4">
          <h2 class="text-xl font-bold text-ios-label-primary mb-2">{{ editingGroup ? '编辑分组' : '新建分组' }}</h2>
          <input
            v-model="groupForm.name"
            type="text"
            placeholder="分组名称"
            class="ios-input w-full py-3 px-4 rounded-2xl focus:ring-2 focus:ring-ios-blue/50 transition-all"
            maxlength="10"
          />
          <div class="flex gap-3 pt-2">
            <button @click="closeGroupModal" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="saveGroup" class="ios-btn-primary w-full py-3 rounded-2xl font-bold transition-all active:scale-95" :disabled="savingGroup">
              {{ savingGroup ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除分组确认 -->
    <div v-if="showDeleteGroupModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showDeleteGroupModal = false">
      <div class="ios-card w-full max-w-sm overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 text-center space-y-4">
          <h2 class="text-xl font-bold text-ios-label-primary">删除分组</h2>
          <p class="text-ios-label-secondary">确定要删除分组 <span class="text-ios-label-primary font-bold">{{ selectedGroupItem?.name }}</span> 吗？该分组下的好友将被移至未分组。</p>
          <div class="flex gap-3 pt-2">
            <button @click="showDeleteGroupModal = false" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="deleteGroup(selectedGroupItem)" class="bg-red-500 hover:bg-red-600 w-full py-3 rounded-2xl font-bold text-white transition-all active:scale-95">确认删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 设置好友分组 -->
    <div v-if="showSetGroupModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showSetGroupModal = false">
      <div class="ios-card w-full max-w-sm overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 space-y-4">
          <h2 class="text-xl font-bold text-ios-label-primary mb-2">设置分组</h2>
          <GlassSelect v-model="selectedFriendGroup" :options="groupOptions" class="w-full" />
          <div class="flex gap-3 pt-2">
            <button @click="showSetGroupModal = false" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="saveFriendGroup" class="ios-btn-primary w-full py-3 rounded-2xl font-bold transition-all active:scale-95">确认</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 标签管理 -->
    <div v-if="showTagsModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showTagsModal = false">
      <div class="ios-card w-full max-w-md overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 space-y-4">
          <h2 class="text-xl font-bold text-ios-label-primary">设置标签</h2>
          <div class="flex flex-wrap gap-2 mb-2 min-h-[44px] p-2 ios-glass rounded-2xl">
            <span v-for="(tag, index) in friendTags" :key="index" class="px-3 py-1.5 ios-btn-primary rounded-full text-xs font-bold flex items-center gap-1.5">
              {{ tag }}
              <span @click="removeTag(index)" class="cursor-pointer opacity-60 hover:opacity-100">×</span>
            </span>
            <div v-if="friendTags.length < 10" class="flex items-center flex-1 min-w-[120px] gap-2">
              <input
                v-model="newTag"
                @keyup.enter="addTag"
                placeholder="添加标签..."
                class="bg-transparent text-ios-label-primary text-xs px-2 py-1 flex-1 focus:outline-none placeholder-ios-label-quaternary"
              />
              <button 
                v-if="newTag.trim()"
                @click="addTag"
                class="text-[10px] font-black text-ios-blue uppercase tracking-widest px-2 py-1 hover:opacity-70 transition-opacity whitespace-nowrap"
              >
                添加
              </button>
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showTagsModal = false" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="saveTags" class="ios-btn-primary w-full py-3 rounded-2xl font-bold transition-all active:scale-95">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 权限设置 -->
    <div v-if="showPermissionModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showPermissionModal = false">
      <div class="ios-card w-full max-w-sm overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 space-y-5">
          <h2 class="text-xl font-bold text-ios-label-primary">权限设置</h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-ios-label-secondary">允许查看个人主页</span>
              <input type="checkbox" v-model="permissions.viewProfile" class="w-5 h-5" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-ios-label-secondary">允许查看动态</span>
              <input type="checkbox" v-model="permissions.viewPosts" class="w-5 h-5" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-ios-label-secondary">允许发送私信</span>
              <input type="checkbox" v-model="permissions.sendMessage" class="w-5 h-5" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-ios-label-secondary">显示在线状态</span>
              <input type="checkbox" v-model="permissions.viewOnlineStatus" class="w-5 h-5" />
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showPermissionModal = false" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="savePermissions" class="ios-btn-primary w-full py-3 rounded-2xl font-bold transition-all active:scale-95">确认</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 共同好友 -->
    <div v-if="showCommonFriendsModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showCommonFriendsModal = false">
      <div class="ios-card w-full max-w-sm overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6">
          <h2 class="text-xl font-bold text-ios-label-primary mb-4">共同好友 ({{ commonFriends.length }})</h2>
          <div v-if="commonFriends.length > 0" class="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            <div v-for="cf in commonFriends" :key="cf.id" class="flex items-center gap-3 p-2 ios-glass rounded-xl">
              <img :src="getImageUrl(cf.avatar)" class="w-10 h-10 rounded-full" />
              <div class="min-w-0">
                <div class="font-bold text-sm text-ios-label-primary truncate">{{ cf.nickname }}</div>
                <div class="text-[10px] text-ios-label-tertiary">@{{ cf.username }}</div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-ios-label-tertiary text-sm">暂无共同好友</div>
          <button @click="showCommonFriendsModal = false" class="ios-btn-primary w-full py-3 mt-4 rounded-2xl font-bold transition-all active:scale-95">关闭</button>
        </div>
      </div>
    </div>

    <!-- 批量删除确认 -->
    <div v-if="showBatchDeleteModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showBatchDeleteModal = false">
      <div class="ios-card w-full max-w-sm overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 text-center space-y-4">
          <div class="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-2">🗑</div>
          <h2 class="text-xl font-bold text-ios-label-primary">批量删除好友</h2>
          <p class="text-ios-label-secondary">确定要删除选中的 <span class="text-ios-label-primary font-bold">{{ selectedFriends.length }}</span> 位好友吗？</p>
          <div class="flex gap-3 pt-2">
            <button @click="showBatchDeleteModal = false" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="batchDeleteFriends" class="bg-red-500 hover:bg-red-600 w-full py-3 rounded-2xl font-bold text-white transition-all active:scale-95">确认删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建群聊模态框 -->
    <div v-if="showCreateGroupChatModal" class="fixed inset-0 bg-ios-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click="showCreateGroupChatModal = false">
      <div class="ios-card w-full max-w-md overflow-hidden shadow-2xl" @click.stop>
        <div class="p-6 space-y-5">
          <h2 class="text-xl font-bold text-ios-label-primary">创建群聊</h2>
          <input
            v-model="groupChatName"
            type="text"
            placeholder="输入群聊名称..."
            class="ios-input w-full py-3 px-4 rounded-2xl focus:ring-2 focus:ring-ios-blue/50 transition-all"
          />
          <div class="space-y-2">
            <label class="text-xs font-bold text-ios-label-tertiary uppercase tracking-widest">选择成员 ({{ selectedGroupChatMembers.length }})</label>
            <div class="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div v-for="friend in friends" :key="friend.id" class="flex items-center justify-between p-3 ios-glass rounded-xl">
                <div class="flex items-center gap-3">
                  <img :src="getImageUrl(friend.avatar)" class="w-8 h-8 rounded-full" />
                  <span class="text-sm font-medium text-ios-label-primary">{{ friend.remark || friend.nickname }}</span>
                </div>
                <input type="checkbox" v-model="selectedGroupChatMembers" :value="friend.id" class="w-5 h-5" />
              </div>
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showCreateGroupChatModal = false" class="ios-glass w-full py-3 rounded-2xl font-bold text-ios-label-tertiary transition-all active:scale-95">取消</button>
            <button @click="createGroupChat" class="ios-btn-primary w-full py-3 rounded-2xl font-bold transition-all active:scale-95" :disabled="!groupChatName.trim() || selectedGroupChatMembers.length === 0">创建</button>
          </div>
        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import { getSocket } from '@/utils/socket';
import { getImageUrl } from '@/utils/imageUrl';
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';
import GlassSelect from '@/components/GlassSelect.vue';

const router = useRouter();
const authStore = useAuthStore();

const addDropdownRef = ref<HTMLElement | null>(null);
const showAddDropdown = ref(false);
const activeMoreDropdown = ref<string | null>(null);
const dropdownRefs = ref<Record<string, HTMLElement | null>>({});

const addDropdownStyle = computed(() => {
  if (!addDropdownRef.value) return {};
  const rect = addDropdownRef.value.getBoundingClientRect();
  return {
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
  };
});

function setDropdownRef(el: any, id: string | number) {
  if (el) dropdownRefs.value[String(id)] = el;
}

function getDropdownStyle(id: string | number) {
  const trigger = dropdownRefs.value[String(id)];
  if (!trigger) return {};
  const rect = trigger.getBoundingClientRect();
  const dropdownWidth = 192; 
  return {
    top: `${rect.bottom + 8}px`,
    left: `${Math.max(16, rect.right - dropdownWidth)}px`,
  };
}
const friends = ref<any[]>([]);
const groups = ref<any[]>([]);
const selectedGroup = ref<number | null>(null);
const selectedFriend = ref<any>(null);
const selectedGroupItem = ref<any>(null);
const selectedFriendGroup = ref<number | string>('');
const selectedFriends = ref<number[]>([]);

const showAddFriendModal = ref(false);
const showGroupModal = ref(false);
const showSetGroupModal = ref(false);
const showRemoveFriendModal = ref(false);
const showDeleteGroupModal = ref(false);
const showRemarkModal = ref(false);
const showTagsModal = ref(false);
const showPermissionModal = ref(false);
const showCommonFriendsModal = ref(false);
const showBatchDeleteModal = ref(false);
const showCreateGroupChatModal = ref(false);

const editingGroup = ref(false);
const savingGroup = ref(false);

const groupForm = ref({
  name: '',
  sortOrder: 0
});

const searchKeyword = ref('');
const userSearchKeyword = ref('');
const searchResults = ref<any[]>([]);
const searching = ref(false);
const searchPerformed = ref(false);
const requestedUserIds = ref<Set<number>>(new Set());
const sortBy = ref('created_at');
const sortOptions = [
  { value: 'created_at', label: '按添加时间' },
  { value: 'nickname', label: '按昵称' },
  { value: 'username', label: '按用户名' },
  { value: 'online_status', label: '按活跃度' }
];

const remarkText = ref('');

const friendTags = ref<string[]>([]);
const newTag = ref('');

const permissions = ref({
  viewProfile: true,
  viewPosts: true,
  sendMessage: true,
  viewOnlineStatus: true
});

const commonFriends = ref<any[]>([]);

const groupChatName = ref('');
const selectedGroupChatMembers = ref<number[]>([]);

const socket = getSocket();
const groupOptions = computed(() => {
  const base = [{ value: '', label: '取消分组' }];
  return base.concat((groups.value || []).map(g => ({ value: g?.id, label: g?.name })));
});

function updateFriendStatus(userId: number, status: string) {
  const friendIndex = friends.value.findIndex(f => f.id === userId);
  if (friendIndex > -1) {
    friends.value[friendIndex].online_status = status;
  }
}

function handleClickOutside(event: MouseEvent) {
  if (addDropdownRef.value && !addDropdownRef.value.contains(event.target as Node)) {
    showAddDropdown.value = false;
  }
  if (activeMoreDropdown.value) {
    const target = event.target as Node;
    const trigger = dropdownRefs.value[String(activeMoreDropdown.value)];
    // Check if the click is outside both the trigger and the teleported dropdown
    const dropdownElement = document.querySelector('.ios-modal[style*="fixed"]');
    if (trigger && !trigger.contains(target) && dropdownElement && !dropdownElement.contains(target)) {
      activeMoreDropdown.value = null;
    }
  }
}

function toggleMoreDropdown(id: string) {
  if (activeMoreDropdown.value === id) {
    activeMoreDropdown.value = null;
  } else {
    activeMoreDropdown.value = id;
  }
}

onMounted(async () => {
  await authStore.fetchUserInfo();
  await fetchFriends();
  await fetchGroups();
  
  document.addEventListener('click', handleClickOutside);

  if (socket) {
    socket.on('friend:online', (data: { userId: number, status: string }) => {
      updateFriendStatus(data.userId, data.status || 'online');
    });

    socket.on('friend:offline', (data: { userId: number }) => {
      updateFriendStatus(data.userId, 'offline');
    });

    socket.on('friend:status_update', (data: { userId: number, status: string }) => {
      updateFriendStatus(data.userId, data.status);
    });

    socket.on('user:status_change', (data: { userId: number, status: string }) => {
      updateFriendStatus(data.userId, data.status);
    });
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  if (socket) {
    socket.off('friend:online');
    socket.off('friend:offline');
    socket.off('friend:status_update');
    socket.off('user:status_change');
  }
});

const filteredFriends = computed(() => {
  let result = friends.value;
  
  if (selectedGroup.value) {
    result = result.filter(friend => friend?.group_id === selectedGroup.value);
  }
  
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(friend => 
      friend?.nickname?.toLowerCase().includes(keyword) ||
      friend?.username?.toLowerCase().includes(keyword) ||
      friend?.remark?.toLowerCase().includes(keyword)
    );
  }
  
  return result;
});

async function fetchFriends() {
  try {
    const response = await api.get('/user/friends/list');
    friends.value = response.data.friends || [];
  } catch (error) {
    console.error('获取好友列表失败:', error);
  }
}

async function fetchGroups() {
  try {
    const response = await api.get('/user/friend-groups');
    groups.value = response.data.groups || [];
  } catch (error) {
    console.error('获取好友分组失败:', error);
  }
}

async function searchUsers() {
  if (!userSearchKeyword.value.trim()) return;

  searching.value = true;
  searchPerformed.value = true;
  requestedUserIds.value.clear();
  try {
    const response = await api.get('/user/search', {
      params: { keyword: userSearchKeyword.value }
    });
    searchResults.value = response.data.users || [];
  } catch (error: any) {
    console.error('搜索用户失败:', error);
    searchResults.value = [];
    if (error.response?.data?.error) {
      alert(error.response.data.error);
    } else {
      alert('搜索用户失败，请稍后重试');
    }
  } finally {
    searching.value = false;
  }
}

async function sendFriendRequest(user: any) {
  try {
    const response = await api.post(`/user/friend-requests/${user.id}`, {
      message: ''
    });
    
    if (response.data.action === 'accepted') {
      alert(response.data.message || '已自动互加好友');
      // 刷新好友列表
      await fetchFriends();
    } else {
      alert('好友申请已发送');
    }
    requestedUserIds.value.add(user.id);
  } catch (error: any) {
    console.error('发送好友申请失败', error);
    if (error.response?.data?.error) {
      alert(error.response.data.error);
    } else {
      alert('发送好友申请失败，请重试');
    }
  }
}


async function removeFriend(friend: any) {
  try {
    await api.delete(`/user/friends/${friend.id}`);
    await fetchFriends();
    showRemoveFriendModal.value = false;
    selectedFriend.value = null;
    alert('删除好友成功');
  } catch (error) {
    console.error('删除好友失败:', error);
  }
}

async function saveGroup() {
  if (!groupForm.value.name.trim()) return;

  savingGroup.value = true;
  try {
    if (editingGroup.value) {
      await api.put(`/user/friend-groups/${selectedGroupItem.value.id}`, groupForm.value);
      alert('分组更新成功');
    } else {
      await api.post('/user/friend-groups', groupForm.value);
      alert('分组创建成功');
    }
    await fetchGroups();
    closeGroupModal();
  } catch (error) {
    console.error('保存分组失败:', error);
  } finally {
    savingGroup.value = false;
  }
}

function editGroup(group: any) {
  editingGroup.value = true;
  selectedGroupItem.value = group;
  groupForm.value = {
    name: group.name,
    sortOrder: group.sort_order || 0
  };
  showGroupModal.value = true;
}

async function deleteGroup(group: any) {
  try {
    await api.delete(`/user/friend-groups/${group.id}`);
    await fetchGroups();
    await fetchFriends();
    showDeleteGroupModal.value = false;
    selectedGroupItem.value = null;
    alert('分组删除成功');
  } catch (error) {
    console.error('删除分组失败:', error);
  }
}

async function saveFriendGroup() {
  if (!selectedFriend.value) return;

  try {
    await api.put(`/user/friends/${selectedFriend.value.id}/group`, {
      groupId: selectedFriendGroup.value === '' ? null : Number(selectedFriendGroup.value)
    });
    await fetchFriends();
    showSetGroupModal.value = false;
    selectedFriend.value = null;
    selectedFriendGroup.value = '';
    alert('好友分组设置成功');
  } catch (error) {
    console.error('设置好友分组失败:', error);
  }
}

function closeGroupModal() {
  showGroupModal.value = false;
  editingGroup.value = false;
  selectedGroupItem.value = null;
  groupForm.value = {
    name: '',
    sortOrder: 0
  };
}

function getGroupFriendCount(groupId: number | null): number {
  return friends.value.filter(friend => friend?.group_id === groupId).length;
}

function getGroupFriends(groupId: number | null): any[] {
  return friends.value.filter(friend => friend?.group_id === groupId);
}

function startChat(friendId: number | null | undefined) {
  if (friendId) {
    router.push(`/chat/${friendId}`);
  }
}

function toggleFriendSelection(friendId: number | null | undefined) {
  if (!friendId) return;
  const index = selectedFriends.value.indexOf(friendId);
  if (index > -1) {
    selectedFriends.value.splice(index, 1);
  } else {
    selectedFriends.value.push(friendId);
  }
}

function filterFriends() {
}

function sortFriends() {
  if (sortBy.value === 'created_at') {
    friends.value.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else if (sortBy.value === 'nickname') {
    friends.value.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''));
  } else if (sortBy.value === 'username') {
    friends.value.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
  } else if (sortBy.value === 'online_status') {
    const statusOrder: Record<string, number> = { 'online': 0, 'away': 1, 'busy': 2, 'offline': 3 };
    friends.value.sort((a, b) => {
      const statusA = statusOrder[a.online_status || 'offline'] ?? 3;
      const statusB = statusOrder[b.online_status || 'offline'] ?? 3;
      return statusA - statusB;
    });
  }
}

async function saveRemark() {
  if (!selectedFriend.value) return;

  try {
    await api.put(`/user/friends/${selectedFriend.value.id}/remark`, {
      remark: remarkText.value.trim()
    });
    await fetchFriends();
    showRemarkModal.value = false;
    remarkText.value = '';
    alert('备注设置成功');
  } catch (error) {
    console.error('设置备注失败:', error);
  }
}

function addTag() {
  if (!newTag.value.trim()) return;
  if (friendTags.value.length >= 10) {
    alert('最多添加10个标签');
    return;
  }
  if (friendTags.value.includes(newTag.value.trim())) {
    alert('标签已存在');
    return;
  }
  friendTags.value.push(newTag.value.trim());
  newTag.value = '';
}

function removeTag(index: number) {
  friendTags.value.splice(index, 1);
}

async function saveTags() {
  if (!selectedFriend.value) return;

  try {
    await api.put(`/user/friends/${selectedFriend.value.id}/tags`, {
      tags: friendTags.value
    });
    await fetchFriends();
    showTagsModal.value = false;
    friendTags.value = [];
    alert('标签设置成功');
  } catch (error) {
    console.error('设置标签失败:', error);
  }
}

async function savePermissions() {
  if (!selectedFriend.value) return;

  try {
    await api.put(`/user/friends/${selectedFriend.value.id}/permissions`, permissions.value);
    showPermissionModal.value = false;
    alert('权限设置成功');
  } catch (error) {
    console.error('设置权限失败:', error);
  }
}

async function fetchCommonFriends(friendId: number) {
  try {
    const response = await api.get(`/user/friends/${friendId}/common`);
    commonFriends.value = response.data.commonFriends || [];
  } catch (error) {
    console.error('获取共同好友失败:', error);
    commonFriends.value = [];
  }
}

async function batchDeleteFriends() {
  try {
    const deletedCount = selectedFriends.value.length;
    for (const friendId of selectedFriends.value) {
      await api.delete(`/user/friends/${friendId}`);
    }
    await fetchFriends();
    showBatchDeleteModal.value = false;
    selectedFriends.value = [];
    alert(`成功删除 ${deletedCount} 位好友`);
  } catch (error) {
    console.error('批量删除好友失败:', error);
    alert('批量删除好友失败，请重试');
  }
}

async function createGroupChat() {
  try {
    const response = await api.post('/chat/groups', {
      name: groupChatName.value,
      memberIds: selectedGroupChatMembers.value
    });
    alert('群聊创建成功');
    showCreateGroupChatModal.value = false;
    groupChatName.value = '';
    selectedGroupChatMembers.value = [];
    router.push(`/chat/group/${response.data.group.id}`);
  } catch (error) {
    console.error('创建群聊失败:', error);
    alert('创建群聊失败，请重试');
  }
}

function openRemarkModal(friend: any) {
  selectedFriend.value = friend;
  remarkText.value = friend.remark || '';
}

function openTagsModal(friend: any) {
  selectedFriend.value = friend;
  friendTags.value = [...(friend.tags || [])];
}

function openPermissionModal(friend: any) {
  selectedFriend.value = friend;
  permissions.value = { ...(friend.permissions || {
    viewProfile: true,
    viewPosts: true,
    sendMessage: true,
    viewOnlineStatus: true
  }) };
}

async function openCommonFriendsModal(friend: any) {
  selectedFriend.value = friend;
  await fetchCommonFriends(friend.id);
}

function openSetGroupModal(friend: any) {
  selectedFriend.value = friend;
  selectedFriendGroup.value = friend.group_id || '';
  showSetGroupModal.value = true;
}

function goToProfile(username: string) {
  if (username) {
    router.push(`/profile/${username}`);
  }
}
</script>

