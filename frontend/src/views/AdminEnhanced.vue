<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
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
        <div class="text-sm font-bold text-foreground/80">管理中心</div>
        <div class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Admin Enhanced</div>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <aside 
        class="glass border-r border-foreground/5 flex flex-col transition-all duration-300 overflow-y-auto"
        :class="[isSidebarCollapsed ? 'w-20' : 'w-64']"
      >
        <div class="p-4 space-y-2">
          <button
            v-for="item in navItems"
            :key="item.id"
            @click="currentTab = item.id"
            :class="[
              'w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-200 group',
              currentTab === item.id 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-foreground/60 hover:bg-foreground/5 hover:text-white'
            ]"
          >
            <span class="text-xl">{{ item.icon }}</span>
            <span v-if="!isSidebarCollapsed" class="text-sm font-bold">{{ item.name }}</span>
          </button>
        </div>
        
        <div class="mt-auto p-4 border-t border-foreground/5">
          <button 
            @click="isSidebarCollapsed = !isSidebarCollapsed"
            class="w-full flex items-center justify-center p-3 rounded-2xl hover:bg-foreground/5 text-foreground/40 transition-all"
          >
            {{ isSidebarCollapsed ? '➡️' : '⬅️ 收起侧边栏' }}
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto p-6 bg-foreground/[0.01]">
        <!-- Stats Tab -->
        <div v-if="currentTab === 'stats'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">数据概览</h2>
            <button @click="fetchStats" class="p-2 rounded-xl hover:bg-foreground/5 text-foreground/40 transition-all">🔄 刷新</button>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div v-for="(val, key) in dashboardStats" :key="key" class="glass-card p-6 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-2xl">{{ getStatIcon(key) }}</span>
                <span class="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">{{ getStatName(key) }}</span>
              </div>
              <div class="text-2xl font-black text-white">{{ val }}</div>
            </div>
          </div>
        </div>

        <!-- Users Tab -->
        <div v-else-if="currentTab === 'users'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">用户管理</h2>
            <div class="flex items-center space-x-3">
              <div class="relative">
                <input
                  v-model="userSearch"
                  type="text"
                  placeholder="搜索用户名/昵称/邮箱..."
                  class="bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:border-primary/50 w-64"
                  @keyup.enter="fetchUsers"
                />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-lg">🔍</span>
              </div>
              <GlassSelect 
                v-model="userStatusFilter" 
                :options="userStatusOptions"
                @change="fetchUsers"
                class="w-40"
              />
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-4">用户</th>
                  <th class="px-6 py-4">联系方式</th>
                  <th class="px-6 py-4">状态</th>
                  <th class="px-6 py-4">注册时间</th>
                  <th v-if="canWrite" class="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="user in users" :key="user.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-6 py-4">
                    <div class="flex items-center space-x-3">
                      <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold">
                        {{ user.username.charAt(0).toUpperCase() }}
                      </div>
                      <div>
                        <div class="font-bold text-white">{{ user.nickname || user.username }}</div>
                        <div class="text-[10px] text-foreground/40">@{{ user.username }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-foreground/70">{{ user.email || '未绑定邮箱' }}</div>
                    <div class="text-[10px] text-foreground/40">{{ user.phone || '未绑定手机' }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', user.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400']">
                      {{ user.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-foreground/50 text-xs">{{ formatDate(user.created_at) }}</td>
                  <td v-if="canWrite" class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end space-x-2">
                      <button @click="viewUserDetail(user)" class="p-2 rounded-lg hover:bg-foreground/5 text-foreground/60 transition-all" title="详情">👁️</button>
                      <button @click="toggleUserStatus(user)" class="p-2 rounded-lg hover:bg-foreground/5 text-foreground/60 transition-all" :title="user.status === 'active' ? '冻结' : '解冻'">
                        {{ user.status === 'active' ? '❄️' : '🔥' }}
                      </button>
                      <button @click="deleteUser(user, true)" class="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all" title="删除">🗑️</button>
                      
                      <!-- 更多操作下拉菜单 -->
                      <div class="relative">
                        <button 
                          @click.stop="activeMenuUserId = activeMenuUserId === user.id ? null : user.id"
                          class="p-2 rounded-lg hover:bg-foreground/5 text-foreground/60 transition-all"
                          title="更多操作"
                        >
                          ⋮
                        </button>
                        <div 
                          v-if="activeMenuUserId === user.id"
                          v-click-outside="() => activeMenuUserId = null"
                          class="absolute right-0 mt-2 w-48 glass-card !bg-background/40 backdrop-blur-xl border border-foreground/10 py-2 z-[110] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
                        >
                          <button @click="resetUserPassword(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center space-x-2">
                            <span>🔑</span> <span>重置密码</span>
                          </button>
                          <button @click="resetUserAvatar(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center space-x-2">
                            <span>🖼️</span> <span>重置头像</span>
                          </button>
                          <div class="my-1 border-t border-foreground/5"></div>
                          <button @click="viewUserFriends(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center space-x-2">
                            <span>👥</span> <span>好友列表</span>
                          </button>
                          <button @click="viewUserChats(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center space-x-2">
                            <span>💬</span> <span>聊天记录</span>
                          </button>
                          <button @click="viewUserMatches(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center space-x-2">
                            <span>🤝</span> <span>匹配记录</span>
                          </button>
                          <button @click="viewUserLoginIPs(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center space-x-2">
                            <span>🌐</span> <span>登录 IP 日志</span>
                          </button>
                          <button @click="sendUserNotif(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center space-x-2">
                            <span>📢</span> <span>发送个人通知</span>
                          </button>
                          <button @click="modifyUserPoints(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center space-x-2">
                            <span>💰</span> <span>修改积分</span>
                          </button>
                          <div class="my-1 border-t border-foreground/5"></div>
                          <button v-if="user.role !== 'admin' && user.role !== 'superadmin'" @click="promoteToAdmin(user)" class="w-full text-left px-4 py-2 text-xs hover:bg-green-500/10 hover:text-green-400 transition-colors flex items-center space-x-2">
                            <span>🛡️</span> <span>设为管理员</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <!-- Pagination -->
            <div class="px-6 py-4 bg-foreground/5 flex items-center justify-between border-t border-foreground/5">
              <div class="text-xs text-foreground/40">共 {{ userPagination.total }} 条数据</div>
              <div class="flex items-center space-x-2">
                <button 
                  @click="changeUserPage(userPagination.page - 1)" 
                  :disabled="userPagination.page === 1"
                  class="p-2 rounded-lg hover:bg-foreground/5 disabled:opacity-30 transition-all"
                >◀️</button>
                <span class="text-xs font-bold">{{ userPagination.page }} / {{ userPagination.totalPages }}</span>
                <button 
                  @click="changeUserPage(userPagination.page + 1)" 
                  :disabled="userPagination.page === userPagination.totalPages"
                  class="p-2 rounded-lg hover:bg-foreground/5 disabled:opacity-30 transition-all"
                >▶️</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Posts Tab -->
        <div v-else-if="currentTab === 'posts'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">动态管理</h2>
            <div class="flex items-center space-x-3">
              <div class="relative">
                <input
                  v-model="postSearch"
                  type="text"
                  placeholder="搜索动态内容..."
                  class="bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:border-primary/50 w-64"
                  @keyup.enter="fetchAdminPosts"
                />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-lg">🔍</span>
              </div>
            </div>
          </div>
          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-4">作者</th>
                  <th class="px-6 py-4">内容</th>
                  <th class="px-6 py-4">发布时间</th>
                  <th v-if="canWrite" class="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="post in adminPosts" :key="post.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-6 py-4 font-bold text-white">{{ post.username }}</td>
                  <td class="px-6 py-4">
                    <div class="text-foreground/80 line-clamp-1 max-w-md">{{ post.content }}</div>
                  </td>
                  <td class="px-6 py-4 text-foreground/50 text-xs">{{ formatDate(post.created_at) }}</td>
                  <td v-if="canWrite" class="px-6 py-4 text-right">
                    <button @click="viewPostDetail(post)" class="p-2 rounded-lg hover:bg-foreground/5 text-foreground/60 transition-all">👁️</button>
                    <button @click="deletePost(post, true)" class="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Topics Tab -->
        <div v-else-if="currentTab === 'topics'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">话题管理</h2>
            <div class="relative">
              <input
                v-model="topicSearch"
                type="text"
                placeholder="搜索话题..."
                class="bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:border-primary/50 w-64"
                @keyup.enter="fetchAdminTopics"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-lg">🔍</span>
            </div>
          </div>
          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-4">话题名</th>
                  <th class="px-6 py-4">描述</th>
                  <th class="px-6 py-4">创建时间</th>
                  <th v-if="canWrite" class="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="topic in adminTopics" :key="topic.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-6 py-4 font-bold text-white"># {{ topic.name }}</td>
                  <td class="px-6 py-4 text-foreground/70 line-clamp-1">{{ topic.description || '无描述' }}</td>
                  <td class="px-6 py-4 text-foreground/50 text-xs">{{ formatDate(topic.created_at) }}</td>
                  <td v-if="canWrite" class="px-6 py-4 text-right">
                    <button @click="viewTopicDetail(topic)" class="p-2 rounded-lg hover:bg-foreground/5 text-foreground/60 transition-all">👁️</button>
                    <button @click="deleteTopic(topic, true)" class="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Groups Tab -->
        <div v-else-if="currentTab === 'groups'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">群聊管理</h2>
            <div class="relative">
              <input
                v-model="groupSearch"
                type="text"
                placeholder="搜索群聊名称..."
                class="bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:border-primary/50 w-64"
                @keyup.enter="fetchAdminGroups"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-lg">🔍</span>
            </div>
          </div>
          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-4">群名</th>
                  <th class="px-6 py-4">成员数</th>
                  <th class="px-6 py-4">创建时间</th>
                  <th v-if="canWrite" class="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="group in adminGroups" :key="group.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-6 py-4 font-bold text-white">{{ group.name }}</td>
                  <td class="px-6 py-4 text-foreground/70">{{ group.member_count }}</td>
                  <td class="px-6 py-4 text-foreground/50 text-xs">{{ formatDate(group.created_at) }}</td>
                  <td v-if="canWrite" class="px-6 py-4 text-right">
                    <button @click="viewGroupDetail(group)" class="p-2 rounded-lg hover:bg-foreground/5 text-foreground/60 transition-all">👁️</button>
                    <button @click="deleteGroup(group, true)" class="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Sponsorships Tab -->
        <div v-else-if="currentTab === 'sponsorships'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">赞助记录</h2>
            <div class="flex items-center space-x-2">
              <button v-if="canWrite" @click="openAddSponsorshipModal" class="glass-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2">
                <span>➕</span> <span>添加记录</span>
              </button>
              <button @click="fetchSponsorships" class="p-2 rounded-xl hover:bg-foreground/5 text-foreground/40 transition-all">🔄 刷新</button>
            </div>
          </div>
          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-4">赞助者</th>
                  <th class="px-6 py-4">金额</th>
                  <th class="px-6 py-4">方式</th>
                  <th class="px-6 py-4">时间</th>
                  <th v-if="canWrite" class="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="item in sponsorships" :key="item.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-6 py-4 font-bold text-white">{{ item.username }}</td>
                  <td class="px-6 py-4 text-primary font-black">¥ {{ item.amount }}</td>
                  <td class="px-6 py-4 text-foreground/70">{{ item.method }}</td>
                  <td class="px-6 py-4 text-foreground/50 text-xs">{{ formatDate(item.created_at) }}</td>
                  <td v-if="canWrite" class="px-6 py-4 text-right">
                    <button @click="deleteSponsorship(item, true)" class="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Notifications Tab -->
        <div v-else-if="currentTab === 'notifications'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">系统通知管理</h2>
            <div class="relative">
              <input
                v-model="notifSearch"
                type="text"
                placeholder="搜索通知内容..."
                class="bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:border-primary/50 w-64"
                @keyup.enter="fetchNotifications"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-lg">🔍</span>
            </div>
          </div>
          
          <!-- Send Batch Notif Form -->
          <div class="glass-card p-6 space-y-4">
            <h3 class="font-bold text-white text-sm">群发系统通知</h3>
            <div class="space-y-3">
              <input v-model="notifTitle" type="text" placeholder="通知标题" class="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50" />
              <textarea v-model="notifContent" placeholder="通知内容..." rows="3" class="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50"></textarea>
              <button @click="sendBatchNotification" class="glass-btn-primary px-6 py-2 rounded-xl text-xs font-bold">立即发送给所有用户</button>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-4">标题</th>
                  <th class="px-6 py-4">内容摘要</th>
                  <th class="px-6 py-4">时间</th>
                  <th v-if="canWrite" class="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="notif in notifications" :key="notif.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-6 py-4 font-bold text-white">{{ notif.title }}</td>
                  <td class="px-6 py-4 text-foreground/70 line-clamp-1">{{ notif.content }}</td>
                  <td class="px-6 py-4 text-foreground/50 text-xs">{{ formatDate(notif.created_at) }}</td>
                  <td v-if="canWrite" class="px-6 py-4 text-right">
                    <button @click="deleteNotification(notif, true)" class="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Messages Tab -->
        <div v-else-if="currentTab === 'messages'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">消息管理</h2>
            <div class="relative">
              <input
                v-model="messageSearch"
                type="text"
                placeholder="搜索消息内容/发送者/接收者..."
                class="bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:border-primary/50 w-64"
                @keyup.enter="fetchMessages"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-lg">🔍</span>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-4">发送者</th>
                  <th class="px-6 py-4">接收者</th>
                  <th class="px-6 py-4">内容</th>
                  <th class="px-6 py-4">状态</th>
                  <th class="px-6 py-4">时间</th>
                  <th v-if="canWrite" class="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="msg in adminMessages" :key="msg.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-6 py-4 font-bold text-white">{{ msg.sender_username }}</td>
                  <td class="px-6 py-4 font-bold text-white">{{ msg.receiver_username || '群聊' }}</td>
                  <td class="px-6 py-4">
                    <div class="text-foreground/80 line-clamp-1 max-w-md">{{ msg.content }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-col space-y-1">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary w-fit">
                        {{ msg.is_burned ? '阅后即焚' : '普通' }}
                      </span>
                      <span v-if="!msg.is_visible" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-500/10 text-gray-400 w-fit">
                        不可见
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-foreground/50 text-xs">{{ formatDate(msg.created_at) }}</td>
                  <td v-if="canWrite" class="px-6 py-4 text-right">
                    <button
                      @click="deleteMessage(msg, true)"
                      class="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all active:scale-90"
                      title="删除"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="adminMessages.length === 0" class="p-12 text-center text-foreground/20 italic">
              未找到相关消息数据
            </div>
          </div>
        </div>

        <!-- Games Management -->
        <div v-else-if="currentTab === 'games'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">游戏房间管理</h2>
            <div class="flex items-center space-x-3">
              <div class="relative">
                <input
                  v-model="gameRoomSearch"
                  type="text"
                  placeholder="搜索房间名称..."
                  class="bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:border-primary/50 w-64"
                  @keyup.enter="fetchGameRooms"
                />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-lg">🔍</span>
              </div>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-4">房间名</th>
                  <th class="px-6 py-4">类型</th>
                  <th class="px-6 py-4">人数/容量</th>
                  <th class="px-6 py-4">状态</th>
                  <th class="px-6 py-4">创建时间</th>
                  <th v-if="canWrite" class="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="room in adminGameRooms" :key="room.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-6 py-4 font-bold text-white">{{ room.name }}</td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-0.5 rounded bg-primary/10 text-[10px] font-bold text-primary uppercase">{{ room.type }}</span>
                  </td>
                  <td class="px-6 py-4 text-foreground/70">{{ room.current_players || 0 }} / {{ room.max_players }}</td>
                  <td class="px-6 py-4">
                    <div class="flex flex-col space-y-1">
                      <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit', room.status === 'playing' ? 'text-green-400 bg-green-400/10' : 'text-blue-400 bg-blue-400/10']">
                        {{ room.status }}
                      </span>
                      <span v-if="!room.is_visible" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-500/10 text-gray-400 w-fit">
                        不可见
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-foreground/50 text-xs">{{ formatDate(room.created_at) }}</td>
                  <td v-if="canWrite" class="px-6 py-4 text-right">
                    <button
                      @click="deleteGameRoom(room, true)"
                      class="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all active:scale-90"
                      title="删除"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="adminGameRooms.length === 0" class="p-12 text-center text-foreground/20 italic">
              未找到相关游戏房间数据
            </div>
          </div>
        </div>

        <!-- Monitoring -->
        <div v-else-if="currentTab === 'monitoring'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">实时在线用户监控</h2>
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span class="text-xs font-bold text-green-500 uppercase">Live Monitoring</span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div v-for="user in onlineUsers" :key="user.id" class="glass-card p-4 flex items-center space-x-4 border-l-4 border-green-500">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl overflow-hidden">
                <img v-if="user.avatar" :src="user.avatar" class="w-full h-full object-cover" />
                <span v-else>{{ user.username.charAt(0).toUpperCase() }}</span>
              </div>
              <div>
                <div class="font-bold text-white text-sm">{{ user.nickname || user.username }}</div>
                <div class="text-[10px] text-foreground/40">活跃于: {{ formatDate(user.last_active) }}</div>
              </div>
            </div>
          </div>
          <div v-if="onlineUsers.length === 0" class="glass-card p-12 text-center text-foreground/20 italic">
            暂无在线用户或监控数据收集中...
          </div>
        </div>

        <!-- Placeholder for other tabs -->
        <div v-else class="flex flex-col items-center justify-center h-full space-y-4">
          <div class="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-4xl">
            {{ navItems.find(i => i.id === currentTab)?.icon }}
          </div>
          <div class="text-center">
            <h2 class="text-xl font-bold text-white">{{ navItems.find(i => i.id === currentTab)?.name }}模块</h2>
            <p class="text-sm text-foreground/50">该功能模块正在集成中，请稍后...</p>
          </div>
        </div>
      </main>
    </div>

    <!-- User Detail Modal Placeholder -->
    <Transition name="fade">
      <div v-if="showUserModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showUserModal = false">
        <div class="w-full max-w-2xl glass-modal rounded-[2rem] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
          <div class="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 class="text-base font-bold text-white">用户详细资料</h2>
            <button @click="showUserModal = false" class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-white/40 active:scale-90 transition-all">✕</button>
          </div>
          
          <div class="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div v-if="selectedUser" class="space-y-6">
              <div class="flex items-center space-x-6">
                <div class="w-20 h-20 rounded-[2rem] bg-primary/20 flex items-center justify-center text-3xl font-bold border-2 border-primary/20 shadow-lg shadow-primary/10">
                  {{ selectedUser.username.charAt(0).toUpperCase() }}
                </div>
                <div class="flex-1">
                  <div class="flex items-center space-x-3">
                    <h4 class="text-2xl font-black text-white">{{ selectedUser.nickname || selectedUser.username }}</h4>
                    <span
                      :class="[
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        selectedUser.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      ]"
                    >
                      {{ selectedUser.status }}
                    </span>
                  </div>
                  <div class="text-sm text-white/40 mt-1 uppercase tracking-widest font-black">用户 ID: {{ selectedUser.id }} · @{{ selectedUser.username }}</div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="glass p-4 rounded-2xl border border-white/5 space-y-1">
                  <div class="text-[10px] font-black text-white/20 uppercase tracking-widest">邮箱地址</div>
                  <div class="text-sm text-white/80 font-bold">{{ selectedUser.email || '未绑定' }}</div>
                </div>
                <div class="glass p-4 rounded-2xl border border-white/5 space-y-1">
                  <div class="text-[10px] font-black text-white/20 uppercase tracking-widest">手机号码</div>
                  <div class="text-sm text-white/80 font-bold">{{ selectedUser.phone || '未绑定' }}</div>
                </div>
                <div class="glass p-4 rounded-2xl border border-white/5 space-y-1">
                  <div class="text-[10px] font-black text-white/20 uppercase tracking-widest">注册时间</div>
                  <div class="text-sm text-white/80 font-bold">{{ formatDate(selectedUser.created_at) }}</div>
                </div>
                <div class="glass p-4 rounded-2xl border border-white/5 space-y-1">
                  <div class="text-[10px] font-black text-white/20 uppercase tracking-widest">最后活动</div>
                  <div class="text-sm text-white/80 font-bold">{{ formatDate(selectedUser.last_login_at) }}</div>
                </div>
              </div>

              <div class="flex items-center justify-between p-6 bg-primary/5 rounded-[2rem] border border-primary/10 shadow-inner">
                <div class="flex items-center space-x-4">
                  <span class="text-3xl">💎</span>
                  <div>
                    <div class="text-[10px] font-black text-primary/60 uppercase tracking-widest">用户积分</div>
                    <div class="text-xl font-black text-primary">{{ selectedUser.points || 0 }} Points</div>
                  </div>
                </div>
                <button class="glass-btn-primary px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest">积分管理</button>
              </div>
            </div>
          </div>
          
          <div class="p-6 bg-white/5 border-t border-white/5 flex justify-end">
            <button @click="showUserModal = false" class="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all">关闭</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Data Modal for Friends/Chats/Matches/IPs -->
    <Transition name="fade">
      <div v-if="showDataModal" class="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showDataModal = false">
        <div class="w-full max-w-4xl glass-modal rounded-[2rem] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[85vh]">
          <div class="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h3 class="font-bold text-white flex items-center space-x-2">
              <span class="text-xl">{{ dataModalType === 'friends' ? '👥' : dataModalType === 'chats' ? '💬' : dataModalType === 'matches' ? '🤝' : '🌐' }}</span>
              <span class="text-base">{{ dataModalTitle }}</span>
            </h3>
            <button @click="showDataModal = false" class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-white/40 active:scale-90 transition-all">✕</button>
          </div>
          
          <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div v-if="dataModalLoading" class="flex items-center justify-center h-48 text-white/20 italic animate-pulse">
              数据加载中...
            </div>
            <div v-else-if="dataModalContent.length === 0" class="flex flex-col items-center justify-center h-48 text-white/10 italic space-y-3">
              <span class="text-5xl opacity-20">📭</span>
              <span class="text-xs font-black uppercase tracking-widest">暂无相关记录</span>
            </div>
            <div v-else class="space-y-4">
              <!-- Friends View -->
              <div v-if="dataModalType === 'friends'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="friend in dataModalContent" :key="friend.id" class="glass p-4 rounded-2xl border border-white/5 flex items-center space-x-4 hover:bg-white/5 transition-colors">
                  <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                    {{ friend.username?.charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-white truncate">{{ friend.nickname || friend.username }}</div>
                    <div class="text-[10px] text-white/30 truncate uppercase tracking-widest">@{{ friend.username }}</div>
                  </div>
                  <div class="flex flex-col items-end space-y-1">
                    <div class="text-[10px] text-white/20 font-black">{{ formatDate(friend.created_at) }}</div>
                    <button @click="viewTwoUserChats(selectedUser.id, friend.id, friend.username)" class="text-[10px] text-primary hover:underline font-bold uppercase tracking-tighter">聊天记录</button>
                  </div>
                </div>
              </div>

              <!-- Chats View -->
              <div v-if="dataModalType === 'chats'" class="space-y-4">
                <div v-for="msg in dataModalContent" :key="msg.id" class="glass p-5 rounded-2xl border border-white/5 space-y-3 hover:bg-white/5 transition-colors">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <span class="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md">{{ msg.sender_username }}</span>
                      <span class="text-white/10">▶</span>
                      <span class="text-[10px] font-black text-white/40 uppercase tracking-widest">{{ msg.receiver_username || '群聊' }}</span>
                    </div>
                    <span class="text-[10px] font-black text-white/20 uppercase tracking-widest">{{ formatDate(msg.created_at) }}</span>
                  </div>
                  <div class="text-sm text-white/80 leading-relaxed font-medium">{{ msg.content }}</div>
                </div>
              </div>

              <!-- Matches View -->
              <div v-if="dataModalType === 'matches'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="match in dataModalContent" :key="match.id" class="glass p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div class="flex items-center space-x-4">
                    <div class="flex -space-x-3">
                      <div class="w-10 h-10 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-black text-primary">
                        {{ match.user1_username?.charAt(0).toUpperCase() }}
                      </div>
                      <div class="w-10 h-10 rounded-full bg-secondary/20 border-2 border-background flex items-center justify-center text-xs font-black text-secondary">
                        {{ match.user2_username?.charAt(0).toUpperCase() }}
                      </div>
                    </div>
                    <div>
                      <div class="text-xs font-black text-white uppercase tracking-tight">{{ match.user1_username }} ❤️ {{ match.user2_username }}</div>
                      <div class="text-[10px] font-black text-primary/60 uppercase tracking-widest">匹配度: {{ match.score || 'N/A' }}%</div>
                    </div>
                  </div>
                  <div class="text-[10px] font-black text-white/20 uppercase tracking-widest">{{ formatDate(match.created_at) }}</div>
                </div>
              </div>

              <!-- IPs View -->
              <div v-if="dataModalType === 'ips'" class="glass rounded-[2rem] overflow-hidden border border-white/5">
                <table class="w-full text-left text-xs">
                  <thead class="bg-white/5 text-white/30 font-black uppercase tracking-widest">
                    <tr>
                      <th class="px-6 py-4">IP 地址</th>
                      <th class="px-6 py-4">地理位置</th>
                      <th class="px-6 py-4">设备信息</th>
                      <th class="px-6 py-4 text-right">登录时间</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    <tr v-for="log in dataModalContent" :key="log.id" class="hover:bg-white/5 transition-colors">
                      <td class="px-6 py-4 font-mono text-primary font-bold">{{ log.ip_address }}</td>
                      <td class="px-6 py-4 text-white/60 font-bold">{{ log.location || '未知' }}</td>
                      <td class="px-6 py-4 text-white/30 max-w-[200px] truncate font-medium" :title="log.user_agent">{{ log.user_agent }}</td>
                      <td class="px-6 py-4 text-right text-white/20 font-black uppercase tracking-tighter">{{ formatDate(log.login_time || log.created_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div class="px-6 py-5 border-t border-white/5 flex justify-end bg-white/5">
            <button @click="showDataModal = false" class="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all">关闭窗口</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Add Sponsorship Modal -->
    <Transition name="fade">
      <div v-if="showAddSponsorshipModal" class="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showAddSponsorshipModal = false">
        <div class="w-full max-w-md glass-modal rounded-[2rem] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col">
          <div class="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 class="text-base font-bold text-white">添加赞助记录</h2>
            <button @click="showAddSponsorshipModal = false" class="w-8 h-8 rounded-full glass-btn flex items-center justify-center text-white/40 active:scale-90 transition-all">✕</button>
          </div>
          
          <div class="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">赞助者用户名</label>
              <input 
                v-model="newSponsorship.username" 
                type="text" 
                placeholder="输入用户名..." 
                class="glass-input w-full py-3 px-5 rounded-2xl text-sm" 
              />
            </div>
            
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">金额 (元)</label>
              <input 
                v-model="newSponsorship.amount" 
                type="number" 
                placeholder="0.00" 
                class="glass-input w-full py-3 px-5 rounded-2xl text-sm" 
              />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">支付方式</label>
                <GlassSelect 
                  v-model="newSponsorship.payment_method" 
                  :options="paymentMethodOptions"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">状态</label>
                <GlassSelect 
                  v-model="newSponsorship.status" 
                  :options="sponsorshipStatusOptions"
                />
              </div>
            </div>
            
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">备注</label>
              <textarea 
                v-model="newSponsorship.remark" 
                placeholder="添加备注..." 
                rows="3" 
                class="glass-input w-full py-3 px-5 rounded-2xl text-sm"
              ></textarea>
            </div>
          </div>
          
          <div class="p-6 bg-white/5 border-t border-white/5 flex space-x-3">
            <button @click="showAddSponsorshipModal = false" class="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 transition-all font-black text-xs uppercase tracking-widest">取消</button>
            <button @click="submitSponsorship" class="flex-1 glass-btn-primary py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-[0.98] transition-all">确认添加</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import GlassSelect from '@/components/GlassSelect.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Permission Check
const isSuperAdminView = computed(() => route.path.startsWith('/superadmin') && authStore.isSuperAdmin);
const canWrite = computed(() => isSuperAdminView.value);

// Super Admin Options
const showInvisible = ref(true);
const isSidebarCollapsed = ref(false);

// Navigation
const currentTab = ref('stats');
const navItems = computed(() => {
  const items = [
    { id: 'stats', name: '数据概览', icon: '📊' },
    { id: 'users', name: '用户管理', icon: '👥' },
    { id: 'posts', name: '帖子管理', icon: '📝' },
    { id: 'topics', name: '话题管理', icon: '🏷️' },
    { id: 'groups', name: '群聊管理', icon: '💬' },
    { id: 'sponsorships', name: '赞助记录', icon: '💰' },
    { id: 'notifications', name: '系统通知', icon: '📢' },
    { id: 'games', name: '游戏房间', icon: '🎮' },
  ];
  return items;
});

// Stats Data
const dashboardStats = reactive({
  total_users: 0,
  active_users: 0,
  today_users: 0,
  total_posts: 0,
  today_posts: 0,
  total_messages: 0,
  today_messages: 0,
  total_matches: 0,
});

const getStatName = (key: string) => {
  const names: Record<string, string> = {
    total_users: '总用户数',
    active_users: '在线/活跃',
    today_users: '今日新增',
    total_posts: '总动态数',
    today_posts: '今日动态',
    total_messages: '总消息量',
    today_messages: '今日消息',
    total_matches: '总匹配数',
  };
  return names[key] || key;
};

const getStatIcon = (key: string) => {
  const icons: Record<string, string> = {
    total_users: '👥',
    active_users: '🟢',
    today_users: '🆕',
    total_posts: '📝',
    today_posts: '✨',
    total_messages: '💬',
    today_messages: '📨',
    total_matches: '🤝',
  };
  return icons[key] || '📊';
};

// User Data
const users = ref<any[]>([]);
const userSearch = ref('');
const userStatusFilter = ref('all');
const userStatusOptions = [
  { value: 'all', label: '所有状态' },
  { value: 'active', label: '活跃' },
  { value: 'frozen', label: '冻结' }
];
const userPagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

const showUserModal = ref(false);
const selectedUser = ref<any>(null);
const activeMenuUserId = ref<number | null>(null);

// Data Modal for extra info
const showDataModal = ref(false);
const dataModalTitle = ref('');
const dataModalType = ref('');
const dataModalContent = ref<any[]>([]);
const dataModalLoading = ref(false);

async function viewUserFriends(user: any) {
  selectedUser.value = user;
  dataModalTitle.value = `@${user.username} 的好友列表`;
  dataModalType.value = 'friends';
  showDataModal.value = true;
  dataModalLoading.value = true;
  activeMenuUserId.value = null;
  try {
    const res = await api.get(`/admin/users/${user.id}/friends`);
    dataModalContent.value = res.data.friends || [];
  } catch (error) {
    console.error('获取好友失败:', error);
    dataModalContent.value = [];
  } finally {
    dataModalLoading.value = false;
  }
}

async function viewTwoUserChats(userId1: number, userId2: number, username2: string) {
  dataModalTitle.value = `与 @${username2} 的私聊记录`;
  dataModalType.value = 'chats';
  dataModalLoading.value = true;
  try {
    // 这里需要后端支持两个用户之间的消息查询，或者在前端过滤
    const res = await api.get('/admin/messages', { 
      params: { 
        user_id: userId1,
        receiver_id: userId2 // 假设后端支持 receiver_id 过滤
      } 
    });
    dataModalContent.value = res.data.messages || [];
  } catch (error) {
    console.error('获取私聊记录失败:', error);
    dataModalContent.value = [];
  } finally {
    dataModalLoading.value = false;
  }
}

async function viewUserChats(user: any) {
  dataModalTitle.value = `@${user.username} 的聊天记录`;
  dataModalType.value = 'chats';
  showDataModal.value = true;
  dataModalLoading.value = true;
  activeMenuUserId.value = null;
  try {
    const res = await api.get('/admin/messages', { params: { user_id: user.id } });
    dataModalContent.value = res.data.messages || [];
  } catch (error) {
    console.error('获取聊天记录失败:', error);
    dataModalContent.value = [];
  } finally {
    dataModalLoading.value = false;
  }
}

async function viewUserMatches(user: any) {
  dataModalTitle.value = `@${user.username} 的匹配记录`;
  dataModalType.value = 'matches';
  showDataModal.value = true;
  dataModalLoading.value = true;
  activeMenuUserId.value = null;
  try {
    const res = await api.get(`/admin/users/${user.id}/matches`);
    dataModalContent.value = res.data.matches || [];
  } catch (error) {
    console.error('获取匹配记录失败:', error);
    dataModalContent.value = [];
  } finally {
    dataModalLoading.value = false;
  }
}

async function viewUserLoginIPs(user: any) {
  dataModalTitle.value = `@${user.username} 的登录 IP 日志`;
  dataModalType.value = 'ips';
  showDataModal.value = true;
  dataModalLoading.value = true;
  activeMenuUserId.value = null;
  try {
    const res = await api.get(`/admin/users/${user.id}/login-logs`);
    dataModalContent.value = res.data.logs || [];
  } catch (error) {
    console.error('获取登录日志失败:', error);
    dataModalContent.value = [];
  } finally {
    dataModalLoading.value = false;
  }
}

async function promoteToAdmin(user: any) {
  if (!confirm(`确定要将用户 @${user.username} 设为管理员吗？`)) return;
  activeMenuUserId.value = null;
  try {
    // 假设角色名称为 'admin'，通常需要先获取角色列表找到 ID
    const rolesRes = await api.get('/admin/roles');
    const adminRole = rolesRes.data.roles.find((r: any) => r.name === 'admin');
    if (!adminRole) {
      alert('未找到管理员角色定义');
      return;
    }
    await api.post(`/admin/users/${user.id}/roles`, { role_id: adminRole.id });
    alert('已成功设为管理员');
    fetchUsers();
  } catch (error) {
    console.error('设置管理员失败:', error);
    alert('操作失败');
  }
}

async function sendUserNotif(user: any) {
  const title = prompt(`发送给 @${user.username} 的通知标题:`, '系统通知');
  if (!title) return;
  const content = prompt(`发送给 @${user.username} 的通知内容:`);
  if (!content) return;
  
  activeMenuUserId.value = null;
  try {
    await api.post('/admin/notifications/system/batch', {
      userIds: [user.id],
      title,
      content
    });
    alert('通知发送成功');
  } catch (error) {
    console.error('发送通知失败:', error);
    alert('操作失败');
  }
}

async function modifyUserPoints(user: any) {
  const points = prompt(`修改 @${user.username} 的积分 (当前: ${user.points || 0}):`, user.points);
  if (points === null) return;
  
  activeMenuUserId.value = null;
  try {
    await api.put(`/admin/users/${user.id}`, { points: parseInt(points) });
    alert('积分修改成功');
    fetchUsers();
  } catch (error) {
    console.error('修改积分失败:', error);
    alert('操作失败');
  }
}

// v-click-outside directive
const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: any) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value();
      }
    };
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el: any) {
    document.removeEventListener('click', el.clickOutsideEvent);
  },
};

// Role Data
const roles = ref<any[]>([]);

// Config Data
const configs = ref<any[]>([]);
const currentConfigCategory = ref('general');
const configCategories = [
  { id: 'general', name: '常规' },
  { id: 'system', name: '系统' },
  { id: 'upload', name: '上传' },
  { id: 'user', name: '用户' },
  { id: 'points', name: '积分' },
  { id: 'security', name: '安全' },
];

const filteredConfigs = computed(() => {
  return configs.value.filter(c => c.category === currentConfigCategory.value);
});

// Lifecycle
onMounted(() => {
  if (!authStore.isAdmin && !authStore.isInitialLoading) {
    router.replace('/home');
    return;
  }
  fetchStats();
  fetchUsers();
  fetchRoles();
  fetchConfigs();
});

// Watch for admin status changes (e.g. session expired or logout)
watch(() => authStore.isAdmin, (newVal) => {
  if (!newVal && !authStore.isInitialLoading) {
    router.replace('/home');
  }
});

// Methods
async function fetchRoles() {
  try {
    const res = await api.get('/admin/roles');
    roles.value = res.data.roles;
  } catch (error) {
    console.error('获取角色列表失败:', error);
  }
}

async function deleteRole(role: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm(`确定要彻底删除角色 ${role.display_name} 吗？此操作不可恢复！`)) return;
  } else {
    if (!confirm(`确定要删除角色 ${role.display_name} 吗？`)) return;
  }

  try {
    await api.delete(`/admin/roles/${role.id}`, {
      params: { permanent }
    });
    alert(`${permanent ? '彻底' : '软'}删除成功`);
    fetchRoles();
  } catch (error) {
    console.error('删除角色失败:', error);
    alert('操作失败');
  }
}

function editRole(role: any) {
  alert('角色编辑功能集成中...');
  // TODO: 实现角色编辑弹窗
}

async function fetchConfigs() {
  try {
    const res = await api.get('/admin/configs', {
      params: {
        show_invisible: showInvisible.value
      }
    });
    configs.value = res.data.configs;
  } catch (error) {
    console.error('获取系统配置失败:', error);
  }
}

async function deleteConfig(config: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该配置吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该配置吗？')) return;
  }

  try {
    await api.delete(`/admin/configs/${config.id}`, {
      params: { permanent }
    });
    alert('操作成功');
    fetchConfigs();
  } catch (error) {
    console.error('删除配置失败:', error);
    alert('操作失败');
  }
}
async function updateConfig(config: any, newValue: any) {
  try {
    await api.put(`/admin/configs/${config.config_key}`, { config_value: String(newValue) });
    config.config_value = String(newValue);
    alert('配置更新成功');
  } catch (error) {
    console.error('更新配置失败:', error);
    alert('操作失败');
  }
}

// Log Data
const logs = ref<any[]>([]);
const currentLogType = ref('operation');
const logTypes = [
  { id: 'operation', name: '操作日志' },
  { id: 'system', name: '系统日志' },
  { id: 'security', name: '安全审计' },
];

// Sponsorship Data
const sponsorships = ref<any[]>([]);
const showAddSponsorshipModal = ref(false);
const newSponsorship = reactive({
  username: '',
  amount: '',
  payment_method: '微信支付',
  status: 'completed',
  remark: ''
});

const paymentMethodOptions = ['微信支付', '支付宝', 'QQ支付', '银行卡', '其他'];
const sponsorshipStatusOptions = [
  { value: 'completed', label: '已完成' },
  { value: 'pending', label: '处理中' }
];

function openAddSponsorshipModal() {
  newSponsorship.username = '';
  newSponsorship.amount = '';
  newSponsorship.payment_method = '微信支付';
  newSponsorship.status = 'completed';
  newSponsorship.remark = '';
  showAddSponsorshipModal.value = true;
}

async function submitSponsorship() {
  if (!newSponsorship.username || !newSponsorship.amount) {
    alert('用户名和金额不能为空');
    return;
  }

  try {
    await api.post('/admin/sponsorships', {
      username: newSponsorship.username,
      amount: parseFloat(newSponsorship.amount),
      payment_method: newSponsorship.payment_method,
      status: newSponsorship.status,
      remark: newSponsorship.remark
    });
    alert('添加成功');
    showAddSponsorshipModal.value = false;
    fetchSponsorships();
  } catch (error: any) {
    console.error('添加赞助记录失败:', error);
    alert(error.response?.data?.error || '操作失败');
  }
}

// Post Data
const adminPosts = ref<any[]>([]);
const postSearch = ref('');
const postStatusFilter = ref('all');

// Topic Data
const adminTopics = ref<any[]>([]);
const topicSearch = ref('');

// Group Data
const adminGroups = ref<any[]>([]);
const groupSearch = ref('');

// Message Data
const adminMessages = ref<any[]>([]);
const messageSearch = ref('');

async function fetchMessages() {
  try {
    const res = await api.get('/admin/messages', {
      params: {
        search: messageSearch.value,
        show_invisible: showInvisible.value
      }
    });
    adminMessages.value = res.data.messages || [];
  } catch (error) {
    console.error('获取消息列表失败:', error);
  }
}

async function deleteMessage(message: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该消息吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该消息吗？')) return;
  }

  try {
    await api.delete(`/admin/messages/${message.id}`, {
      params: { permanent }
    });
    alert('操作成功');
    fetchMessages();
  } catch (error) {
    console.error('删除消息失败:', error);
    alert('操作失败');
  }
}

// Game Room Data
const adminGameRooms = ref<any[]>([]);
const gameRoomSearch = ref('');

async function fetchGameRooms() {
  try {
    const res = await api.get('/admin/games/rooms', {
      params: {
        search: gameRoomSearch.value,
        show_invisible: showInvisible.value
      }
    });
    adminGameRooms.value = res.data.rooms || [];
  } catch (error) {
    console.error('获取游戏房间列表失败:', error);
  }
}

async function deleteGameRoom(room: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该房间吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该房间吗？')) return;
  }

  try {
    await api.delete(`/admin/games/rooms/${room.id}`, {
      params: { permanent }
    });
    alert('操作成功');
    fetchGameRooms();
  } catch (error) {
    console.error('删除房间失败:', error);
    alert('操作失败');
  }
}

// Notification Data
const notifications = ref<any[]>([]);
const notifSearch = ref('');
const notifTitle = ref('');
const notifContent = ref('');

async function fetchNotifications() {
  try {
    const res = await api.get('/admin/notifications', {
      params: {
        search: notifSearch.value,
        show_invisible: showInvisible.value
      }
    });
    notifications.value = res.data.notifications || [];
  } catch (error) {
    console.error('获取通知列表失败:', error);
  }
}

async function deleteNotification(notification: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该通知吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该通知吗？')) return;
  }

  try {
    await api.delete(`/admin/notifications/${notification.id}`, {
      params: { permanent }
    });
    alert('操作成功');
    fetchNotifications();
  } catch (error) {
    console.error('删除通知失败:', error);
    alert('操作失败');
  }
}

// Monitoring Data
const onlineUsers = ref<any[]>([]);

// Watch currentTab to fetch data
watch(currentTab, (newTab) => {
  if (newTab === 'stats') fetchStats();
  if (newTab === 'users') fetchUsers();
  if (newTab === 'posts') fetchAdminPosts();
  if (newTab === 'topics') fetchAdminTopics();
  if (newTab === 'groups') fetchAdminGroups();
  if (newTab === 'roles') fetchRoles();
  if (newTab === 'configs') fetchConfigs();
  if (newTab === 'logs') fetchLogs();
  if (newTab === 'sponsorships') fetchSponsorships();
  if (newTab === 'notifications') fetchNotifications();
  if (newTab === 'monitoring') fetchOnlineUsers();
  if (newTab === 'messages') fetchMessages();
  if (newTab === 'games') fetchGameRooms();
});

// Watch showInvisible to re-fetch data
watch(showInvisible, () => {
  const tabFetchers: Record<string, () => void> = {
    users: fetchUsers,
    posts: fetchAdminPosts,
    topics: fetchAdminTopics,
    groups: fetchAdminGroups,
    roles: fetchRoles,
    configs: fetchConfigs,
    logs: fetchLogs,
    messages: fetchMessages,
    games: fetchGameRooms,
    sponsorships: fetchSponsorships,
    notifications: fetchNotifications
  };
  if (tabFetchers[currentTab.value]) {
    tabFetchers[currentTab.value]();
  }
});

// Watch currentLogType to fetch data
watch(currentLogType, () => {
  fetchLogs();
});

async function deleteLog(log: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该日志吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该日志吗？')) return;
  }

  try {
    await api.delete(`/admin/logs/${currentLogType.value}/${log.id}`, {
      params: { permanent }
    });
    alert('操作成功');
    fetchLogs();
  } catch (error) {
    console.error('删除日志失败:', error);
    alert('操作失败');
  }
}
async function fetchLogs() {
  try {
    const res = await api.get(`/admin/logs/${currentLogType.value}`);
    logs.value = res.data.logs || res.data;
  } catch (error) {
    console.error('获取日志失败:', error);
  }
}

async function fetchAdminPosts() {
  try {
    const res = await api.get('/admin/posts', {
      params: {
        search: postSearch.value,
        status: postStatusFilter.value,
        show_invisible: showInvisible.value
      },
    });
    adminPosts.value = res.data.posts || [];
  } catch (error) {
    console.error('获取帖子列表失败:', error);
  }
}

async function deletePost(post: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该帖子吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该帖子吗？')) return;
  }

  try {
    await api.delete(`/admin/posts/${post.id}`, {
      params: { permanent }
    });
    alert(`${permanent ? '彻底' : '软'}删除成功`);
    fetchAdminPosts();
  } catch (error) {
    console.error('删除失败:', error);
    alert('操作失败');
  }
}

function viewPostDetail(post: any) {
  router.push(`/admin/post/${post.id}`);
}

async function fetchAdminTopics() {
  try {
    const res = await api.get('/admin/topics', {
      params: {
        search: topicSearch.value,
        show_invisible: showInvisible.value
      },
    });
    adminTopics.value = res.data.topics || [];
  } catch (error) {
    console.error('获取话题列表失败:', error);
  }
}

async function deleteTopic(topic: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该话题吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该话题吗？')) return;
  }

  try {
    await api.delete(`/admin/topics/${topic.id}`, {
      params: { permanent }
    });
    alert(`${permanent ? '彻底' : '软'}删除成功`);
    fetchAdminTopics();
  } catch (error) {
    console.error('删除话题失败:', error);
    alert('操作失败');
  }
}

function viewTopicDetail(topic: any) {
  router.push(`/admin/topic/${topic.id}`);
}

async function fetchAdminGroups() {
  try {
    const res = await api.get('/admin/groups', {
      params: {
        search: groupSearch.value,
        show_invisible: showInvisible.value
      },
    });
    adminGroups.value = res.data.groups || [];
  } catch (error) {
    console.error('获取群聊列表失败:', error);
  }
}

async function deleteGroup(group: any, permanent: boolean) {
  const msg = permanent ? '确定要彻底删除该群聊吗？此操作不可恢复！' : '确定要隐藏该群聊吗？';
  if (!confirm(msg)) return;

  try {
    await api.delete(`/admin/groups/${group.id}`, {
      params: { permanent }
    });
    alert('操作成功');
    fetchAdminGroups();
  } catch (error) {
    console.error('删除群聊失败:', error);
    alert('操作失败');
  }
}

function viewGroupDetail(group: any) {
  alert('群聊详情功能开发中...');
}

async function deleteSponsorship(item: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该赞助记录吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该赞助记录吗？')) return;
  }

  try {
    await api.delete(`/admin/sponsorships/${item.id}`, {
      params: { permanent }
    });
    alert('操作成功');
    fetchSponsorships();
  } catch (error) {
    console.error('删除赞助记录失败:', error);
    alert('操作失败');
  }
}

async function fetchSponsorships() {
  try {
    const res = await api.get('/admin/sponsorships', {
      params: {
        show_invisible: showInvisible.value
      }
    });
    sponsorships.value = res.data.sponsorships || [];
  } catch (error) {
    console.error('获取赞助记录失败:', error);
  }
}

async function fetchOnlineUsers() {
  try {
    const res = await api.get('/admin/monitoring/online-users');
    onlineUsers.value = res.data.details || [];
  } catch (error) {
    console.error('获取在线用户失败:', error);
  }
}

async function sendBatchNotification() {
  if (!notifTitle.value || !notifContent.value) {
    alert('标题和内容不能为空');
    return;
  }

  if (!confirm('确定要向所有用户群发通知吗？')) return;

  try {
    const usersRes = await api.get('/admin/users', { params: { limit: 1000 } });
    const userIds = usersRes.data.users.map((u: any) => u.id);

    await api.post('/admin/notifications/system/batch', {
      userIds,
      title: notifTitle.value,
      content: notifContent.value,
    });

    alert('通知发送成功');
    notifTitle.value = '';
    notifContent.value = '';
  } catch (error) {
    console.error('发送通知失败:', error);
    alert('发送失败');
  }
}

async function fetchStats() {
  try {
    const res = await api.get('/admin/stats');
    if (res.data && res.data.stats) {
      Object.assign(dashboardStats, res.data.stats);
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
  }
}

async function fetchUsers() {
  try {
    const res = await api.get('/admin/users', {
      params: {
        page: userPagination.page,
        limit: userPagination.limit,
        search: userSearch.value,
        status: userStatusFilter.value,
        show_invisible: showInvisible.value
      },
    });
    users.value = res.data.users;
    Object.assign(userPagination, res.data.pagination);
  } catch (error) {
    console.error('获取用户列表失败:', error);
  }
}

function changeUserPage(newPage: number) {
  if (newPage < 1 || newPage > userPagination.totalPages) return;
  userPagination.page = newPage;
  fetchUsers();
}

async function viewUserDetail(user: any) {
  try {
    const res = await api.get(`/admin/users/${user.id}`);
    selectedUser.value = { ...res.data.user, ...res.data.stats };
    showUserModal.value = true;
  } catch (error) {
    console.error('获取用户详情失败:', error);
  }
}

async function toggleUserStatus(user: any) {
  const newStatus = user.status === 'active' ? 'frozen' : 'active';
  const confirmMsg = `确定要${newStatus === 'frozen' ? '冻结' : '恢复'}该用户吗？`;
  if (!confirm(confirmMsg)) return;

  try {
    await api.put(`/admin/users/${user.id}/status`, { status: newStatus });
    user.status = newStatus;
  } catch (error) {
    console.error('更新用户状态失败:', error);
    alert('操作失败');
  }
}

async function resetUserPassword(user: any) {
  if (!confirm('确定要重置该用户的密码为 123456 吗？')) return;

  try {
    await api.put(`/admin/users/${user.id}/reset-password`);
    alert('密码重置成功');
  } catch (error) {
    console.error('重置密码失败:', error);
    alert('操作失败');
  }
}

async function resetUserAvatar(user: any) {
  if (!confirm(`确定要重置用户 @${user.username} 的头像吗？`)) return;

  try {
    const res = await api.put(`/admin/users/${user.id}/reset-avatar`);
    alert('头像重置成功');
    fetchUsers(); // 刷新列表以显示新头像
  } catch (error) {
    console.error('重置头像失败:', error);
    alert('操作失败');
  }
}

async function deleteUser(user: any, permanent: boolean = false) {
  if (permanent) {
    if (!confirm('确定要彻底删除该用户吗？此操作不可恢复！')) return;
  } else {
    if (!confirm('确定要删除该用户吗？')) return;
  }

  try {
    await api.delete(`/admin/users/${user.id}`, {
      params: { permanent }
    });
    alert(`${permanent ? '彻底' : '软'}删除成功`);
    fetchUsers();
  } catch (error) {
    console.error('删除用户失败:', error);
    alert('操作失败');
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '从未';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  router.push('/home');
}

function goBack() {
  router.push('/home');
}
</script>

<style scoped>
.glass {
  @apply bg-background/80 backdrop-blur-xl;
}

.glass-card {
  @apply bg-foreground/[0.03] backdrop-blur-md border border-foreground/5 rounded-3xl transition-all;
}

.glass-btn-primary {
  @apply bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: slideIn 0.2s ease-out forwards;
}
</style>
