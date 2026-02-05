<template>
  <div class="min-h-screen flex items-center justify-center bg-background text-foreground transition-colors duration-300 relative overflow-hidden p-4">
    <!-- 背景光晕 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-1/4 -left-20 w-80 h-80 bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
      <div class="absolute bottom-1/4 -right-20 w-80 h-80 bg-purple-600/20 rounded-full blur-[100px] animate-pulse delay-700"></div>
    </div>

    <div class="glass-card w-full max-w-md p-8 sm:p-10 relative z-10 animate-in fade-in zoom-in duration-500">
      <div class="text-center mb-10">
        <div class="w-16 h-16 bg-foreground/5 rounded-2xl flex items-center justify-center border border-foreground/10 shadow-2xl mx-auto mb-6">
          <span class="text-3xl">💬</span>
        </div>
        <h1 class="text-3xl font-black text-white tracking-tight mb-2">TTG Chat</h1>
        <p class="text-foreground/40 text-sm font-medium">欢迎回来，开启精彩社交</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-foreground/30 uppercase tracking-widest ml-1">Account</label>
            <input
              v-model="form.account"
              type="text"
              placeholder="账号 / 手机号 / 邮箱"
              class="glass-input w-full py-4 px-5 rounded-2xl"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-foreground/30 uppercase tracking-widest ml-1">Password</label>
            <div class="relative group">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                class="glass-input w-full py-4 px-5 pr-12 rounded-2xl"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/20 hover:text-foreground/60 transition-colors active:scale-90"
              >
                <svg v-if="showPassword" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between px-1">
          <label class="flex items-center cursor-pointer group">
            <div class="relative w-5 h-5 mr-3">
              <input
                v-model="form.rememberMe"
                type="checkbox"
                class="sr-only peer"
              />
              <div class="w-full h-full glass border border-foreground/20 rounded-lg transition-all peer-checked:bg-primary peer-checked:border-primary"></div>
              <svg class="absolute inset-0 w-3 h-3 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <span class="text-xs font-bold text-foreground/40 group-hover:text-foreground/60 transition-colors">记住登录</span>
          </label>
          <router-link to="/forgot" class="text-xs font-bold text-primary hover:opacity-70 transition-opacity">
            忘记密码？
          </router-link>
        </div>

        <button
          type="submit"
          class="glass-btn-primary w-full py-4 rounded-2xl font-black text-sm shadow-2xl shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
          :disabled="loading"
        >
          {{ loading ? 'AUTHENTICATING...' : 'SIGN IN' }}
        </button>

        <div class="text-center pt-2 space-y-4">
          <div>
            <span class="text-xs font-bold text-foreground/20 uppercase tracking-widest">New here?</span>
            <router-link to="/register" class="text-xs font-bold text-primary hover:opacity-70 transition-opacity ml-2">
              立即注册
            </router-link>
          </div>
          
          <div class="pt-2 border-t border-foreground/5">
            <button 
              type="button"
              @click="handleGuestLogin"
              class="text-xs font-bold text-foreground/40 hover:text-foreground/80 transition-colors flex items-center justify-center mx-auto group"
              :disabled="loading"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-foreground/20 group-hover:bg-primary mr-2 transition-colors"></span>
              游客登录
            </button>
          </div>
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
  account: '',
  password: '',
  rememberMe: false,
});

const loading = ref(false);
const error = ref('');
const showPassword = ref(false);

async function handleLogin() {
  loading.value = true;
  error.value = '';

  try {
    await authStore.login(form.value.account, form.value.password, form.value.rememberMe);
    await authStore.fetchUserSettings();
    const redirect = router.currentRoute.value.query.redirect as string;
    router.push(redirect || '/');
  } catch (err: any) {
    error.value = err.message || '登录失败，请检查账号密码';
  } finally {
    loading.value = false;
  }
}

async function handleGuestLogin() {
  loading.value = true;
  error.value = '';

  try {
    await authStore.guestLogin();
    router.push('/');
  } catch (err: any) {
    error.value = err.message || '游客登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

