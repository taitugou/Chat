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
        <div class="text-sm font-bold text-foreground/80">管理后台</div>
        <div class="text-[10px] font-black text-primary/60 uppercase tracking-widest">Admin Panel</div>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-xs text-foreground/40">管理员模式</span>
        <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
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
        
        <div class="mt-auto p-3 border-t border-foreground/5">
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
            <h2 class="text-lg font-bold text-foreground">数据概览</h2>
            <button @click="refreshStats" class="p-2 rounded-xl hover:bg-foreground/5 text-foreground/40 transition-all text-sm">
              🔄 刷新
            </button>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="(val, key) in stats" :key="key" class="glass-card p-4 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xl">{{ getStatIcon(key) }}</span>
                <span class="text-[10px] font-bold text-foreground/30 uppercase">{{ getStatName(key) }}</span>
              </div>
              <div class="text-2xl font-black text-foreground">{{ formatNumber(val) }}</div>
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
                      <button @click="editUserStatus(user)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60" title="修改状态">✏️</button>
                      <button @click="resetUserPassword(user)" class="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/60" title="重置密码">🔑</button>
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
                      <button @click="togglePostVisibility(post)" class="p-1.5 rounded-lg hover:bg-foreground/5" :class="post.is_visible ? 'text-foreground/60' : 'text-primary'">{{ post.is_visible ? '🙈' : '👁️' }}</button>
                      <button @click="deletePost(post)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">🗑️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
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

const isSidebarCollapsed = ref(false);
const currentTab = ref('stats');
const showInvisible = ref(true);
const showUserModal = ref(false);
const selectedUser = ref<any>(null);

const navItems = [
  { id: 'stats', name: '数据概览', icon: '📊' },
  { id: 'users', name: '用户管理', icon: '👥' },
  { id: 'posts', name: '帖子管理', icon: '📝' },
];

const stats = reactive<Record<string, number>>({
  total_users: 0,
  active_users: 0,
  today_users: 0,
  total_posts: 0,
  today_posts: 0,
  total_messages: 0,
  total_likes: 0,
  total_comments: 0,
});

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

onMounted(() => {
  if (!authStore.isAdmin) {
    router.replace('/home');
    return;
  }
  fetchAllData();
});

async function fetchAllData() {
  await Promise.all([
    fetchStats(),
    fetchUsers(),
    fetchPosts(),
  ]);
}

async function refreshStats() {
  await fetchStats();
}

async function fetchStats() {
  try {
    const res = await api.get('/admin/stats');
    if (res.data?.stats) {
      Object.assign(stats, res.data.stats);
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
  }
}

function getStatName(key: string) {
  const names: Record<string, string> = {
    total_users: '总用户', active_users: '活跃用户', today_users: '今日新增',
    total_posts: '总帖子', today_posts: '今日帖子',
    total_messages: '总消息', total_likes: '总点赞', total_comments: '总评论',
  };
  return names[key] || key;
}

function getStatIcon(key: string) {
  const icons: Record<string, string> = {
    total_users: '👥', active_users: '🟢', today_users: '🆕',
    total_posts: '📝', today_posts: '✨',
    total_messages: '💬', total_likes: '❤️', total_comments: '💭',
  };
  return icons[key] || '📊';
}

function formatNumber(num: number) {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num;
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

async function editUserStatus(user: any) {
  const newStatus = prompt('修改用户状态:', user.status);
  if (!newStatus) return;
  try {
    await api.put(`/admin/users/${user.id}/status`, { status: newStatus });
    fetchUsers();
  } catch (error) {
    alert('操作失败');
  }
}

async function resetUserPassword(user: any) {
  if (!confirm(`确定要重置用户 @${user.username} 的密码吗？`)) return;
  try {
    await api.put(`/admin/users/${user.id}/reset-password`);
    alert('密码已重置为 123456');
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

watch(currentTab, (tab) => {
  const fetchers: Record<string, () => void> = {
    users: fetchUsers, posts: fetchPosts, stats: fetchStats,
  };
  if (fetchers[tab]) fetchers[tab]();
});

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
