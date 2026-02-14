<template>
  <div class="min-h-screen pb-20 bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300">
    <TopNav title="编辑资料" />

    <div class="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
      <!-- 基本信息 -->
      <div class="ios-card p-6 space-y-6">
        <h2 class="text-xs font-black text-ios-label-tertiary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span class="text-lg">👤</span> 基本信息
        </h2>
        
        <div class="space-y-6">
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">昵称</label>
            <input
              v-model="form.nickname"
              type="text"
              placeholder="2-20位字符"
              class="ios-input w-full py-4 px-5 rounded-2xl"
              maxlength="20"
            />
          </div>

          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">个性签名</label>
            <MentionInput
              v-model="form.bio"
              placeholder="用一句话介绍自己..."
              :rows="3"
              :maxLength="200"
              class="rounded-2xl"
            />
          </div>

          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">性别</label>
            <GlassSelect v-model="form.gender" :options="genderOptions" />
          </div>

          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">地区</label>
            <div class="flex items-center gap-2">
              <input
                v-model="form.location"
                type="text"
                placeholder="点击右侧获取当前位置"
                class="ios-input flex-1 py-4 px-5 rounded-2xl bg-ios-systemGray5"
                readonly
              />
              <button @click="getLocation" class="ios-btn-secondary px-6 py-4 rounded-2xl text-xs font-bold active:scale-95 transition-all">
                重新获取
              </button>
            </div>
          </div>
          
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">地址可见性</label>
            <GlassSelect v-model="form.locationVisibility" :options="locationVisibilityOptions" />
          </div>

          <div class="space-y-3">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">兴趣标签 ({{ form.interestTags.length }}/10)</label>
            <div class="flex flex-wrap gap-2 mb-4 min-h-[44px] p-3 ios-glass rounded-2xl bg-ios-systemGray5 border border-ios-separator">
              <span
                v-for="tag in form.interestTags"
                :key="tag"
                class="px-3 py-1.5 ios-btn-primary rounded-full text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                @click="removeTag(tag)"
              >
                {{ tag }}
                <span class="text-sm opacity-60">×</span>
              </span>
              
              <div v-if="form.interestTags.length < 10" class="flex items-center flex-1 min-w-[150px] gap-2">
                <input
                  v-model="customTag"
                  @keyup.enter="addCustomTag"
                  placeholder="添加自定义标签..."
                  class="bg-transparent text-white text-xs px-2 py-1 flex-1 focus:outline-none placeholder-white/20"
                  type="text"
                  maxlength="10"
                />
                <button 
                  v-if="customTag.trim()"
                  @click="addCustomTag"
                  class="text-[10px] font-black text-ios-blue uppercase tracking-widest px-2 py-1 hover:opacity-70 transition-opacity whitespace-nowrap"
                >
                  添加
                </button>
              </div>
            </div>
            
            <div class="space-y-2">
              <p class="text-[10px] text-ios-label-quaternary uppercase tracking-widest font-black ml-1">推荐标签</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in availableTags.filter(t => !form.interestTags.includes(t))"
                  :key="tag"
                  @click="toggleTag(tag)"
                  class="px-3 py-1.5 rounded-full cursor-pointer ios-glass text-[11px] font-bold text-ios-label-tertiary hover:text-white hover:bg-ios-systemGray5 border border-ios-separator active:scale-90 transition-all"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 媒体资源 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- 头像 -->
        <div class="ios-card p-6 space-y-6">
          <h2 class="text-xs font-black text-ios-label-tertiary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span class="text-lg">🖼️</span> 头像
          </h2>
          <div class="flex flex-col items-center gap-6">
            <div class="relative group cursor-pointer" @click="fileInput?.click()">
              <img
                :src="avatarPreview || getImageUrl(user?.avatar)"
                class="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-ios-separator shadow-2xl transition-all group-hover:scale-105 group-hover:rotate-3"
              />
              <div class="absolute inset-0 bg-ios-black/40 rounded-[2.5rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                <span class="text-xs font-black text-white uppercase tracking-widest">更换</span>
              </div>
            </div>
            <div class="text-center space-y-2">
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png"
                @change="handleAvatarSelect"
                class="hidden"
              />
              <button @click="fileInput?.click()" class="ios-btn-secondary px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all">
                Select Photo
              </button>
              <p class="text-[10px] text-ios-label-quaternary uppercase tracking-tighter">JPG / PNG | MAX 2MB</p>
            </div>
          </div>
        </div>

        <!-- 背景图片 -->
        <div class="ios-card p-6 space-y-6">
          <h2 class="text-xs font-black text-ios-label-tertiary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span class="text-lg">🎨</span> 背景
          </h2>
          <div class="space-y-4">
            <div 
              class="relative w-full aspect-video ios-glass rounded-2xl overflow-hidden border border-ios-separator shadow-inner group cursor-pointer"
              @click="backgroundFileInput?.click()"
            >
              <img
                v-if="backgroundPreview || user?.background_image"
                :src="backgroundPreview || getImageUrl(user?.background_image, '')"
                class="w-full h-full object-cover transition-all group-hover:scale-110"
              />
              <div v-else class="absolute inset-0 flex flex-col items-center justify-center text-ios-label-quaternary">
                <span class="text-3xl mb-2">🖼️</span>
                <span class="text-[10px] font-black uppercase tracking-widest">No Background</span>
              </div>
              <div class="absolute inset-0 bg-ios-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                <span class="text-xs font-black text-white uppercase tracking-widest">更换背景</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <p class="text-[10px] text-ios-label-quaternary leading-relaxed max-w-[140px]">建议上传高清图片以获得最佳毛玻璃效果</p>
              <input
                ref="backgroundFileInput"
                type="file"
                accept="image/jpeg,image/png"
                @change="handleBackgroundSelect"
                class="hidden"
              />
              <button @click="backgroundFileInput?.click()" class="ios-btn-secondary px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all">
                Change
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 隐私设置 -->
      <div class="ios-card p-6 space-y-6">
        <h2 class="text-xs font-black text-ios-label-tertiary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span class="text-lg">🔒</span> 隐私设置
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">资料可见性</label>
            <GlassSelect v-model="form.profileVisibility" :options="contentVisibilityOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">帖子可见性</label>
            <GlassSelect v-model="form.postsVisibility" :options="contentVisibilityOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">获赞可见性</label>
            <GlassSelect v-model="form.likesVisibility" :options="contentVisibilityOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">关注列表可见性</label>
            <GlassSelect v-model="form.followingVisibility" :options="contentVisibilityOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">粉丝可见性</label>
            <GlassSelect v-model="form.followersVisibility" :options="contentVisibilityOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">在线状态</label>
            <GlassSelect v-model="form.onlineStatus" :options="onlineStatusOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">最后上线时间</label>
            <GlassSelect v-model="form.lastSeen" :options="onlineStatusOptions" />
          </div>
        </div>
      </div>

      <div class="pt-6">
        <button 
          @click="saveProfile" 
          class="ios-btn-primary w-full py-5 rounded-[2rem] font-black text-base shadow-2xl shadow-ios active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale" 
          :disabled="saving"
        >
          <span v-if="saving" class="flex items-center justify-center gap-3">
            <svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            SAVING CHANGES...
          </span>
          <span v-else>SAVE PROFILE</span>
        </button>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';
import MentionInput from '@/components/MentionInput.vue';
import GlassSelect from '@/components/GlassSelect.vue';
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';

const router = useRouter();

const genderOptions = [
  { value: 'secret', label: '保密' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
];

const locationVisibilityOptions = [
  { value: 'public', label: '所有人可见' },
  { value: 'friends', label: '好友可见' },
  { value: 'private', label: '隐藏' }
];

const contentVisibilityOptions = [
  { value: 'public', label: '所有人可见' },
  { value: 'friends', label: '仅好友可见' },
  { value: 'private', label: '仅自己可见' }
];

const onlineStatusOptions = [
  { value: 'public', label: '所有人可见' },
  { value: 'friends', label: '仅好友可见' },
  { value: 'private', label: '隐藏' }
];

const user = ref<any>(null);
const form = ref({
  nickname: '',
  bio: '',
  gender: 'secret',
  location: '',
  locationVisibility: 'public',
  interestTags: [] as string[],
  postsVisibility: 'public',
  likesVisibility: 'public',
  followingVisibility: 'public',
  followersVisibility: 'public',
  profileVisibility: 'public',
  onlineStatus: 'friends',
  lastSeen: 'friends',
});
const customTag = ref('');
const avatarPreview = ref('');
const backgroundPreview = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const backgroundFileInput = ref<HTMLInputElement | null>(null);
const saving = ref(false);
const selectedAvatarFile = ref<File | null>(null);
const selectedBackgroundFile = ref<File | null>(null);

const availableTags = [
  '音乐', '电影', '旅行', '美食', '运动', '阅读', '游戏', '摄影',
  '绘画', '舞蹈', '编程', '设计', '时尚', '宠物', '健身', '瑜伽',
];

onMounted(async () => {
  await fetchUserInfo();
  if (!form.value.location) {
    await getLocation();
  }
});

async function fetchUserInfo() {
  try {
    const response = await api.get('/auth/me');
    user.value = response.data.user;
    form.value = {
      nickname: user.value.nickname || '',
      bio: user.value.bio || '',
      gender: user.value.gender || 'secret',
      location: user.value.location || '',
      locationVisibility: user.value.privacy?.locationVisibility || 'public',
      interestTags: user.value.interest_tags || [],
      postsVisibility: user.value.posts_visibility || 'public',
      likesVisibility: user.value.likes_visibility || 'public',
      followingVisibility: user.value.following_visibility || 'public',
      followersVisibility: user.value.followers_visibility || 'public',
      profileVisibility: user.value.privacy?.profileVisibility || 'public',
      onlineStatus: user.value.privacy?.onlineStatus || 'friends',
      lastSeen: user.value.privacy?.lastSeen || 'friends',
    };
  } catch (error) {}
}

async function getLocation() {
  let ip = '';
  try {
    const ipResp = await fetch('https://api64.ipify.org?format=json');
    const ipData = await ipResp.json();
    ip = ipData.ip;
    const geoResp = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
    const geo = await geoResp.json();
    const city = geo.city || '';
    const region = geo.regionName || '';
    let location = '';
    if (region && city) location = `${region} ${city}`;
    else if (region) location = region;
    else if (city) location = city;
    if (location) form.value.location = location;
  } catch (e) {
    if (ip) {
      try {
        const geoResp = await fetch(`https://ipinfo.io/${ip}/json`);
        const geo = await geoResp.json();
        const city = geo.city || '';
        const region = geo.region || '';
        let location = '';
        if (region && city) location = `${region} ${city}`;
        else if (region) location = region;
        else if (city) location = city;
        if (location) form.value.location = location;
      } catch (backupError) {}
    }
  }
}

function toggleTag(tag: string) {
  if (form.value.interestTags.length < 10) {
    form.value.interestTags.push(tag);
  }
}

function removeTag(tag: string) {
  const index = form.value.interestTags.indexOf(tag);
  if (index > -1) {
    form.value.interestTags.splice(index, 1);
  }
}

function addCustomTag() {
  const tag = customTag.value.trim();
  if (tag && tag.length > 0 && !form.value.interestTags.includes(tag) && form.value.interestTags.length < 10) {
    form.value.interestTags.push(tag);
    customTag.value = '';
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

function handleBackgroundSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  selectedBackgroundFile.value = file;
  const reader = new FileReader();
  reader.onload = (e) => { backgroundPreview.value = e.target?.result as string; };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  saving.value = true;
  try {
    const hasBasicChanges = form.value.nickname !== user.value.nickname ||
                          form.value.bio !== user.value.bio ||
                          form.value.gender !== user.value.gender ||
                          form.value.location !== user.value.location ||
                          form.value.locationVisibility !== (user.value.privacy?.locationVisibility || 'public') ||
                          JSON.stringify(form.value.interestTags) !== JSON.stringify(user.value.interest_tags);

    if (hasBasicChanges) {
      await api.put('/user/profile', {
        nickname: form.value.nickname,
        bio: form.value.bio,
        gender: form.value.gender,
        location: form.value.location,
        locationVisibility: form.value.locationVisibility,
        interestTags: form.value.interestTags,
      });
    }

    if (selectedAvatarFile.value) {
      const formData = new FormData();
      formData.append('avatar', selectedAvatarFile.value);
      await api.post('/user/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }

    if (selectedBackgroundFile.value) {
      const formData = new FormData();
      formData.append('background', selectedBackgroundFile.value);
      await api.post('/user/background', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }

    await api.put('/user/settings/privacy', {
      posts_visibility: form.value.postsVisibility,
      likes_visibility: form.value.likesVisibility,
      following_visibility: form.value.followingVisibility,
      followers_visibility: form.value.followersVisibility,
      profile_visibility: form.value.profileVisibility,
      online_status: form.value.onlineStatus,
      lastSeen: form.value.lastSeen,
    });

    alert('保存成功');
    router.back();
  } catch (error: any) {
    alert(error.response?.data?.error || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>


