<template>
  <div class="min-h-screen pb-20 bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300">
    <TopNav title="支持与合作" />
    
    <div class="max-w-4xl mx-auto px-4 py-6 space-y-8 pb-24">
      <!-- 头部介绍 -->
      <div class="text-center space-y-4 py-6">
        <div class="w-20 h-20 bg-ios-systemGray5 rounded-3xl flex items-center justify-center border border-ios-separator shadow-2xl mx-auto">
          <span class="text-4xl">🤝</span>
        </div>
        <div class="space-y-1">
          <h1 class="text-2xl font-black text-white tracking-tight">联系我们</h1>
          <p class="text-ios-label-tertiary text-xs font-bold uppercase tracking-widest">Support & Partnership</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- 联系方式 -->
        <div class="ios-card p-6 space-y-6 flex flex-col">
          <h2 class="text-xs font-black text-ios-label-tertiary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span class="text-lg">📧</span> 联系渠道
          </h2>
          
          <div class="space-y-4 flex-1">
            <div class="flex items-center justify-between p-4 bg-ios-systemGray5 rounded-2xl border border-ios-separator group hover:bg-ios-systemGray5 transition-all">
              <div class="flex items-center gap-3">
                <span class="text-xl">📧</span>
                <div class="space-y-0.5">
                  <p class="text-[9px] font-black text-ios-label-quaternary uppercase tracking-widest">电子邮箱</p>
                  <p class="text-sm font-bold text-ios-label-primary">taitugou@163.com</p>
                </div>
              </div>
              <button @click="copyToClipboard('taitugou@163.com')" class="ios-btn-secondary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-90 transition-all">
                复制
              </button>
            </div>

            <div class="flex items-center justify-between p-4 bg-ios-systemGray5 rounded-2xl border border-ios-separator group hover:bg-ios-systemGray5 transition-all">
              <div class="flex items-center gap-3">
                <span class="text-xl">💬</span>
                <div class="space-y-0.5">
                  <p class="text-[9px] font-black text-ios-label-quaternary uppercase tracking-widest">微信</p>
                  <p class="text-sm font-bold text-ios-label-primary">Tai-Tugou-TIGER</p>
                </div>
              </div>
              <button @click="copyToClipboard('Tai-Tugou-TIGER')" class="ios-btn-secondary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-90 transition-all">
                复制
              </button>
            </div>

            <div class="flex items-center justify-between p-4 bg-ios-systemGray5 rounded-2xl border border-ios-separator group hover:bg-ios-systemGray5 transition-all">
              <div class="flex items-center gap-3">
                <span class="text-xl">🐧</span>
                <div class="space-y-0.5">
                  <p class="text-[9px] font-black text-ios-label-quaternary uppercase tracking-widest">QQ</p>
                  <p class="text-sm font-bold text-ios-label-primary">161923108</p>
                </div>
              </div>
              <button @click="copyToClipboard('161923108')" class="ios-btn-secondary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-90 transition-all">
                复制
              </button>
            </div>

            <div class="flex items-center justify-between p-4 bg-ios-systemGray5 rounded-2xl border border-ios-separator group hover:bg-ios-systemGray5 transition-all">
              <div class="flex items-center gap-3">
                <span class="text-xl">🐟</span>
                <div class="space-y-0.5">
                  <p class="text-[9px] font-black text-ios-label-quaternary uppercase tracking-widest">闲鱼</p>
                  <p class="text-sm font-bold text-ios-label-primary">taitugou</p>
                </div>
              </div>
              <button @click="copyToClipboard('taitugou')" class="ios-btn-secondary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-90 transition-all">
                复制
              </button>
            </div>
          </div>
          
          <p class="text-[10px] text-ios-label-quaternary text-center pt-4">我们将会在 24 小时内回复您的邮件或消息</p>
        </div>

        <!-- 赞助支持 -->
        <div class="ios-card p-6 space-y-6 flex flex-col items-center">
          <div class="flex items-center justify-between mb-4 w-full">
            <h2 class="text-xs font-black text-ios-label-tertiary uppercase tracking-[0.2em] flex items-center gap-2">
              <span class="text-lg">💰</span> 赞助支持
            </h2>
            <router-link to="/merchandise" class="ios-btn-secondary px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-90 transition-all border-ios-blue/30 text-ios-blue">
              相关周边
            </router-link>
          </div>
          
          <div class="relative group">
            <div class="absolute -inset-4 bg-gradient-to-r from-ios-blue/20 to-ios-purple/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <img
              :src="supportQrUrl"
              class="relative w-64 h-64 object-cover rounded-[2rem] border-4 border-ios-separator shadow-2xl transition-all group-hover:scale-105"
            />
          </div>
          
          <div class="space-y-4 w-full pt-4">
            <p class="text-[10px] text-ios-label-tertiary text-center leading-relaxed">您的支持是我们持续开发和维护的动力<br />每一份赞助都将用于提升服务器性能</p>
            <button
              @click="downloadImage(supportQrUrl, '收款码.jpg')"
              class="w-full ios-btn-primary py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
            >
              下载收款码
            </button>
          </div>
        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';

const supportQrUrl = '/support_qr.jpg';

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    alert('复制成功');
  }).catch(err => {
    console.error('复制失败:', err);
  });
}

function downloadImage(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
</script>

