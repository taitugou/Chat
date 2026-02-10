import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => {
        const authStore = useAuthStore();
        if (!authStore.isAuthenticated) {
          return '/login';
        }
        const landingPage = authStore.defaultLandingPage;
        if (landingPage === 'match') {
          return '/match';
        } else if (landingPage === 'posts') {
          return '/posts';
        }
        return '/home';
      },
    },
    {
      path: '/home',
      name: 'Home',
      component: () => import('@/views/Home.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/Register.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/forgot',
      name: 'ForgotPassword',
      component: () => import('@/views/ForgotPassword.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/posts',
      name: 'Posts',
      component: () => import('@/views/Posts.vue'),
      meta: { requiresAuth: true },
    },

    {
      path: '/chat',
      name: 'Chat',
      component: () => import('@/views/Friends.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/chat/:userId',
      name: 'ChatDetail',
      component: () => import('@/views/ChatDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/group-list',
      name: 'GroupList',
      redirect: '/chat',
      meta: { requiresAuth: true },
    },
    {
      path: '/group-chat/:groupId',
      name: 'GroupChatDetail',
      component: () => import('@/views/GroupChatDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/match',
      name: 'Match',
      component: () => import('@/views/Match.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/match/success',
      name: 'MatchSuccess',
      component: () => import('@/views/MatchSuccess.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile/:username?',
      name: 'Profile',
      component: () => import('@/views/Profile.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile/edit',
      name: 'ProfileEdit',
      component: () => import('@/views/ProfileEdit.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/upgrade-guest',
      name: 'UpgradeGuest',
      component: () => import('@/views/UpgradeGuest.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/assets-preview',
      name: 'AssetsPreview',
      component: () => import('@/views/AssetsPreview.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/points',
      name: 'Points',
      component: () => import('@/views/Points.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/search',
      name: 'Search',
      component: () => import('@/views/Search.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/friends',
      name: 'Friends',
      component: () => import('@/views/Friends.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/notifications',
      name: 'Notifications',
      component: () => import('@/views/Notifications.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/blacklist',
      name: 'Blacklist',
      component: () => import('@/views/Blacklist.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/oauth/authorize',
      name: 'OAuthAuthorize',
      component: () => import('@/views/OAuthAuthorize.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/support',
      name: 'Support',
      component: () => import('@/views/Support.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/merchandise',
      name: 'Merchandise',
      component: () => import('@/views/Merchandise.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/match-history',
      name: 'MatchHistory',
      component: () => import('@/views/MatchHistory.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/Admin.vue'),
      meta: { requiresAuth: false, requiresAdmin: false },
    },
    {
      path: '/superadmin',
      name: 'SuperAdmin',
      component: () => import('@/views/AdminEnhanced.vue'),
      meta: { requiresAuth: false, requiresAdmin: false },
    },
    {
      path: '/admin/enhanced',
      name: 'AdminEnhanced',
      component: () => import('@/views/AdminEnhanced.vue'),
      meta: { requiresAuth: false, requiresAdmin: false },
    },
    {
      path: '/admin/post/:id',
      name: 'AdminPostDetail',
      component: () => import('@/views/AdminPostDetail.vue'),
      meta: { requiresAuth: false, requiresAdmin: false },
    },
    {
      path: '/admin/topic/:id',
      name: 'AdminTopicDetail',
      component: () => import('@/views/AdminTopicDetail.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/rankings',
      name: 'Rankings',
      component: () => import('@/views/Rankings.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/post/:id',
      name: 'PostDetail',
      component: () => import('@/views/PostDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/topic/:id',
      name: 'TopicDetail',
      component: () => import('@/views/TopicDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/following',
      name: 'Following',
      component: () => import('@/views/Following.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/followers',
      name: 'Followers',
      component: () => import('@/views/Followers.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/likes',
      name: 'Likes',
      component: () => import('@/views/Likes.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/game',
      name: 'Game',
      component: () => import('@/views/Game.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/game/room/:roomId',
      name: 'GameRoom',
      component: () => import('@/views/GameRoom.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/game/room/:roomId/n/:gameType',
      redirect: (to) => ({
        name: 'GamePlay',
        params: { roomId: to.params.roomId, gameType: to.params.gameType },
      }),
      meta: { requiresAuth: true },
    },
    {
      path: '/game/room/:roomId/:gameType',
      name: 'GamePlay',
      component: () => import('@/views/GamePlay.vue'),
      meta: { requiresAuth: true },
    },

  ],
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated;

  // 自动离开房间逻辑：只要从房间页面离开且目标不是房间页面或游戏页面，就强制退出所有房间
  if ((from.name === 'GameRoom' || from.name === 'GamePlay') && 
      to.name !== 'GameRoom' && 
      to.name !== 'GamePlay') {
    console.log('正在离开房间/游戏页面，自动清理房间状态...');
    // 不等待请求完成，直接放行导航，保持流畅体验
    api.post('/rooms/leave-all').catch(err => {
      console.error('自动离开房间失败:', err);
    });
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    if (authStore.isInitialLoading) {
      next();
    } else {
      next({ name: 'Login', query: { redirect: to.fullPath } });
    }
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    // 如果还在初始加载中，先允许进入，由组件内部根据加载后的状态决定是否重定向
    if (authStore.isInitialLoading) {
      next();
    } else {
      next({ name: 'Home' });
    }
  } else {
    next();
  }
});

export default router;
