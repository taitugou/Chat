<template>
  <div class="min-h-screen flex items-center justify-center bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300 relative overflow-hidden p-4">
    <!-- 背景光晕 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-0 right-1/4 w-96 h-96 bg-ios-blue/10 rounded-full blur-[120px] animate-pulse"></div>
      <div class="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[120px] animate-pulse delay-700"></div>
    </div>

    <div class="ios-card w-full max-w-lg p-8 sm:p-10 relative z-10 animate-in fade-in zoom-in duration-500">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-black text-ios-label-primary tracking-tight mb-2">加入我们</h1>
        <p class="text-ios-label-tertiary text-sm font-medium">开启属于你的社交之旅</p>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">Username</label>
            <input
              v-model="form.username"
              type="text"
              placeholder="3-20位字符"
              class="ios-input w-full py-3.5 px-5 rounded-2xl text-sm"
              required
              minlength="3"
              maxlength="20"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">Nickname</label>
            <input
              v-model="form.nickname"
              type="text"
              placeholder="2-20位字符"
              class="ios-input w-full py-3.5 px-5 rounded-2xl text-sm"
              required
              minlength="2"
              maxlength="20"
            />
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">Phone Number</label>
          <input
            v-model="form.phone"
            type="tel"
            placeholder="请输入手机号"
            class="ios-input w-full py-3.5 px-5 rounded-2xl text-sm"
            required
            pattern="^1[3-9]\d{9}$"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">Email Address</label>
          <input
            v-model="form.email"
            type="email"
            placeholder="请输入邮箱"
            class="ios-input w-full py-3.5 px-5 rounded-2xl text-sm"
            required
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest ml-1">Password</label>
          <div class="relative group">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="8-20位，包含字母和数字"
              class="ios-input w-full py-3.5 px-5 pr-12 rounded-2xl text-sm"
              required
              minlength="8"
              maxlength="20"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-ios-label-quaternary hover:text-ios-label-secondary transition-colors active:scale-90"
            >
              <svg v-if="showPassword" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>

        <div class="pt-4">
          <button
            type="submit"
            class="ios-btn-primary w-full py-4 rounded-2xl font-black text-sm shadow-2xl shadow-ios active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
            :disabled="loading"
          >
            {{ loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT' }}
          </button>
        </div>

        <div class="text-center pt-2">
          <span class="text-xs font-bold text-ios-label-quaternary uppercase tracking-widest">Already have an account?</span>
          <router-link to="/login" class="text-xs font-bold text-ios-blue hover:opacity-70 transition-opacity ml-2">
            立即登录
          </router-link>
        </div>
      </form>

      <div v-if="error" class="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 font-bold text-center animate-in slide-in-from-top-2">
        ⚠️ {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  username: '',
  nickname: '',
  phone: '',
  email: '',
  password: '',
});

const loading = ref(false);
const error = ref('');
const showPassword = ref(false);

async function handleRegister() {
  loading.value = true;
  error.value = '';

  try {
    await authStore.register(form.value);
    await authStore.fetchUserSettings();
    router.push('/');
  } catch (err: any) {
    error.value = err.message || '注册失败，请检查输入信息';
  } finally {
    loading.value = false;
  }
}
</script>
