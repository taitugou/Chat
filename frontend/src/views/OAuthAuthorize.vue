<template>
  <div class="min-h-screen flex items-center justify-center bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300 p-6">
    <div v-if="loading" class="ios-card w-full max-w-lg p-8 text-center space-y-4">
      <div class="flex justify-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-ios-blue border-t-transparent"></div>
      </div>
      <p class="text-ios-label-secondary">正在获取授权信息...</p>
    </div>

    <div v-else-if="error" class="ios-card w-full max-w-lg p-8 text-center space-y-6">
      <div class="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto text-4xl">
        ❌
      </div>
      <div class="space-y-2">
        <h2 class="text-2xl font-bold text-ios-label-primary">授权失败</h2>
        <p class="text-ios-label-secondary">{{ error }}</p>
      </div>
      <router-link to="/home" class="ios-btn-primary inline-block w-full py-4 rounded-2xl font-bold text-lg shadow-lg shadow-ios active:scale-[0.98] transition-all">
        返回主页
      </router-link>
    </div>

    <div v-else class="ios-card w-full max-w-lg p-8 text-center space-y-8 animate-in fade-in zoom-in duration-300">
      <div class="flex items-center justify-center space-x-6">
        <div class="w-20 h-20 rounded-3xl bg-ios-blue/10 flex items-center justify-center text-4xl shadow-inner">
          <img src="/f.ico" alt="TTG Chat" class="w-12 h-12" />
        </div>
        <div class="text-ios-label-tertiary text-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </div>
        <div class="w-20 h-20 rounded-3xl bg-ios-systemGray5 flex items-center justify-center text-4xl shadow-inner">
          🌐
        </div>
      </div>

      <div class="space-y-3">
        <h2 class="text-2xl font-bold text-ios-label-primary">
          授权 <span class="text-ios-blue">该第三方应用</span>
        </h2>
        <p class="text-ios-label-secondary">
          该应用申请获取您的以下权限：
        </p>
        <div class="bg-ios-systemGray5 rounded-2xl p-4 text-left space-y-3 border border-ios-separator">
          <div class="flex items-center space-x-3 text-sm">
            <div class="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 text-xs">✓</div>
            <span class="text-ios-label-primary">获取您的基本资料（昵称、头像、简介）</span>
          </div>
          <div class="flex items-center space-x-3 text-sm">
            <div class="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 text-xs">✓</div>
            <span class="text-ios-label-primary">获取您的账号唯一标识</span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <button 
          @click="handleAuthorize" 
          :disabled="authorizing"
          class="ios-btn-primary w-full py-4 rounded-2xl font-bold text-lg shadow-lg shadow-ios active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="authorizing" class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
            正在授权...
          </span>
          <span v-else>同意并授权</span>
        </button>
        
        <button 
          @click="handleCancel"
          class="w-full py-4 rounded-2xl font-bold text-ios-label-tertiary hover:text-ios-label-primary hover:bg-ios-systemGray5 transition-all"
        >
          取消授权
        </button>
      </div>

      <div class="pt-4 border-t border-ios-separator">
        <p class="text-[10px] text-ios-label-tertiary leading-relaxed">
          授权即代表您同意 TTG Chat 的用户协议。授权后，该应用将能够访问您的基本公开信息。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/utils/api';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const authorizing = ref(false);
const error = ref('');
const clientName = ref('');

// OAuth 参数
const clientId = route.query.client_id as string;
const redirectUri = route.query.redirect_uri as string;
const responseType = route.query.response_type as string;
const scope = route.query.scope as string;
const state = route.query.state as string;

// 辅助函数：补全重定向 URI 协议
const getFullRedirectUri = (uri: string) => {
  if (!uri) return '';
  if (/^https?:\/\//i.test(uri)) return uri;
  if (uri.startsWith('//')) return `https:${uri}`;
  const hostPort = uri.split('/')[0]?.trim() || '';
  const hostname = hostPort.split(':')[0]?.trim().toLowerCase() || '';
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local');

  const isPrivateIpv4 =
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

  const scheme = isLocalhost || isPrivateIpv4 ? 'http' : 'https';
  return `${scheme}://${uri}`;
};

const fullRedirectUri = getFullRedirectUri(redirectUri);

onMounted(async () => {
  if (!clientId || !redirectUri || responseType !== 'code') {
    error.value = '无效的授权请求参数';
    loading.value = false;
    return;
  }

  try {
    const response = await api.get(`/oauth/client/${clientId}`, {
      params: { redirect_uri: fullRedirectUri }
    });
    clientName.value = response.data.clientName;
  } catch (err: any) {
    error.value = err.response?.data?.error || '无法获取客户端信息';
  } finally {
    loading.value = false;
  }
});

const handleAuthorize = async () => {
  if (authorizing.value) return;
  
  authorizing.value = true;
  error.value = '';
  try {
    // 发送给后端的 redirectUri 必须是补全协议后的标准地址
    const response = await api.post('/oauth/authorize', {
      clientId,
      redirectUri: fullRedirectUri
    });
    const { code } = response.data;
    if (!code) {
      throw new Error('服务器未返回授权码');
    }

    try {
      const targetUrl = new URL(fullRedirectUri);
      targetUrl.searchParams.append('code', code);
      if (state) {
        targetUrl.searchParams.append('state', state);
      }
      // 执行重定向
      window.location.href = targetUrl.toString();
    } catch (urlErr) {
      throw new Error(`无效的重定向地址: ${fullRedirectUri}`);
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || '授权失败，请重试';
    authorizing.value = false;
  }
};

const handleCancel = () => {
  router.push('/home');
};
</script>
