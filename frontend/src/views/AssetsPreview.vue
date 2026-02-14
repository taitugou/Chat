<template>
  <div class="h-screen flex flex-col overflow-hidden bg-ios-systemGray6 text-ios-label-primary transition-colors duration-300">
    <div class="ios-glass px-4 py-3 flex items-center z-50 shadow-sm border-b border-ios-separator">
      <button
        @click="router.back()"
        class="p-2 -ml-2 rounded-full text-ios-label-secondary hover:text-white hover:bg-ios-systemGray5 transition-all active:scale-90"
        title="返回上一页"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0 ml-2">
        <div class="text-sm font-bold text-ios-label-primary">资源预览</div>
        <div class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-widest">Assets Preview</div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
      <div v-if="loading" class="ios-card p-6 rounded-2xl text-center text-ios-label-tertiary">
        正在加载资源清单...
      </div>
      <div v-else-if="error" class="ios-card p-6 rounded-2xl text-center text-red-400">
        {{ error }}
      </div>

      <template v-else>
        <section class="space-y-3">
          <h3 class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-[0.2em] px-2">品牌</h3>
          <div class="ios-card p-4 rounded-2xl flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <img :src="brandLogoUrl" class="w-12 h-12 rounded-xl bg-ios-systemGray5 border border-ios-separator object-contain" />
              <div class="min-w-0">
                <div class="text-sm font-bold text-white truncate">brand-logo.svg</div>
                <div class="text-[10px] text-ios-label-tertiary truncate">{{ brandLogoUrl }}</div>
              </div>
            </div>
            <a :href="brandLogoUrl" target="_blank" class="ios-btn-secondary px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all">
              打开
            </a>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-[0.2em] px-2">SVG 图片</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div v-for="img in imageUrls" :key="img.name" class="ios-card p-3 rounded-2xl space-y-2">
              <div class="w-full aspect-square rounded-xl bg-ios-systemGray5 border border-ios-separator overflow-hidden flex items-center justify-center">
                <img :src="img.url" class="w-full h-full object-contain p-3" />
              </div>
              <div class="text-xs font-bold text-white truncate">{{ img.name }}</div>
              <div class="flex items-center justify-between gap-2">
                <div class="text-[10px] text-ios-label-tertiary truncate">{{ img.url }}</div>
                <a :href="img.url" target="_blank" class="ios-btn-secondary px-3 py-1.5 rounded-lg text-[10px] font-bold active:scale-95 transition-all">
                  打开
                </a>
              </div>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-[10px] font-black text-ios-label-tertiary uppercase tracking-[0.2em] px-2">音频 (WAV)</h3>
          <div class="ios-card rounded-2xl overflow-hidden divide-y divide-foreground/5">
            <div v-for="a in audioUrls" :key="a.name" class="p-4 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-bold text-white truncate">{{ a.name }}</div>
                <div class="text-[10px] text-ios-label-tertiary truncate">{{ a.url }}</div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="ios-btn-secondary px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  @click="playUrl(a.url)"
                >
                  播放
                </button>
                <button
                  v-if="isLoopCandidate(a.name)"
                  class="ios-btn-secondary px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  @click="toggleLoop(a.name, a.url)"
                >
                  {{ loopPlaying[a.name] ? '停止循环' : '循环播放' }}
                </button>
                <a :href="a.url" target="_blank" class="ios-btn-secondary px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all">
                  打开
                </a>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { audioManager } from '@/utils/audio';

const router = useRouter();

const loading = ref(true);
const error = ref('');
const manifest = ref<any>(null);

const base = '/qitafujian/';

const brandLogoUrl = computed(() => {
  const p = manifest.value?.images?.brandLogo;
  return p ? `${base}${p}` : `${base}images/brand-logo.svg`;
});

const imageUrls = computed(() => {
  const list: string[] = manifest.value?.images?.svgs || [];
  return list.map((p: string) => ({
    name: String(p).split('/').pop() || p,
    url: `${base}${p}`,
  }));
});

const audioUrls = computed(() => {
  const list: string[] = manifest.value?.audio?.wavs || [];
  return list.map((p: string) => ({
    name: String(p).split('/').pop() || p,
    url: `${base}${p}`,
  }));
});

const loopPlayers = reactive<Record<string, HTMLAudioElement | null>>({});
const loopPlaying = reactive<Record<string, boolean>>({});

function playUrl(url: string) {
  if (audioManager.getMuted()) return;
  const a = new Audio(url);
  a.volume = audioManager.getVolume();
  a.play().catch(() => {});
}

function isLoopCandidate(name: string) {
  return name.includes('call_ring_in') || name.includes('call_ring_out');
}

function toggleLoop(name: string, url: string) {
  if (loopPlaying[name]) {
    const a = loopPlayers[name];
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
    }
    loopPlayers[name] = null;
    loopPlaying[name] = false;
    return;
  }

  if (audioManager.getMuted()) return;
  const a = new Audio(url);
  a.loop = true;
  a.volume = audioManager.getVolume();
  loopPlayers[name] = a;
  loopPlaying[name] = true;
  a.play().catch(() => {
    loopPlayers[name] = null;
    loopPlaying[name] = false;
  });
}

onMounted(async () => {
  loading.value = true;
  error.value = '';
  try {
    const resp = await fetch(`${base}asset-manifest.json`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`资源清单加载失败 (${resp.status})`);
    manifest.value = await resp.json();
  } catch (e: any) {
    error.value = e?.message || '资源清单加载失败';
  } finally {
    loading.value = false;
  }
});
</script>
