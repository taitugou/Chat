<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
    <!-- 顶部导航栏 -->
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
        <div class="text-sm font-bold text-foreground/80">设置</div>
        <div class="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Settings</div>
      </div>
      <button 
        @click="saveSettings" 
        :disabled="saving"
        class="glass-btn-primary px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
      >
        {{ saving ? '保存中...' : '保存修改' }}
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
      <!-- 个人资料 -->
      <section class="space-y-3">
        <h3 class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] px-2">个人资料</h3>
        <div class="glass-card p-4 rounded-2xl space-y-4">
          <!-- 头像与背景 -->
          <div class="flex items-start space-x-4">
            <!-- 头像 -->
            <div class="flex flex-col items-center space-y-2">
              <div 
                class="w-20 h-20 rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center justify-center overflow-hidden relative group cursor-pointer"
                @click="avatarFileInput?.click()"
              >
                <img :src="avatarPreview || getImageUrl(user?.avatar)" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span class="text-[10px] text-white font-bold">更换头像</span>
                </div>
                <input type="file" ref="avatarFileInput" class="hidden" accept="image/*" @change="handleAvatarSelect" />
              </div>
              <span class="text-[9px] text-foreground/30 font-bold uppercase tracking-tighter">Avatar</span>
            </div>

            <!-- 背景 -->
            <div class="flex-1 flex flex-col space-y-2">
              <div 
                class="w-full h-20 rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center justify-center overflow-hidden relative group cursor-pointer"
                @click="profileBgFileInput?.click()"
              >
                <img 
                  v-if="profileBgPreview || user?.background_image" 
                  :src="profileBgPreview || getImageUrl(user?.background_image)" 
                  class="w-full h-full object-cover" 
                />
                <div v-else class="text-xl text-foreground/20">🖼️</div>
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span class="text-[10px] text-white font-bold">更换主页背景</span>
                </div>
                <input type="file" ref="profileBgFileInput" class="hidden" accept="image/*" @change="handleProfileBgSelect" />
              </div>
              <span class="text-[9px] text-foreground/30 font-bold uppercase tracking-tighter">Profile Background</span>
            </div>
          </div>

          <!-- 基础信息输入 -->
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[9px] font-black text-foreground/30 uppercase tracking-widest ml-1">账号 (唯一标识)</label>
                <input
                  v-model="settings.profile.username"
                  type="text"
                  placeholder="3-20位字符"
                  class="glass-input w-full py-2.5 px-4 rounded-xl text-xs font-bold"
                  maxlength="20"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[9px] font-black text-foreground/30 uppercase tracking-widest ml-1">昵称</label>
                <input
                  v-model="settings.profile.nickname"
                  type="text"
                  placeholder="2-20位字符"
                  class="glass-input w-full py-2.5 px-4 rounded-xl text-xs font-bold"
                  maxlength="20"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[9px] font-black text-foreground/30 uppercase tracking-widest ml-1">邮箱</label>
                <input
                  v-model="settings.profile.email"
                  type="email"
                  placeholder="example@mail.com"
                  class="glass-input w-full py-2.5 px-4 rounded-xl text-xs font-bold"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[9px] font-black text-foreground/30 uppercase tracking-widest ml-1">手机号</label>
                <input
                  v-model="settings.profile.phone"
                  type="tel"
                  placeholder="13000000000"
                  class="glass-input w-full py-2.5 px-4 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[9px] font-black text-foreground/30 uppercase tracking-widest ml-1">修改密码</label>
              <input
                v-model="settings.profile.newPassword"
                type="password"
                placeholder="留空则不修改"
                class="glass-input w-full py-2.5 px-4 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <!-- 性别选择 (统一为右侧下拉模式) -->
          <div class="pt-2 border-t border-foreground/5">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <div class="text-sm font-bold text-white">性别</div>
                <div class="text-[10px] text-foreground/50">你的公开性别展示</div>
              </div>
              <div class="w-32">
                <GlassSelect v-model="settings.profile.gender" :options="genderOptions" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 隐私设置 -->
      <section class="space-y-3">
        <h3 class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] px-2">隐私设置</h3>
        <div class="glass-card divide-y divide-foreground/5 rounded-2xl overflow-hidden">
          <!-- 资料可见性 -->
          <div class="p-4 flex items-center justify-between">
            <div class="space-y-0.5">
              <div class="text-sm font-bold text-white">资料可见性</div>
              <div class="text-[10px] text-foreground/50">谁可以看到你的主页资料</div>
            </div>
            <div class="w-32">
              <GlassSelect 
                v-model="settings.privacy.profileVisibility" 
                :options="[
                  { value: 'public', label: '所有人' },
                  { value: 'friends', label: '仅好友' },
                  { value: 'private', label: '仅自己' }
                ]"
              />
            </div>
          </div>
          <!-- 在线状态 -->
          <div class="p-4 flex items-center justify-between">
            <div class="space-y-0.5">
              <div class="text-sm font-bold text-white">在线状态</div>
              <div class="text-[10px] text-foreground/50">显示你的实时在线情况</div>
            </div>
            <div class="w-32">
              <GlassSelect 
                v-model="settings.privacy.onlineStatus" 
                :options="[
                  { value: 'public', label: '所有人' },
                  { value: 'friends', label: '仅好友' },
                  { value: 'private', label: '隐藏' }
                ]"
              />
            </div>
          </div>
          <!-- 地理位置 -->
          <div class="p-4 flex items-center justify-between">
            <div class="space-y-0.5">
              <div class="text-sm font-bold text-white">位置可见性</div>
              <div class="text-[10px] text-foreground/50">在动态中展示你的位置信息</div>
            </div>
            <div class="w-32">
              <GlassSelect 
                v-model="settings.privacy.locationVisibility" 
                :options="[
                  { value: 'public', label: '所有人' },
                  { value: 'friends', label: '仅好友' },
                  { value: 'private', label: '隐藏' }
                ]"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 通知设置 -->
      <section class="space-y-3">
        <h3 class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] px-2">消息通知</h3>
        <div class="glass-card divide-y divide-foreground/5 rounded-2xl overflow-hidden">
          <div v-for="(val, key) in settings.notification" :key="key" class="p-4 flex items-center justify-between">
            <div class="text-sm font-bold text-white">{{ notificationLabels[key] || key }}</div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.notification[key]" class="sr-only peer">
              <div class="w-9 h-5 bg-foreground/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </section>

      <!-- 应用偏好 -->
      <section class="space-y-3">
        <h3 class="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] px-2">应用偏好</h3>
        <div class="glass-card divide-y divide-foreground/5 rounded-2xl overflow-hidden">
          <!-- 落地页 -->
          <div class="p-4 flex items-center justify-between">
            <div class="space-y-0.5">
              <div class="text-sm font-bold text-white">默认落地页</div>
              <div class="text-[10px] text-foreground/50">登录后首选跳转页面</div>
            </div>
            <div class="w-32">
              <GlassSelect 
                v-model="settings.defaultLandingPage" 
                :options="[
                  { value: 'home', label: '首页' },
                  { value: 'discover', label: '发现' },
                  { value: 'messages', label: '消息' }
                ]"
              />
            </div>
          </div>
          <!-- 聊天背景 -->
          <div class="p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <div class="text-sm font-bold text-white">全局聊天背景</div>
                <div class="text-[10px] text-foreground/50">自定义所有对话的背景图</div>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  v-if="bgPreview" 
                  @click="resetBg" 
                  class="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  重置
                </button>
                <button 
                  @click="triggerBgUpload" 
                  class="text-xs text-primary hover:text-primary-light transition-colors flex items-center gap-1"
                  :disabled="bgUploading"
                >
                  {{ bgPreview ? '更换背景' : '选择背景' }}
                </button>
              </div>
            </div>
            
            <div v-if="bgPreview" class="flex-1 space-y-1.5 pt-2">
              <button 
                @click="applyBgToAll" 
                :disabled="bgUploading"
                class="glass-btn w-full py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                应用到所有聊天
              </button>
            </div>
            
            <input type="file" ref="bgInput" class="hidden" accept="image/*" @change="handleBgChange" />
          </div>
        </div>
      </section>

      <!-- 退出登录 -->
      <section class="px-2">
        <button 
          @click="handleLogout"
          class="glass-btn w-full py-4 rounded-2xl text-red-500 font-bold text-sm hover:bg-red-500/10 active:scale-[0.98] transition-all"
        >
          退出登录
        </button>
      </section>
    </div>

    <!-- 提示消息 -->
    <div v-if="toast.show" class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div :class="[
        'px-6 py-3 rounded-2xl shadow-xl backdrop-blur-md border font-bold text-sm',
        toast.type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'
      ]">
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { getImageUrl } from '@/utils/imageUrl';
import GlassSelect from '@/components/GlassSelect.vue';
import MentionInput from '@/components/MentionInput.vue';

const router = useRouter();
const authStore = useAuthStore();

// 状态定义
const saving = ref(false);
const bgUploading = ref(false);
const bgInput = ref<HTMLInputElement | null>(null);
const bgPreview = ref('');

// 个人资料相关状态
const user = ref<any>(null);
const avatarFileInput = ref<HTMLInputElement | null>(null);
const profileBgFileInput = ref<HTMLInputElement | null>(null);
const avatarPreview = ref('');
const profileBgPreview = ref('');
const selectedAvatarFile = ref<File | null>(null);
const selectedProfileBgFile = ref<File | null>(null);

const settings = reactive({
  profile: {
    nickname: '',
    username: '',
    email: '',
    phone: '',
    newPassword: '',
    gender: 'secret',
  },
  privacy: {
    profileVisibility: 'public',
    onlineStatus: 'friends',
    locationVisibility: 'public',
  },
  notification: {
    like: true,
    comment: true,
    message: true,
    match: true,
  },
  defaultLandingPage: 'home',
});

const genderOptions = [
  { value: 'secret', label: '保密' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
];

const notificationLabels: Record<string, string> = {
  like: '获赞提醒',
  comment: '评论提醒',
  message: '私信提醒',
  match: '匹配提醒',
};

const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error',
});

// 方法定义
function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
}

function goBackOneLevel() {
  const state = router.options.history.state as unknown as { back?: string | null } | null;
  if (state?.back) {
    router.back();
    return;
  }
  router.push('/home');
}

async function fetchSettings() {
  try {
    // 获取用户基本信息
    const userResp = await api.get('/auth/me');
    user.value = userResp.data.user;
    
    // 同步到 profile 设置
    settings.profile = {
      nickname: user.value.nickname || '',
      username: user.value.username || '',
      email: user.value.email || '',
      phone: user.value.phone || '',
      gender: user.value.gender || 'secret',
      newPassword: '',
    };

    // 获取系统设置
    const response = await api.get('/settings/user');
    const data = response.data.settings;
    if (data) {
      if (data.privacy) Object.assign(settings.privacy, data.privacy);
      if (data.notification) Object.assign(settings.notification, data.notification);
      if (data.defaultLandingPage) settings.defaultLandingPage = data.defaultLandingPage;
    }

    // 获取全局聊天背景
    const chatResp = await api.get('/settings/chat');
    const globalSetting = chatResp.data.settings?.find((s: any) => s.conversation_id === null);
    if (globalSetting?.background_image) {
      bgPreview.value = globalSetting.background_image;
    }
  } catch (error) {
    console.error('获取设置失败:', error);
  }
}

function handleAvatarSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  selectedAvatarFile.value = file;
  const reader = new FileReader();
  reader.onload = (e) => { avatarPreview.value = e.target?.result as string; };
  reader.readAsDataURL(file);
}

function handleProfileBgSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  selectedProfileBgFile.value = file;
  const reader = new FileReader();
  reader.onload = (e) => { profileBgPreview.value = e.target?.result as string; };
  reader.readAsDataURL(file);
}

async function saveSettings() {
  saving.value = true;
  try {
    // 1. 保存个人资料
    await api.put('/user/profile', {
      nickname: settings.profile.nickname,
      gender: settings.profile.gender,
    });

    // 2. 保存账号信息 (Username/Email/Phone/Password)
    if (settings.profile.username !== user.value.username ||
        settings.profile.email !== user.value.email || 
        settings.profile.phone !== user.value.phone || 
        settings.profile.newPassword) {
      await api.put('/user/settings/account', {
        username: settings.profile.username,
        email: settings.profile.email,
        phone: settings.profile.phone,
        newPassword: settings.profile.newPassword || undefined,
      });
    }

    // 3. 上传头像
    if (selectedAvatarFile.value) {
      const formData = new FormData();
      formData.append('avatar', selectedAvatarFile.value);
      await api.post('/user/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }

    // 4. 上传个人主页背景
    if (selectedProfileBgFile.value) {
      const formData = new FormData();
      formData.append('background', selectedProfileBgFile.value);
      await api.post('/user/background', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }

    // 5. 保存通用设置
    await api.put('/settings/user', {
      privacy: settings.privacy,
      notification: settings.notification,
      defaultLandingPage: settings.defaultLandingPage,
    });

    showToast('所有设置已保存');
    
    // 刷新全局 Store 数据
    await authStore.fetchUserInfo();
    await authStore.fetchUserSettings();
    
    // 刷新本地数据
    await fetchSettings();
    settings.profile.newPassword = '';
    selectedAvatarFile.value = null;
    selectedProfileBgFile.value = null;
    avatarPreview.value = '';
    profileBgPreview.value = '';
  } catch (error: any) {
    showToast(error.response?.data?.error || '保存失败', 'error');
  } finally {
    saving.value = false;
  }
}

function triggerBgUpload() {
  bgInput.value?.click();
}

async function handleBgChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // 上传图片
  bgUploading.value = true;
  const formData = new FormData();
  formData.append('background', file);

  try {
    const response = await api.post('/settings/chat/background', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    bgPreview.value = response.data.url;
    showToast('聊天背景上传成功');
  } catch (error: any) {
    showToast(error.response?.data?.error || '上传失败', 'error');
  } finally {
    bgUploading.value = false;
  }
}

async function applyBgToAll() {
  if (!bgPreview.value) return;
  try {
    await api.put('/settings/chat/background/all', { backgroundImage: bgPreview.value });
    showToast('已应用到所有聊天');
  } catch (error: any) {
    showToast(error.response?.data?.error || '应用失败', 'error');
  }
}

async function resetBg() {
  bgPreview.value = '';
  try {
    await api.put('/settings/chat/background/all', { backgroundImage: null });
    showToast('聊天背景已重置');
  } catch (error) {
    showToast('重置失败', 'error');
  }
}

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    authStore.logout();
    router.push('/login');
  }
}

onMounted(() => {
  fetchSettings();
});
</script>

<style scoped>
.glass-card {
  @apply bg-foreground/[0.03] border border-foreground/[0.08] backdrop-blur-md shadow-xl;
}
.glass-btn-primary {
  @apply bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all;
}
.glass-btn {
  @apply bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-white transition-all border border-foreground/5;
}
.glass-input {
  @apply bg-foreground/5 border border-foreground/10 text-foreground focus:bg-foreground/10 focus:border-primary/30 outline-none transition-all placeholder:text-foreground/20;
}
</style>
