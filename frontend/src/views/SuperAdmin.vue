<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
    <div class="glass px-4 py-3 flex items-center z-50 shadow-sm border-b border-foreground/5">
      <button
        @click="goBack"
        class="p-2 -ml-2 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-all active:scale-90"
        title="返回"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0 ml-2">
        <div class="text-sm font-bold text-foreground/80">超级管理中心</div>
        <div class="text-[10px] font-black text-primary/60 uppercase tracking-widest">Super Admin</div>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-xs text-foreground/40">超级管理员模式</span>
        <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <aside 
        class="glass border-r border-foreground/5 flex flex-col transition-all duration-300 overflow-y-auto"
        :class="[isSidebarCollapsed ? 'w-16' : 'w-56']"
      >
        <div class="p-3 space-y-1">
          <button
            v-for="item in navItems"
            :key="item.id"
            @click="currentTab = item.id"
            :class="[
              'w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
              currentTab === item.id 
                ? 'bg-primary text-foreground shadow-lg shadow-primary/20' 
                : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
            ]"
          >
            <span class="text-lg">{{ item.icon }}</span>
            <span v-if="!isSidebarCollapsed" class="text-xs font-bold">{{ item.name }}</span>
          </button>
        </div>
        
        <div class="mt-auto p-3 border-t border-foreground/5 space-y-2">
          <button 
            v-if="!isSidebarCollapsed"
            @click="showBatchActions = true"
            class="w-full flex items-center justify-center space-x-2 p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-all text-xs font-bold"
          >
            <span>⚡</span>
            <span>批量操作</span>
          </button>
          <button 
            @click="isSidebarCollapsed = !isSidebarCollapsed"
            class="w-full flex items-center justify-center p-2 rounded-xl hover:bg-foreground/5 text-foreground/40 transition-all"
          >
            {{ isSidebarCollapsed ? '→' : '← 收起' }}
          </button>
        </div>
      </aside>

      <main class="flex-1 overflow-y-auto p-4 bg-foreground/[0.01]">
        <div v-if="currentTab === 'stats'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">系统数据总览</h2>
            <div class="flex items-center space-x-2">
              <button @click="refreshAllStats" class="p-2 rounded-xl hover:bg-foreground/5 text-foreground/40 transition-all text-sm">
                🔄 刷新全部
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div v-for="(val, key) in dashboardStats" :key="key" class="glass-card p-4 space-y-2 hover:bg-foreground/[0.05] transition-all cursor-pointer" @click="navigateToRelatedTab(key)">
              <div class="flex items-center justify-between">
                <span class="text-xl">{{ getStatIcon(key) }}</span>
                <span class="text-[10px] font-bold text-foreground/30 uppercase">{{ getStatName(key) }}</span>
              </div>
              <div class="text-2xl font-black text-foreground">{{ formatNumber(val) }}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="glass-card p-4">
              <h3 class="text-sm font-bold text-foreground mb-4 flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span>实时在线用户 ({{ onlineUsers.length }})</span>
              </h3>
              <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                <div v-for="user in onlineUsers.slice(0, 10)" :key="user.id" class="glass p-2 rounded-xl flex items-center space-x-2">
                  <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">
                    {{ user.username?.charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-foreground truncate">{{ user.nickname || user.username }}</div>
                    <div class="text-[10px] text-foreground/40">{{ formatTimeAgo(user.last_active) }}</div>
                  </div>
                </div>
              </div>
              <button v-if="onlineUsers.length > 10" @click="currentTab = 'monitoring'" class="w-full mt-2 text-xs text-primary hover:underline">
                查看全部 {{ onlineUsers.length }} 人 →
              </button>
            </div>

            <div class="glass-card p-4">
              <h3 class="text-sm font-bold text-foreground mb-4">系统状态</h3>
              <div class="space-y-3">
                <div v-for="status in systemStatus" :key="status.name" class="flex items-center justify-between p-2 rounded-lg bg-foreground/5">
                  <div class="flex items-center space-x-2">
                    <span :class="['w-2 h-2 rounded-full', status.online ? 'bg-green-500' : 'bg-red-500']"></span>
                    <span class="text-xs text-foreground/70">{{ status.name }}</span>
                  </div>
                  <span class="text-[10px]" :class="status.online ? 'text-green-400' : 'text-red-400'">
                    {{ status.online ? '正常' : '异常' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="currentTab === 'users'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">用户管理</h2>
            <div class="flex items-center space-x-2">
              <label class="flex items-center space-x-2 text-xs text-foreground/60 cursor-pointer">
                <input type="checkbox" v-model="showInvisible" class="rounded" @change="fetchUsers">
                <span>显示已隐藏</span>
              </label>
              <div class="relative">
                <input
                  v-model="userSearch"
                  type="text"
                  placeholder="搜索用户..."
                  class="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 pl-9 text-xs focus:outline-none focus:border-primary/50 w-48"
                  @keyup.enter="fetchUsers"
                />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">🔍</span>
              </div>
              <GlassSelect v-model="userStatusFilter" :options="userStatusOptions" @change="fetchUsers" class="w-28" />
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase">
                <tr>
                  <th class="px-4 py-3">用户</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">注册时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="user in users" :key="user.id" class="hover:bg-foreground/[0.02] transition-colors" :class="{ 'opacity-50': !user.is_visible }">
                  <td class="px-4 py-3">
                    <div class="flex items-center space-x-2">
                      <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold">
                        {{ user.username?.charAt(0).toUpperCase() }}
                      </div>
                      <div>
                        <div class="font-bold text-foreground text-xs">{{ user.nickname || user.username }}</div>
                        <div class="text-[10px] text-foreground/40">@{{ user.username }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', getStatusClass(user.status)]">
                      {{ user.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-foreground/50 text-[10px]">{{ formatDate(user.created_at) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-1">
                      <button @click="viewUserDetail(user)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60" title="查看">👁️</button>
                      <button @click="editUser(user)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60" title="编辑">✏️</button>
                      <button @click="toggleUserVisibility(user)" class="p-1.5 rounded-lg hover:bg-foreground/5" :class="user.is_visible ? 'text-foreground/60' : 'text-primary'" :title="user.is_visible ? '隐藏' : '显示'">
                        {{ user.is_visible ? '🙈' : '👁️' }}
                      </button>
                      <button @click="deleteUser(user)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="删除">🗑️</button>
                      <button v-if="isSuperAdmin" @click="permanentDeleteUser(user)" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500" title="彻底删除">💥</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="px-4 py-3 bg-foreground/5 flex items-center justify-between border-t border-foreground/5">
              <div class="text-[10px] text-foreground/40">共 {{ userPagination.total }} 条</div>
              <div class="flex items-center space-x-2">
                <button @click="changeUserPage(userPagination.page - 1)" :disabled="userPagination.page === 1" class="p-1.5 rounded-lg hover:bg-foreground/5 disabled:opacity-30 text-xs">◀</button>
                <span class="text-[10px]">{{ userPagination.page }} / {{ userPagination.totalPages }}</span>
                <button @click="changeUserPage(userPagination.page + 1)" :disabled="userPagination.page === userPagination.totalPages" class="p-1.5 rounded-lg hover:bg-foreground/5 disabled:opacity-30 text-xs">▶</button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="currentTab === 'posts'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">帖子管理</h2>
            <div class="flex items-center space-x-2">
              <label class="flex items-center space-x-2 text-xs text-foreground/60 cursor-pointer">
                <input type="checkbox" v-model="showInvisible" class="rounded" @change="fetchPosts">
                <span>显示已隐藏</span>
              </label>
              <div class="relative">
                <input v-model="postSearch" type="text" placeholder="搜索帖子..." class="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 pl-9 text-xs focus:outline-none focus:border-primary/50 w-48" @keyup.enter="fetchPosts" />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">🔍</span>
              </div>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase">
                <tr>
                  <th class="px-4 py-3">作者</th>
                  <th class="px-4 py-3">内容</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="post in posts" :key="post.id" class="hover:bg-foreground/[0.02] transition-colors" :class="{ 'opacity-50': !post.is_visible }">
                  <td class="px-4 py-3 text-xs font-bold text-foreground">{{ post.username }}</td>
                  <td class="px-4 py-3">
                    <div class="text-foreground/80 line-clamp-1 max-w-xs text-xs">{{ post.content }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', post.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400']">
                      {{ post.status }}
                    </span>
                    <span v-if="!post.is_visible" class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400">隐藏</span>
                  </td>
                  <td class="px-4 py-3 text-foreground/50 text-[10px]">{{ formatDate(post.created_at) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-1">
                      <button @click="viewPostDetail(post)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">👁️</button>
                      <button @click="editPost(post)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">✏️</button>
                      <button @click="togglePostVisibility(post)" class="p-1.5 rounded-lg hover:bg-foreground/5" :class="post.is_visible ? 'text-foreground/60' : 'text-primary'">{{ post.is_visible ? '🙈' : '👁️' }}</button>
                      <button @click="deletePost(post)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">🗑️</button>
                      <button v-if="isSuperAdmin" @click="permanentDeletePost(post)" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500">💥</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="currentTab === 'topics'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">话题管理</h2>
            <div class="flex items-center space-x-2">
              <label class="flex items-center space-x-2 text-xs text-foreground/60 cursor-pointer">
                <input type="checkbox" v-model="showInvisible" class="rounded" @change="fetchTopics">
                <span>显示已隐藏</span>
              </label>
              <div class="relative">
                <input v-model="topicSearch" type="text" placeholder="搜索话题..." class="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 pl-9 text-xs focus:outline-none focus:border-primary/50 w-48" @keyup.enter="fetchTopics" />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">🔍</span>
              </div>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase">
                <tr>
                  <th class="px-4 py-3">话题</th>
                  <th class="px-4 py-3">描述</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="topic in topics" :key="topic.id" class="hover:bg-foreground/[0.02] transition-colors" :class="{ 'opacity-50': !topic.is_visible }">
                  <td class="px-4 py-3 text-xs font-bold text-foreground"># {{ topic.title || topic.name }}</td>
                  <td class="px-4 py-3 text-foreground/70 text-xs line-clamp-1">{{ topic.description || '无描述' }}</td>
                  <td class="px-4 py-3">
                    <span v-if="!topic.is_visible" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400">隐藏</span>
                    <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400">正常</span>
                  </td>
                  <td class="px-4 py-3 text-foreground/50 text-[10px]">{{ formatDate(topic.created_at) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-1">
                      <button @click="viewTopicDetail(topic)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">👁️</button>
                      <button @click="editTopic(topic)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">✏️</button>
                      <button @click="toggleTopicVisibility(topic)" class="p-1.5 rounded-lg hover:bg-foreground/5" :class="topic.is_visible ? 'text-foreground/60' : 'text-primary'">{{ topic.is_visible ? '🙈' : '👁️' }}</button>
                      <button @click="deleteTopic(topic)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">🗑️</button>
                      <button v-if="isSuperAdmin" @click="permanentDeleteTopic(topic)" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500">💥</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="currentTab === 'groups'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">群聊管理</h2>
            <div class="flex items-center space-x-2">
              <label class="flex items-center space-x-2 text-xs text-foreground/60 cursor-pointer">
                <input type="checkbox" v-model="showInvisible" class="rounded" @change="fetchGroups">
                <span>显示已隐藏</span>
              </label>
              <div class="relative">
                <input v-model="groupSearch" type="text" placeholder="搜索群聊..." class="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 pl-9 text-xs focus:outline-none focus:border-primary/50 w-48" @keyup.enter="fetchGroups" />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">🔍</span>
              </div>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase">
                <tr>
                  <th class="px-4 py-3">群名</th>
                  <th class="px-4 py-3">创建者</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="group in groups" :key="group.id" class="hover:bg-foreground/[0.02] transition-colors" :class="{ 'opacity-50': !group.is_visible }">
                  <td class="px-4 py-3 text-xs font-bold text-foreground">{{ group.name }}</td>
                  <td class="px-4 py-3 text-foreground/70 text-xs">{{ group.creator_username || group.creator_nickname }}</td>
                  <td class="px-4 py-3">
                    <span v-if="!group.is_visible" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400">隐藏</span>
                    <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400">正常</span>
                  </td>
                  <td class="px-4 py-3 text-foreground/50 text-[10px]">{{ formatDate(group.created_at) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-1">
                      <button @click="viewGroupDetail(group)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">👁️</button>
                      <button @click="editGroup(group)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">✏️</button>
                      <button @click="toggleGroupVisibility(group)" class="p-1.5 rounded-lg hover:bg-foreground/5" :class="group.is_visible ? 'text-foreground/60' : 'text-primary'">{{ group.is_visible ? '🙈' : '👁️' }}</button>
                      <button @click="deleteGroup(group)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">🗑️</button>
                      <button @click="permanentDeleteGroup(group)" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500">💥</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="currentTab === 'messages'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">消息管理</h2>
            <div class="flex items-center space-x-2">
              <label class="flex items-center space-x-2 text-xs text-foreground/60 cursor-pointer">
                <input type="checkbox" v-model="showInvisible" class="rounded" @change="fetchMessages">
                <span>显示已隐藏</span>
              </label>
              <div class="relative">
                <input v-model="messageSearch" type="text" placeholder="搜索消息..." class="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 pl-9 text-xs focus:outline-none focus:border-primary/50 w-48" @keyup.enter="fetchMessages" />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">🔍</span>
              </div>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase">
                <tr>
                  <th class="px-4 py-3">发送者</th>
                  <th class="px-4 py-3">接收者</th>
                  <th class="px-4 py-3">内容</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="msg in messages" :key="msg.id" class="hover:bg-foreground/[0.02] transition-colors" :class="{ 'opacity-50': !msg.is_visible }">
                  <td class="px-4 py-3 text-xs font-bold text-foreground">{{ msg.sender_username }}</td>
                  <td class="px-4 py-3 text-xs text-foreground/70">{{ msg.receiver_username || '群聊' }}</td>
                  <td class="px-4 py-3">
                    <div class="text-foreground/80 line-clamp-1 max-w-xs text-xs">{{ msg.content }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span v-if="msg.is_burned" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400">阅后即焚</span>
                    <span v-if="!msg.is_visible" class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400">隐藏</span>
                  </td>
                  <td class="px-4 py-3 text-foreground/50 text-[10px]">{{ formatDate(msg.created_at) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-1">
                      <button @click="viewMessageDetail(msg)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">👁️</button>
                      <button @click="toggleMessageVisibility(msg)" class="p-1.5 rounded-lg hover:bg-foreground/5" :class="msg.is_visible ? 'text-foreground/60' : 'text-primary'">{{ msg.is_visible ? '🙈' : '👁️' }}</button>
                      <button @click="deleteMessage(msg)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">🗑️</button>
                      <button @click="permanentDeleteMessage(msg)" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500">💥</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="currentTab === 'games'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">游戏房间管理</h2>
            <div class="flex items-center space-x-2">
              <label class="flex items-center space-x-2 text-xs text-foreground/60 cursor-pointer">
                <input type="checkbox" v-model="showInvisible" class="rounded" @change="fetchGameRooms">
                <span>显示已隐藏</span>
              </label>
              <div class="relative">
                <input v-model="gameRoomSearch" type="text" placeholder="搜索房间..." class="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 pl-9 text-xs focus:outline-none focus:border-primary/50 w-48" @keyup.enter="fetchGameRooms" />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">🔍</span>
              </div>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase">
                <tr>
                  <th class="px-4 py-3">房间名</th>
                  <th class="px-4 py-3">类型</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="room in gameRooms" :key="room.id" class="hover:bg-foreground/[0.02] transition-colors" :class="{ 'opacity-50': !room.is_visible }">
                  <td class="px-4 py-3 text-xs font-bold text-foreground">{{ room.name }}</td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded bg-primary/10 text-[10px] font-bold text-primary uppercase">{{ room.type || 'default' }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', room.status === 'playing' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400']">{{ room.status }}</span>
                    <span v-if="!room.is_visible" class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400">隐藏</span>
                  </td>
                  <td class="px-4 py-3 text-foreground/50 text-[10px]">{{ formatDate(room.created_at) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-1">
                      <button @click="viewGameRoomDetail(room)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">👁️</button>
                      <button @click="editGameRoom(room)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">✏️</button>
                      <button @click="toggleGameRoomVisibility(room)" class="p-1.5 rounded-lg hover:bg-foreground/5" :class="room.is_visible ? 'text-foreground/60' : 'text-primary'">{{ room.is_visible ? '🙈' : '👁️' }}</button>
                      <button @click="deleteGameRoom(room)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">🗑️</button>
                      <button v-if="isSuperAdmin" @click="permanentDeleteGameRoom(room)" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500">💥</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="currentTab === 'notifications'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">系统通知管理</h2>
          </div>

          <div class="glass-card p-4 space-y-3">
            <h3 class="text-sm font-bold text-foreground">群发系统通知</h3>
            <input v-model="batchNotifTitle" type="text" placeholder="通知标题" class="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-xs" />
            <textarea v-model="batchNotifContent" placeholder="通知内容..." rows="3" class="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-xs"></textarea>
            <div class="flex items-center space-x-2">
              <button @click="sendBatchNotification" class="px-4 py-2 rounded-xl bg-primary text-foreground text-xs font-bold">发送给所有用户</button>
              <button @click="sendBatchNotificationToOnline" class="px-4 py-2 rounded-xl bg-green-500/20 text-green-400 text-xs font-bold">仅在线用户</button>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase">
                <tr>
                  <th class="px-4 py-3">标题</th>
                  <th class="px-4 py-3">内容</th>
                  <th class="px-4 py-3">类型</th>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="notif in notifications" :key="notif.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-4 py-3 text-xs font-bold text-foreground">{{ notif.title }}</td>
                  <td class="px-4 py-3 text-foreground/70 text-xs line-clamp-1">{{ notif.content }}</td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">{{ notif.type }}</span>
                  </td>
                  <td class="px-4 py-3 text-foreground/50 text-[10px]">{{ formatDate(notif.created_at) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-1">
                      <button @click="viewNotificationDetail(notif)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">👁️</button>
                      <button @click="deleteNotification(notif)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">🗑️</button>
                      <button @click="permanentDeleteNotification(notif)" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500">💥</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="currentTab === 'monitoring'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">实时监控中心</h2>
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span class="text-xs text-green-500">Live</span>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4">
            <div class="glass-card p-4">
              <h3 class="text-sm font-bold text-foreground mb-3">在线用户 ({{ onlineUsers.length }})</h3>
              <div class="space-y-2 max-h-[60vh] overflow-y-auto">
                <div v-for="user in onlineUsers" :key="user.id" class="glass p-2 rounded-xl flex items-center space-x-2">
                  <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">
                    {{ user.username?.charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-foreground truncate">{{ user.nickname || user.username }}</div>
                    <div class="text-[10px] text-foreground/40">{{ formatTimeAgo(user.last_active) }}</div>
                  </div>
                  <button v-if="isSuperAdmin" @click="forceLogoutUser(user)" class="p-1 rounded hover:bg-red-500/10 text-red-400 text-xs" title="强制下线">⏏️</button>
                </div>
              </div>
            </div>

            <div class="glass-card p-4">
              <h3 class="text-sm font-bold text-foreground mb-3">实时通话监控</h3>
              <div class="space-y-2 max-h-[60vh] overflow-y-auto">
                <div v-if="activeCalls.length === 0" class="text-center text-foreground/40 text-xs py-8">
                  暂无进行中的通话
                </div>
                <div v-for="call in activeCalls" :key="call.id" class="glass p-3 rounded-xl">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-2">
                      <span class="text-lg">{{ call.type === 'voice' ? '🎤' : '📹' }}</span>
                      <span class="text-xs font-bold text-foreground">{{ call.type === 'voice' ? '语音通话' : '视频通话' }}</span>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">进行中</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                      <div class="flex -space-x-2">
                        <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] border border-background">
                          {{ call.caller?.nickname?.charAt(0) || call.caller?.username?.charAt(0) || '?' }}
                        </div>
                        <div class="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] border border-background">
                          {{ call.callee?.nickname?.charAt(0) || call.callee?.username?.charAt(0) || '?' }}
                        </div>
                      </div>
                      <span class="text-xs text-foreground/60">{{ call.caller?.nickname || call.caller?.username }} → {{ call.callee?.nickname || call.callee?.username }}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                      <button @click="eavesdropCall(call)" class="px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold" title="偷听">
                        👂 偷听
                      </button>
                      <button @click="watchCall(call)" class="px-2 py-1 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary text-[10px] font-bold" title="偷看">
                        👁️ 偷看
                      </button>
                      <button @click="terminateCall(call)" class="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold" title="强制结束">
                        ⏹️ 结束
                      </button>
                    </div>
                  </div>
                  <div class="text-[10px] text-foreground/40 mt-2">
                    持续时间: {{ formatCallDuration(call.started_at) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="currentTab === 'logs'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">系统日志</h2>
            <div class="flex items-center space-x-2">
              <GlassSelect v-model="currentLogType" :options="logTypeOptions" @change="fetchLogs" class="w-28" />
              <button @click="fetchLogs" class="p-2 rounded-xl hover:bg-foreground/5 text-foreground/40">🔄</button>
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-foreground/5 text-foreground/40 font-bold uppercase">
                <tr>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3">用户</th>
                  <th class="px-4 py-3">操作</th>
                  <th class="px-4 py-3">模块</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-foreground/5">
                <tr v-for="log in logs" :key="log.id" class="hover:bg-foreground/[0.02] transition-colors">
                  <td class="px-4 py-3 text-foreground/50 text-[10px]">{{ formatDate(log.created_at) }}</td>
                  <td class="px-4 py-3 text-xs text-foreground">{{ log.username }}</td>
                  <td class="px-4 py-3 text-foreground/70 text-xs">{{ log.action }}</td>
                  <td class="px-4 py-3 text-[10px] text-foreground/60">{{ log.module }}</td>
                  <td class="px-4 py-3">
                    <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', log.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400']">{{ log.status }}</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button @click="viewLogDetail(log)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60">👁️</button>
                    <button @click="deleteLog(log)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="currentTab === 'settings'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-foreground">系统设置</h2>
            <button @click="fetchConfigs" class="p-2 rounded-xl hover:bg-foreground/5 text-foreground/40">🔄</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="config in configs" :key="config.id" class="glass-card p-4 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-foreground">{{ config.config_key }}</span>
                <span class="text-[10px] text-foreground/40">{{ config.category }}</span>
              </div>
              <p class="text-[10px] text-foreground/60">{{ config.description }}</p>
              <div class="flex items-center space-x-2">
                <input v-model="config.config_value" type="text" class="flex-1 bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 text-xs" />
                <button @click="updateConfig(config)" class="px-3 py-2 rounded-lg bg-primary text-foreground text-xs font-bold">保存</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <Transition name="fade">
      <div v-if="showUserModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showUserModal = false">
        <div class="w-full max-w-2xl glass-modal rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
          <div class="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 class="text-base font-bold text-foreground">用户详情</h2>
            <button @click="showUserModal = false" class="w-8 h-8 rounded-full hover:bg-foreground/10 flex items-center justify-center text-foreground/40">✕</button>
          </div>
          <div v-if="selectedUser" class="p-4 space-y-4 overflow-y-auto flex-1">
            <div class="flex items-center space-x-4">
              <div class="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl font-bold">
                {{ selectedUser.username?.charAt(0).toUpperCase() }}
              </div>
              <div>
                <div class="text-xl font-bold text-foreground">{{ selectedUser.nickname || selectedUser.username }}</div>
                <div class="text-sm text-foreground/40">@{{ selectedUser.username }}</div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="glass p-3 rounded-xl">
                <div class="text-[10px] text-foreground/40">邮箱</div>
                <div class="text-sm text-foreground">{{ selectedUser.email || '未绑定' }}</div>
              </div>
              <div class="glass p-3 rounded-xl">
                <div class="text-[10px] text-foreground/40">手机</div>
                <div class="text-sm text-foreground">{{ selectedUser.phone || '未绑定' }}</div>
              </div>
              <div class="glass p-3 rounded-xl">
                <div class="text-[10px] text-foreground/40">积分</div>
                <div class="text-sm text-primary font-bold">{{ selectedUser.points || 0 }}</div>
              </div>
              <div class="glass p-3 rounded-xl">
                <div class="text-[10px] text-foreground/40">状态</div>
                <div class="text-sm" :class="selectedUser.status === 'active' ? 'text-green-400' : 'text-red-400'">{{ selectedUser.status }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showBatchActions" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showBatchActions = false">
        <div class="w-full max-w-md glass-modal rounded-2xl overflow-hidden shadow-2xl">
          <div class="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 class="text-base font-bold text-foreground">批量操作</h2>
            <button @click="showBatchActions = false" class="w-8 h-8 rounded-full hover:bg-foreground/10 flex items-center justify-center text-foreground/40">✕</button>
          </div>
          <div class="p-4 space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <button @click="batchHideAll('users')" class="p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-xs font-bold">隐藏所有用户</button>
              <button @click="batchShowAll('users')" class="p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-xs font-bold">显示所有用户</button>
              <button @click="batchHideAll('posts')" class="p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-xs font-bold">隐藏所有帖子</button>
              <button @click="batchShowAll('posts')" class="p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-xs font-bold">显示所有帖子</button>
              <button v-if="isSuperAdmin" @click="batchDeleteAll('users')" class="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold">删除所有用户</button>
              <button v-if="isSuperAdmin" @click="batchDeleteAll('posts')" class="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold">删除所有帖子</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import GlassSelect from '@/components/GlassSelect.vue';

const router = useRouter();
const authStore = useAuthStore();
const isSuperAdmin = authStore.isSuperAdmin;

const isSidebarCollapsed = ref(false);
const currentTab = ref('stats');
const showInvisible = ref(true);
const showUserModal = ref(false);
const showBatchActions = ref(false);
const selectedUser = ref<any>(null);

const navItems = [
  { id: 'stats', name: '数据概览', icon: '📊' },
  { id: 'users', name: '用户管理', icon: '👥' },
  { id: 'posts', name: '帖子管理', icon: '📝' },
  { id: 'topics', name: '话题管理', icon: '🏷️' },
  { id: 'groups', name: '群聊管理', icon: '💬' },
  { id: 'messages', name: '消息管理', icon: '💌' },
  { id: 'games', name: '游戏房间', icon: '🎮' },
  { id: 'notifications', name: '系统通知', icon: '📢' },
  { id: 'monitoring', name: '实时监控', icon: '📡' },
  { id: 'logs', name: '系统日志', icon: '📋' },
  { id: 'settings', name: '系统设置', icon: '⚙️' },
];

const dashboardStats = reactive<Record<string, number>>({
  total_users: 0,
  active_users: 0,
  today_users: 0,
  total_posts: 0,
  today_posts: 0,
  total_messages: 0,
  today_messages: 0,
  total_matches: 0,
  total_topics: 0,
  total_groups: 0,
  total_rooms: 0,
});

const systemStatus = ref([
  { name: '数据库', online: true },
  { name: 'Redis', online: true },
  { name: 'WebSocket', online: true },
  { name: 'API服务', online: true },
]);

const users = ref<any[]>([]);
const userSearch = ref('');
const userStatusFilter = ref('all');
const userStatusOptions = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '活跃' },
  { value: 'frozen', label: '冻结' },
];
const userPagination = reactive({ page: 1, limit: 20, total: 0, totalPages: 0 });

const posts = ref<any[]>([]);
const postSearch = ref('');

const topics = ref<any[]>([]);
const topicSearch = ref('');

const groups = ref<any[]>([]);
const groupSearch = ref('');

const messages = ref<any[]>([]);
const messageSearch = ref('');

const gameRooms = ref<any[]>([]);
const gameRoomSearch = ref('');

const notifications = ref<any[]>([]);
const batchNotifTitle = ref('');
const batchNotifContent = ref('');

const onlineUsers = ref<any[]>([]);
const activeCalls = ref<any[]>([]);

const logs = ref<any[]>([]);
const currentLogType = ref('operation');
const logTypeOptions = [
  { value: 'operation', label: '操作日志' },
  { value: 'system', label: '系统日志' },
  { value: 'security', label: '安全审计' },
];

const configs = ref<any[]>([]);

onMounted(() => {
  if (!authStore.isAdmin) {
    router.replace('/home');
    return;
  }
  fetchAllData();
  startRealtimeUpdates();
});

function startRealtimeUpdates() {
  setInterval(() => {
    if (currentTab.value === 'monitoring' || currentTab.value === 'stats') {
      fetchOnlineUsers();
      fetchActiveCalls();
    }
  }, 5000);
}

async function fetchAllData() {
  await Promise.all([
    fetchStats(),
    fetchOnlineUsers(),
    fetchActiveCalls(),
    fetchUsers(),
    fetchPosts(),
    fetchTopics(),
    fetchGroups(),
    fetchMessages(),
    fetchGameRooms(),
    fetchNotifications(),
    fetchLogs(),
    fetchConfigs(),
  ]);
}

async function refreshAllStats() {
  await fetchAllData();
}

async function fetchStats() {
  try {
    const res = await api.get('/admin/stats');
    if (res.data?.stats) {
      Object.assign(dashboardStats, res.data.stats);
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
  }
}

function getStatName(key: string) {
  const names: Record<string, string> = {
    total_users: '总用户', active_users: '在线用户', today_users: '今日新增',
    total_posts: '总帖子', today_posts: '今日帖子',
    total_messages: '总消息', today_messages: '今日消息',
    total_matches: '总匹配', total_topics: '总话题',
    total_groups: '总群聊', total_rooms: '总房间',
  };
  return names[key] || key;
}

function getStatIcon(key: string) {
  const icons: Record<string, string> = {
    total_users: '👥', active_users: '🟢', today_users: '🆕',
    total_posts: '📝', today_posts: '✨',
    total_messages: '💬', today_messages: '📨',
    total_matches: '🤝', total_topics: '🏷️',
    total_groups: '💬', total_rooms: '🎮',
  };
  return icons[key] || '📊';
}

function formatNumber(num: number) {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num;
}

function navigateToRelatedTab(key: string) {
  const map: Record<string, string> = {
    total_users: 'users', active_users: 'monitoring', today_users: 'users',
    total_posts: 'posts', today_posts: 'posts',
    total_messages: 'messages', today_messages: 'messages',
    total_matches: 'stats', total_topics: 'topics',
    total_groups: 'groups', total_rooms: 'games',
  };
  if (map[key]) currentTab.value = map[key];
}

async function fetchUsers() {
  try {
    const res = await api.get('/admin/users', {
      params: {
        page: userPagination.page,
        limit: userPagination.limit,
        search: userSearch.value,
        status: userStatusFilter.value,
        show_invisible: showInvisible.value,
      },
    });
    users.value = res.data.users || [];
    Object.assign(userPagination, res.data.pagination);
  } catch (error) {
    console.error('获取用户列表失败:', error);
  }
}

function changeUserPage(page: number) {
  userPagination.page = page;
  fetchUsers();
}

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400',
    frozen: 'bg-red-500/10 text-red-400',
    banned: 'bg-gray-500/10 text-gray-400',
  };
  return classes[status] || 'bg-foreground/10 text-foreground/60';
}

async function viewUserDetail(user: any) {
  try {
    const res = await api.get(`/admin/users/${user.id}`);
    selectedUser.value = { ...user, ...res.data.stats };
    showUserModal.value = true;
  } catch (error) {
    console.error('获取用户详情失败:', error);
  }
}

async function editUser(user: any) {
  const newStatus = prompt('修改用户状态:', user.status);
  if (!newStatus) return;
  try {
    await api.put(`/admin/users/${user.id}/status`, { status: newStatus });
    fetchUsers();
  } catch (error) {
    alert('操作失败');
  }
}

async function toggleUserVisibility(user: any) {
  try {
    await api.put(`/admin/users/${user.id}/visibility`, { is_visible: !user.is_visible });
    user.is_visible = !user.is_visible;
  } catch (error) {
    alert('操作失败');
  }
}

async function deleteUser(user: any) {
  if (!confirm(`确定要隐藏用户 @${user.username} 吗？`)) return;
  try {
    await api.delete(`/admin/users/${user.id}`);
    fetchUsers();
  } catch (error) {
    alert('操作失败');
  }
}

async function permanentDeleteUser(user: any) {
  if (!confirm(`确定要彻底删除用户 @${user.username} 吗？此操作不可恢复！`)) return;
  try {
    await api.delete(`/admin/users/${user.id}?permanent=true`);
    fetchUsers();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchPosts() {
  try {
    const res = await api.get('/admin/posts', {
      params: { search: postSearch.value, show_invisible: showInvisible.value },
    });
    posts.value = res.data.posts || [];
  } catch (error) {
    console.error('获取帖子列表失败:', error);
  }
}

async function viewPostDetail(post: any) {
  alert(`帖子详情: ${post.content?.substring(0, 100)}...`);
}

async function editPost(post: any) {
  const newContent = prompt('编辑帖子内容:', post.content);
  if (newContent === null) return;
  try {
    await api.put(`/admin/posts/${post.id}`, { content: newContent });
    fetchPosts();
  } catch (error) {
    alert('操作失败');
  }
}

async function togglePostVisibility(post: any) {
  try {
    await api.put(`/admin/posts/${post.id}/visibility`, { is_visible: !post.is_visible });
    post.is_visible = !post.is_visible;
  } catch (error) {
    alert('操作失败');
  }
}

async function deletePost(post: any) {
  if (!confirm('确定要隐藏该帖子吗？')) return;
  try {
    await api.delete(`/admin/posts/${post.id}`);
    fetchPosts();
  } catch (error) {
    alert('操作失败');
  }
}

async function permanentDeletePost(post: any) {
  if (!confirm('确定要彻底删除该帖子吗？此操作不可恢复！')) return;
  try {
    await api.delete(`/admin/posts/${post.id}?permanent=true`);
    fetchPosts();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchTopics() {
  try {
    const res = await api.get('/admin/topics', {
      params: { search: topicSearch.value, show_invisible: showInvisible.value },
    });
    topics.value = res.data.topics || [];
  } catch (error) {
    console.error('获取话题列表失败:', error);
  }
}

async function viewTopicDetail(topic: any) {
  alert(`话题: #${topic.title || topic.name}\n描述: ${topic.description || '无'}`);
}

async function editTopic(topic: any) {
  const newDesc = prompt('编辑话题描述:', topic.description);
  if (newDesc === null) return;
  try {
    await api.put(`/admin/topics/${topic.id}`, { description: newDesc });
    fetchTopics();
  } catch (error) {
    alert('操作失败');
  }
}

async function toggleTopicVisibility(topic: any) {
  try {
    await api.put(`/admin/topics/${topic.id}/visibility`, { is_visible: !topic.is_visible });
    topic.is_visible = !topic.is_visible;
  } catch (error) {
    alert('操作失败');
  }
}

async function deleteTopic(topic: any) {
  if (!confirm('确定要隐藏该话题吗？')) return;
  try {
    await api.delete(`/admin/topics/${topic.id}`);
    fetchTopics();
  } catch (error) {
    alert('操作失败');
  }
}

async function permanentDeleteTopic(topic: any) {
  if (!confirm('确定要彻底删除该话题吗？此操作不可恢复！')) return;
  try {
    await api.delete(`/admin/topics/${topic.id}?permanent=true`);
    fetchTopics();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchGroups() {
  try {
    const res = await api.get('/admin/groups', {
      params: { search: groupSearch.value, show_invisible: showInvisible.value },
    });
    groups.value = res.data.groups || [];
  } catch (error) {
    console.error('获取群聊列表失败:', error);
  }
}

async function viewGroupDetail(group: any) {
  alert(`群聊: ${group.name}\n创建者: ${group.creator_username || group.creator_nickname}`);
}

async function editGroup(group: any) {
  const newName = prompt('编辑群聊名称:', group.name);
  if (!newName) return;
  try {
    await api.put(`/admin/groups/${group.id}`, { name: newName });
    fetchGroups();
  } catch (error) {
    alert('操作失败');
  }
}

async function toggleGroupVisibility(group: any) {
  try {
    await api.put(`/admin/groups/${group.id}/visibility`, { is_visible: !group.is_visible });
    group.is_visible = !group.is_visible;
  } catch (error) {
    alert('操作失败');
  }
}

async function deleteGroup(group: any) {
  if (!confirm('确定要隐藏该群聊吗？')) return;
  try {
    await api.delete(`/admin/groups/${group.id}`);
    fetchGroups();
  } catch (error) {
    alert('操作失败');
  }
}

async function permanentDeleteGroup(group: any) {
  if (!confirm('确定要彻底删除该群聊吗？此操作不可恢复！')) return;
  try {
    await api.delete(`/admin/groups/${group.id}?permanent=true`);
    fetchGroups();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchMessages() {
  try {
    const res = await api.get('/admin/messages', {
      params: { search: messageSearch.value, show_invisible: showInvisible.value },
    });
    messages.value = res.data.messages || [];
  } catch (error) {
    console.error('获取消息列表失败:', error);
  }
}

async function viewMessageDetail(msg: any) {
  alert(`发送者: ${msg.sender_username}\n接收者: ${msg.receiver_username || '群聊'}\n内容: ${msg.content}`);
}

async function toggleMessageVisibility(msg: any) {
  try {
    await api.put(`/admin/messages/${msg.id}/visibility`, { is_visible: !msg.is_visible });
    msg.is_visible = !msg.is_visible;
  } catch (error) {
    alert('操作失败');
  }
}

async function deleteMessage(msg: any) {
  if (!confirm('确定要隐藏该消息吗？')) return;
  try {
    await api.delete(`/admin/messages/${msg.id}`);
    fetchMessages();
  } catch (error) {
    alert('操作失败');
  }
}

async function permanentDeleteMessage(msg: any) {
  if (!confirm('确定要彻底删除该消息吗？此操作不可恢复！')) return;
  try {
    await api.delete(`/admin/messages/${msg.id}?permanent=true`);
    fetchMessages();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchGameRooms() {
  try {
    const res = await api.get('/admin/games/rooms', {
      params: { search: gameRoomSearch.value, show_invisible: showInvisible.value },
    });
    gameRooms.value = res.data.rooms || [];
  } catch (error) {
    console.error('获取游戏房间列表失败:', error);
  }
}

async function viewGameRoomDetail(room: any) {
  alert(`房间: ${room.name}\n类型: ${room.type}\n状态: ${room.status}`);
}

async function editGameRoom(room: any) {
  const newName = prompt('编辑房间名称:', room.name);
  if (!newName) return;
  try {
    await api.put(`/admin/games/rooms/${room.id}`, { name: newName });
    fetchGameRooms();
  } catch (error) {
    alert('操作失败');
  }
}

async function toggleGameRoomVisibility(room: any) {
  try {
    await api.put(`/admin/games/rooms/${room.id}/visibility`, { is_visible: !room.is_visible });
    room.is_visible = !room.is_visible;
  } catch (error) {
    alert('操作失败');
  }
}

async function deleteGameRoom(room: any) {
  if (!confirm('确定要隐藏该房间吗？')) return;
  try {
    await api.delete(`/admin/games/rooms/${room.id}`);
    fetchGameRooms();
  } catch (error) {
    alert('操作失败');
  }
}

async function permanentDeleteGameRoom(room: any) {
  if (!confirm('确定要彻底删除该房间吗？此操作不可恢复！')) return;
  try {
    await api.delete(`/admin/games/rooms/${room.id}?permanent=true`);
    fetchGameRooms();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchNotifications() {
  try {
    const res = await api.get('/admin/notifications');
    notifications.value = res.data.notifications || [];
  } catch (error) {
    console.error('获取通知列表失败:', error);
  }
}

async function sendBatchNotification() {
  if (!batchNotifTitle.value || !batchNotifContent.value) {
    alert('标题和内容不能为空');
    return;
  }
  if (!confirm('确定要发送给所有用户吗？')) return;
  try {
    const res = await api.get('/admin/users', { params: { limit: 10000 } });
    const userIds = res.data.users?.map((u: any) => u.id) || [];
    await api.post('/admin/notifications/system/batch', {
      userIds,
      title: batchNotifTitle.value,
      content: batchNotifContent.value,
    });
    alert('发送成功');
    batchNotifTitle.value = '';
    batchNotifContent.value = '';
    fetchNotifications();
  } catch (error) {
    alert('发送失败');
  }
}

async function sendBatchNotificationToOnline() {
  if (!batchNotifTitle.value || !batchNotifContent.value) {
    alert('标题和内容不能为空');
    return;
  }
  if (!confirm('确定要发送给在线用户吗？')) return;
  try {
    await api.post('/admin/notifications/online/batch', {
      title: batchNotifTitle.value,
      content: batchNotifContent.value,
    });
    alert('发送成功');
    batchNotifTitle.value = '';
    batchNotifContent.value = '';
  } catch (error) {
    alert('发送失败');
  }
}

async function viewNotificationDetail(notif: any) {
  alert(`标题: ${notif.title}\n内容: ${notif.content}\n类型: ${notif.type}`);
}

async function deleteNotification(notif: any) {
  if (!confirm('确定要删除该通知吗？')) return;
  try {
    await api.delete(`/admin/notifications/${notif.id}`);
    fetchNotifications();
  } catch (error) {
    alert('操作失败');
  }
}

async function permanentDeleteNotification(notif: any) {
  if (!confirm('确定要彻底删除该通知吗？此操作不可恢复！')) return;
  try {
    await api.delete(`/admin/notifications/${notif.id}?permanent=true`);
    fetchNotifications();
  } catch (error) {
    alert('操作失败');
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

async function forceLogoutUser(user: any) {
  if (!confirm(`确定要强制下线用户 @${user.username} 吗？`)) return;
  try {
    await api.post(`/admin/users/${user.id}/force-logout`);
    alert('操作成功');
    fetchOnlineUsers();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchActiveCalls() {
  try {
    const res = await api.get('/admin/monitoring/active-calls');
    activeCalls.value = res.data.calls || [];
  } catch (error) {
    console.error('获取活跃通话失败:', error);
  }
}

function formatCallDuration(startedAt: string) {
  if (!startedAt) return '00:00';
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diff = Math.floor((now - start) / 1000);
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function eavesdropCall(call: any) {
  if (!confirm(`确定要偷听 ${call.caller?.nickname || call.caller?.username} 和 ${call.callee?.nickname || call.callee?.username} 的通话吗？`)) return;
  try {
    const res = await api.post(`/admin/calls/${call.id}/eavesdrop`);
    if (res.data?.token) {
      alert('已加入通话监听，请查看新窗口');
      window.open(`/call/monitor?token=${res.data.token}`, '_blank');
    }
  } catch (error) {
    alert('操作失败: ' + (error as any).response?.data?.message || '未知错误');
  }
}

async function watchCall(call: any) {
  if (!confirm(`确定要偷看 ${call.caller?.nickname || call.caller?.username} 和 ${call.callee?.nickname || call.callee?.username} 的通话吗？`)) return;
  try {
    const res = await api.post(`/admin/calls/${call.id}/watch`);
    if (res.data?.token) {
      alert('已加入视频监看，请查看新窗口');
      window.open(`/call/monitor?token=${res.data.token}&video=true`, '_blank');
    }
  } catch (error) {
    alert('操作失败: ' + (error as any).response?.data?.message || '未知错误');
  }
}

async function terminateCall(call: any) {
  if (!confirm(`确定要强制结束 ${call.caller?.nickname || call.caller?.username} 和 ${call.callee?.nickname || call.callee?.username} 的通话吗？`)) return;
  try {
    await api.post(`/admin/calls/${call.id}/terminate`);
    alert('通话已强制结束');
    fetchActiveCalls();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchLogs() {
  try {
    const res = await api.get(`/admin/logs/${currentLogType.value}`);
    logs.value = res.data.logs || res.data || [];
  } catch (error) {
    console.error('获取日志失败:', error);
  }
}

async function viewLogDetail(log: any) {
  alert(`操作: ${log.action}\n模块: ${log.module}\n描述: ${log.description}\nIP: ${log.ip_address}`);
}

async function deleteLog(log: any) {
  if (!confirm('确定要删除该日志吗？')) return;
  try {
    await api.delete(`/admin/logs/${currentLogType.value}/${log.id}`);
    fetchLogs();
  } catch (error) {
    alert('操作失败');
  }
}

async function fetchConfigs() {
  try {
    const res = await api.get('/admin/configs', { params: { show_invisible: true } });
    configs.value = res.data.configs || [];
  } catch (error) {
    console.error('获取配置失败:', error);
  }
}

async function updateConfig(config: any) {
  try {
    await api.put(`/admin/configs/${config.config_key}`, { config_value: config.config_value });
    alert('保存成功');
  } catch (error) {
    alert('保存失败');
  }
}

async function batchHideAll(type: string) {
  if (!confirm(`确定要隐藏所有${type === 'users' ? '用户' : '帖子'}吗？`)) return;
  try {
    await api.post(`/admin/batch/${type}/hide-all`);
    alert('操作成功');
    if (type === 'users') fetchUsers();
    else fetchPosts();
  } catch (error) {
    alert('操作失败');
  }
}

async function batchShowAll(type: string) {
  if (!confirm(`确定要显示所有${type === 'users' ? '用户' : '帖子'}吗？`)) return;
  try {
    await api.post(`/admin/batch/${type}/show-all`);
    alert('操作成功');
    if (type === 'users') fetchUsers();
    else fetchPosts();
  } catch (error) {
    alert('操作失败');
  }
}

async function batchDeleteAll(type: string) {
  if (!confirm(`确定要删除所有${type === 'users' ? '用户' : '帖子'}吗？此操作不可恢复！`)) return;
  try {
    await api.post(`/admin/batch/${type}/delete-all`);
    alert('操作成功');
    if (type === 'users') fetchUsers();
    else fetchPosts();
  } catch (error) {
    alert('操作失败');
  }
}

watch(currentTab, (tab) => {
  const fetchers: Record<string, () => void> = {
    users: fetchUsers, posts: fetchPosts, topics: fetchTopics,
    groups: fetchGroups, messages: fetchMessages, games: fetchGameRooms,
    notifications: fetchNotifications, monitoring: fetchOnlineUsers,
    logs: fetchLogs, settings: fetchConfigs, stats: fetchStats,
  };
  if (fetchers[tab]) fetchers[tab]();
});

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(dateStr: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

function goBack() {
  router.push('/home');
}
</script>

<style scoped>
.glass-card {
  background-color: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
}
.glass-modal {
  background-color: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
