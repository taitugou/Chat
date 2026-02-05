<template>
  <div class="min-h-screen relative profile-page-text">
    <LiquidGlass
      :background-image="user?.background_image ? getImageUrl(user.background_image, 'none') : ''"
      :image-blur="false"
      :overlay-blur="false"
      :show-blobs="false"
    />
    <div class="min-h-screen pb-20 bg-transparent">
      <div class="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div class="flex items-center mb-4 px-2 !bg-transparent !border-none !shadow-none !backdrop-blur-none">
          <h1 class="text-2xl font-bold glass-text">个人资料</h1>
        </div>

        <!-- 游客升级提示 -->
        <div v-if="authStore.user?.isGuest && !isOtherUser" class="glass-card mb-6 p-4 border-l-4 border-yellow-500 bg-yellow-500/10">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <span class="text-2xl mr-3">⚠️</span>
              <div>
                <p class="text-sm font-bold text-white">您当前以游客身份登录</p>
                <p class="text-xs text-foreground/60">为了防止账号丢失，请及时完善注册信息。</p>
              </div>
            </div>
            <router-link to="/upgrade-guest" class="glass-btn-primary px-4 py-2 text-xs font-bold whitespace-nowrap">
              立即完善
            </router-link>
          </div>
        </div>

        <div class="glass-card mb-6 relative overflow-hidden pt-8">
          <div class="text-center relative z-10">
            <div class="relative inline-block">
              <img
                :src="getImageUrl(user?.avatar)"
                :alt="user?.nickname"
                class="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-4 border-4 border-white/20 shadow-lg bg-foreground/10"
              />
              <div 
                class="absolute bottom-4 right-1/2 transform translate-x-1/2 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-black"
                :class="{
                  'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]': user?.online_status === 'online',
                  'bg-gray-400': !user?.online_status || user?.online_status === 'offline'
                }"
                :title="user?.online_status === 'online' ? '在线' : '离线'"
              ></div>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold glass-text">
              {{ user?.nickname }}
            </h2>
            <p class="text-foreground/80 mt-2 text-sm sm:text-base px-4" v-html="user?.bio ? formatPostContent(user.bio) : '这个人很懒，什么都没有留下'"></p>
            <p class="text-xs sm:text-sm text-foreground/50 mt-1 mb-8">
              注册时间 {{ formatDate(user?.created_at) }}
            </p>
          </div>
        </div>

        <div class="glass-card mb-6 p-2">
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4 py-4">
            <div 
              v-if="showPosts"
              class="text-center cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-foreground/10 hover:scale-105"
              @click="viewPosts"
            >
              <div class="text-lg sm:text-xl font-bold text-white">{{ stats?.post_count || 0 }}</div>
              <div class="text-xs sm:text-sm text-foreground/60">帖子</div>
            </div>
            <div 
              v-else
              class="text-center rounded-xl p-2 opacity-50 bg-foreground/5"
            >
              <div class="text-lg sm:text-xl font-bold text-foreground/40">-</div>
              <div class="text-xs sm:text-sm text-foreground/40">帖子</div>
            </div>
            <div 
              v-if="showLikes"
              class="text-center cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-foreground/10 hover:scale-105"
              @click="viewLikes"
            >
              <div class="text-lg sm:text-xl font-bold text-white">{{ stats?.like_count || 0 }}</div>
              <div class="text-xs sm:text-sm text-foreground/60">获赞</div>
            </div>
            <div 
              v-else
              class="text-center rounded-xl p-2 opacity-50 bg-foreground/5"
            >
              <div class="text-lg sm:text-xl font-bold text-foreground/40">-</div>
              <div class="text-xs sm:text-sm text-foreground/40">获赞</div>
            </div>
            <div 
              v-if="showFollowing"
              class="text-center cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-foreground/10 hover:scale-105"
              @click="viewFollowing"
            >
              <div class="text-lg sm:text-xl font-bold text-white">{{ stats?.following_count || 0 }}</div>
              <div class="text-xs sm:text-sm text-foreground/60">关注</div>
            </div>
            <div 
              v-else
              class="text-center rounded-xl p-2 opacity-50 bg-foreground/5"
            >
              <div class="text-lg sm:text-xl font-bold text-foreground/40">-</div>
              <div class="text-xs sm:text-sm text-foreground/40">关注</div>
            </div>
            <div 
              v-if="showFollowers"
              class="text-center cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-foreground/10 hover:scale-105"
              @click="viewFollowers"
            >
              <div class="text-lg sm:text-xl font-bold text-white">{{ stats?.follower_count || 0 }}</div>
              <div class="text-xs sm:text-sm text-foreground/60">粉丝</div>
            </div>
            <div 
              v-else
              class="text-center rounded-xl p-2 opacity-50 bg-foreground/5"
            >
              <div class="text-lg sm:text-xl font-bold text-foreground/40">-</div>
              <div class="text-xs sm:text-sm text-foreground/40">粉丝</div>
            </div>
            <div class="text-center cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-foreground/10 hover:scale-105">
              <div class="text-lg sm:text-xl font-bold text-white">{{ userPoints || 0 }}</div>
              <div class="text-xs sm:text-sm text-foreground/60">积分</div>
            </div>
            <div class="text-center cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-foreground/10 hover:scale-105">
              <div class="text-lg sm:text-xl font-bold text-white">{{ formatNumber(userChips) }}</div>
              <div class="text-xs sm:text-sm text-foreground/60">筹码</div>
            </div>
          </div>
        </div>

        <div v-if="user" class="glass-card mb-6 overflow-visible">
          <ProfileMessageBoard :profile-user-id="user.id" />
        </div>

        <div class="glass-card mb-6 p-4">
          <div class="flex items-center justify-between mb-4 pb-2 border-b border-foreground/10">
            <h3 class="text-lg font-semibold glass-text">详细资料</h3>
            <router-link
              v-if="!route.params.username || route.params.username === authStore.user?.username"
              to="/profile/edit"
              class="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              编辑
            </router-link>
          </div>
          <div class="space-y-4">
            <div class="flex justify-between items-center text-foreground/90">
              <span class="font-medium">账号</span>
              <span class="font-medium">{{ user?.username }}</span>
            </div>
            <div class="flex justify-between items-center text-foreground/90">
              <span class="font-medium">性别</span>
              <span class="font-medium">{{ user?.gender === 'male' ? '男' : user?.gender === 'female' ? '女' : '保密' }}</span>
            </div>
            <div v-if="showLocation" class="flex justify-between items-center text-foreground/90">
              <span class="font-medium">地区</span>
              <span class="font-medium">{{ user?.location || '未设置' }}</span>
            </div>
            <div v-if="user?.interest_tags && user.interest_tags.length > 0">
              <span class="font-medium block mb-2">兴趣标签</span>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in user.interest_tags"
                  :key="tag"
                  class="glass-badge"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            <div class="flex justify-between items-center text-foreground/90">
              <span class="font-medium">最近活跃</span>
              <span class="font-medium text-sm">{{ formatDate(onlineInfo?.last_active_time || user?.last_login_at) }}</span>
            </div>
          </div>
        </div>

        <div v-if="isOtherUser" class="glass-card mb-6 p-4 space-y-3">
          <button
            @click="toggleFollow"
            class="glass-btn w-full py-3 font-medium"
            :class="isFollowing ? 'text-foreground/60' : 'text-primary border-primary/30'"
            :disabled="isLoading"
          >
            {{ isLoading ? '处理中...' : (isFollowing ? '取消关注' : '关注') }}
          </button>
          <button
            @click="addFriend"
            class="glass-btn-primary w-full py-3 font-bold"
            :disabled="addingFriend"
          >
            {{ addingFriend ? '添加中...' : '添加好友' }}
          </button>
          <button
            @click="addToBlacklist"
            class="glass-btn w-full py-3 text-red-400 border-red-400/30 hover:bg-red-500/10"
          >
            加入黑名单
          </button>
        </div>

        <div v-if="!isOtherUser" class="glass-card p-4 space-y-3">
          <!-- 管理员入口 - 移出网格，单独占据一行以增加可见性 -->
          <router-link v-if="isSuperAdmin" to="/superadmin" class="glass-btn w-full py-3 text-center block bg-primary/20 border-primary/30 text-primary font-bold">
            超级管理后台
          </router-link>
          <router-link v-else-if="isAdmin" to="/admin" class="glass-btn w-full py-3 text-center block bg-primary/20 border-primary/30 text-primary font-bold">
            管理后台
          </router-link>

          <div class="grid grid-cols-2 gap-3">
            <router-link to="/settings" class="glass-btn py-3 text-center block">
              设置
            </router-link>
            <router-link to="/blacklist" class="glass-btn py-3 text-center block">
              黑名单
            </router-link>
            <router-link to="/points" class="glass-btn py-3 text-center block">
              积分中心
            </router-link>
            <router-link to="/support" class="glass-btn py-3 text-center block">
              赞助合作
            </router-link>
          </div>
          <button @click="handleLogout" class="glass-btn w-full py-3 text-red-400 border-red-400/30 hover:bg-red-500/10">
            退出登录
          </button>
        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getSocket } from '@/utils/socket';
import api from '@/utils/api';
import BottomNav from '@/components/BottomNav.vue';
import { formatPostContent } from '@/utils/contentRenderer';
import { getImageUrl } from '@/utils/imageUrl';
import ProfileMessageBoard from '@/components/ProfileMessageBoard.vue';
import LiquidGlass from '@/components/LiquidGlass.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const user = ref<any>(null);
const stats = ref<any>({});
const onlineInfo = ref<any>({});
const addingFriend = ref(false);
const isFollowing = ref(false);
const isLoading = ref(false);
const userPoints = ref(0);
const userChips = ref(0);

function formatNumber(num: number | string): string {
  if (typeof num === 'string') num = parseFloat(num) || 0;
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿';
  } else if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toString();
}

const isOtherUser = computed(() => {
  // 如果还在加载中，且没有路径参数，则默认为当前用户
  if (authStore.isInitialLoading && !route.params.username) return false;
  // 如果有路径参数且与当前登录用户不一致，则视为他人主页
  return route.params.username && route.params.username !== authStore.user?.username;
});

const isSuperAdmin = computed(() => {
  const targetUser = user.value || authStore.user;
  if (!targetUser || !targetUser.roles) return false;
  return targetUser.id === 1 || targetUser.roles.some((role: any) => role.name === 'super_admin');
});

const isAdmin = computed(() => {
  const targetUser = user.value || authStore.user;
  if (!targetUser || !targetUser.roles) return false;
  return targetUser.id === 1 || targetUser.roles.some((role: any) => role.name === 'admin' || role.name === 'super_admin');
});

const showLocation = computed(() => {
  if (!isOtherUser.value) {
    return true;
  }
  
  const locationVisibility = user.value?.privacy?.locationVisibility || 'public';
  
  if (locationVisibility === 'public') {
    return true;
  }
  
  return false;
});

const showPosts = computed(() => {
  if (!isOtherUser.value) return true;
  const visibility = user.value?.posts_visibility || 'public';
  return visibility === 'public';
});

const showLikes = computed(() => {
  if (!isOtherUser.value) return true;
  const visibility = user.value?.likes_visibility || 'public';
  return visibility === 'public';
});

const showFollowing = computed(() => {
  if (!isOtherUser.value) return true;
  const visibility = user.value?.following_visibility || 'public';
  return visibility === 'public';
});

const showFollowers = computed(() => {
  if (!isOtherUser.value) return true;
  const visibility = user.value?.followers_visibility || 'public';
  return visibility === 'public';
});

onMounted(async () => {
  await fetchUserInfo();
  if (isOtherUser.value) {
    await checkFollowStatus();
  }
  
  const socket = getSocket();
  if (socket) {
    socket.on('user:status_change', (data: { userId: number, status: string }) => {
      if (user.value && user.value.id === data.userId) {
        user.value.online_status = data.status;
      }
    });
  }
});

async function fetchUserInfo() {
  try {
    const username = route.params.username || authStore.user?.username;
    console.log('fetchUserInfo - route.params.username:', route.params.username);
    console.log('fetchUserInfo - authStore.user?.username:', authStore.user?.username);
    console.log('fetchUserInfo - 最终使用的username:', username);
    
    let response;

    if (route.params.username) {
      response = await api.get(`/user/${route.params.username}`);
    } else {
      response = await api.get('/auth/me');
    }

    console.log('fetchUserInfo - 响应数据:', response.data);

    user.value = response.data.user;
    stats.value = response.data.stats || {};
    onlineInfo.value = response.data.onlineInfo || {};

    if (!isOtherUser.value) {
      await fetchPointsAndChips();
    }
  } catch (error: any) {
    console.error('获取用户信息失败:', error);
    if (error.response?.status === 404) {
      console.error('用户不存在');
    } else if (error.response?.status === 401) {
      console.error('未授权，请重新登录');
    } else if (error.response?.status === 403) {
      console.error('无权访问该用户信息');
    } else {
      console.error('服务器错误', error.response?.data?.error || error.message);
    }
  }
}

async function checkFollowStatus() {
  if (!user.value) return;
  
  try {
    const response = await api.get(`/user/follows/check/${user.value.id}`);
    isFollowing.value = response.data.is_following;
  } catch (error) {
    console.error('检查关注状态失败', error);
  }
}

async function toggleFollow() {
  if (!user.value || isLoading.value) return;
  
  try {
    isLoading.value = true;
    if (isFollowing.value) {
      await api.delete(`/user/follow/${user.value.id}`);
      isFollowing.value = false;
      if (stats.value.follower_count > 0) {
        stats.value.follower_count--;
      }
    } else {
      await api.post(`/user/follow/${user.value.id}`);
      isFollowing.value = true;
      stats.value.follower_count = (stats.value.follower_count || 0) + 1;
    }
  } catch (error) {
    console.error('关注操作失败:', error);
  } finally {
    isLoading.value = false;
  }
}

async function fetchPointsAndChips() {
  try {
    const pointsResponse = await api.get('/points');
    userPoints.value = pointsResponse.data.points || 0;
  } catch (error) {
    console.error('获取积分失败:', error);
    userPoints.value = 0;
  }

  try {
    const chipsResponse = await api.get('/chips');
    userChips.value = chipsResponse.data.chips?.balance || 0;
  } catch (error) {
    console.error('获取筹码失败:', error);
    userChips.value = 0;
  }
}

async function addFriend() {
  if (!user.value) return;
  
  try {
    addingFriend.value = true;
    const response = await api.post(`/user/friend-requests/${user.value.id}`);
    if (response.data.action === 'accepted') {
      alert(response.data.message || '已自动互加好友');
    } else {
      alert('好友申请已发送');
    }
  } catch (error: any) {
    console.error('添加好友失败:', error);
    if (error.response?.data?.error) {
      alert(error.response.data.error);
    } else {
      alert('添加好友失败，请稍后重试');
    }
  } finally {
    addingFriend.value = false;
  }
}

async function addToBlacklist() {
  if (!user.value) return;
  
  try {
    await api.post(`/user/block/${user.value.id}`);
    alert('已加入黑名单');
    router.back();
  } catch (error) {
    console.error('加入黑名单失败', error);
  }
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function formatDate(dateString: string | undefined) {
  if (!dateString) return '未知';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '未知';
  return date.toLocaleString();
}

function viewPosts() {
  const username = route.params.username || authStore.user?.username;
  router.push(`/posts?username=${username}`);
}

function viewLikes() {
  const username = route.params.username || authStore.user?.username;
  router.push(`/likes?username=${username}`);
}

function viewFollowing() {
  const username = route.params.username || authStore.user?.username;
  router.push(`/following?username=${username}`);
}

function viewFollowers() {
  const username = route.params.username || authStore.user?.username;
  router.push(`/followers?username=${username}`);
}
</script>

<style scoped>
/* 仅在 Profile 页面应用 Windows 桌面风格的文字阴影 */
.profile-page-text {
  /* 模拟 Windows 桌面图标文字样式：黑色阴影描边 */
  text-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.8), 0 0 0.125rem rgba(0, 0, 0, 0.8);
}

/* 确保子组件和内部元素继承该样式，或者针对特定元素强化 */
:deep(*) {
  text-shadow: inherit;
}
</style>
