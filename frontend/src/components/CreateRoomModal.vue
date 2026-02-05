<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" @click.self="$emit('close')">
    <div class="glass-modal w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar animate-modal-enter">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-white">创建房间</h3>
          <button @click="$emit('close')" class="text-white/40 hover:text-white transition-colors">
            <span class="text-2xl">×</span>
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium text-white/60 ml-1">房间名称</label>
              <input 
                v-model="form.name"
                type="text" 
                placeholder="2-20 个字符"
                class="glass-input w-full"
                minlength="2"
                maxlength="20"
                required
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-white/60 ml-1">选择游戏分类</label>
              <GlassSelect 
                v-model="selectedCategory"
                :options="categoryOptions"
                label-key="label"
                value-key="value"
                placeholder="请选择分类"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-white/60 ml-1">选择游戏</label>
              <GlassSelect 
                v-model="form.gameTypeId"
                :options="filteredGames"
                label-key="name"
                value-key="id"
                :placeholder="selectedCategory ? '请选择游戏类型' : '请先选择分类'"
                :disabled="!selectedCategory"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-white/60 ml-1">最大人数</label>
              <input 
                v-model.number="form.maxPlayers"
                type="number" 
                :min="selectedGame?.min_players || 2"
                :max="selectedGame?.max_players || 10"
                class="glass-input w-full"
                required
              />
              <p v-if="selectedGame" class="text-[10px] text-white/40 ml-1">
                允许范围: {{ selectedGame.min_players }}-{{ selectedGame.max_players }} 人
              </p>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-white/60 ml-1">房间密码 (可选)</label>
              <input 
                v-model="form.password"
                type="password" 
                placeholder="设置加入密码"
                class="glass-input w-full"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-white/60 ml-1">最低筹码限制</label>
              <input 
                v-model.number="form.minBet"
                type="number" 
                min="0"
                class="glass-input w-full"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-white/60 ml-1">最高筹码限制</label>
              <input 
                v-model.number="form.maxBet"
                type="number" 
                min="0"
                class="glass-input w-full"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-white/60 ml-1">加入权限</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.permission" value="public" class="w-4 h-4 accent-primary">
                <span class="text-sm text-white/90">自由加入</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.permission" value="approval" class="w-4 h-4 accent-primary">
                <span class="text-sm text-white/90">需要房主同意</span>
              </label>
            </div>
          </div>

          <div class="flex gap-4 pt-4">
            <button 
              type="button" 
              @click="$emit('close')" 
              class="glass-btn flex-1 py-3"
            >
              取消
            </button>
            <button 
              type="submit" 
              class="glass-btn-primary flex-1 py-3"
              :disabled="!isFormValid"
            >
              立即创建
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import api from '@/utils/api';
import GlassSelect from './GlassSelect.vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create', data: any): void;
}>();

const games = ref([]);
const selectedCategory = ref<string | null>(null);

const categoryMap: Record<string, string> = {
  'poker': '扑克',
  'mahjong': '麻将',
  'chess': '棋类',
  'other': '其他'
};

const form = reactive({
  name: '',
  gameTypeId: null,
  password: '',
  maxPlayers: 4,
  minBet: 0,
  maxBet: 0,
  permission: 'public',
  settings: {}
});

const isFormValid = computed(() => {
  if (!form.name || form.name.trim().length < 2 || form.name.length > 20) return false;
  if (!form.gameTypeId) return false;
  if (!selectedGame.value) return false;
  
  const playersValid = form.maxPlayers >= selectedGame.value.min_players && 
                      form.maxPlayers <= selectedGame.value.max_players;
  if (!playersValid) return false;

  if (form.minBet < 0 || form.maxBet < 0) return false;
  if (form.maxBet > 0 && form.minBet > form.maxBet) return false;

  return true;
});

const categoryOptions = computed(() => {
  const categories = games.value
    .map((game: any) => game.category)
    .filter((category: string) => !!category);
  const uniqueCategories = Array.from(new Set(categories));
  return uniqueCategories.map(cat => ({
    value: cat,
    label: categoryMap[cat] || cat
  }));
});

const filteredGames = computed(() => {
  if (!selectedCategory.value) return games.value;
  return games.value.filter((game: any) => game.category === selectedCategory.value);
});

const selectedGame = computed(() => {
  if (!form.gameTypeId) return null;
  return games.value.find((game: any) => Number(game.id) === Number(form.gameTypeId));
});

async function fetchGames() {
  try {
    const response = await api.get('/games/types');
    games.value = response.data.gameTypes || [];
    if (games.value.length > 0) {
      // 默认选择第一个游戏
      // form.gameTypeId = games.value[0].id;
    }
  } catch (error) {
    console.error('获取游戏列表失败:', error);
  }
}

watch(selectedCategory, () => {
  if (!selectedCategory.value) return;
  if (!filteredGames.value.some((game: any) => Number(game.id) === Number(form.gameTypeId))) {
    form.gameTypeId = null;
  }
});

watch(() => form.gameTypeId, (newId) => {
  if (!newId) return;
  const game = games.value.find((g: any) => Number(g.id) === Number(newId));
  if (game) {
    // 自动修正人数到合法范围
    if (form.maxPlayers < game.min_players) {
      form.maxPlayers = game.min_players;
    } else if (form.maxPlayers > game.max_players) {
      form.maxPlayers = game.max_players;
    }
  }
});

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('create', { ...form });
}

onMounted(() => {
  fetchGames();
});
</script>

<style scoped>
.glass-modal {
  max-width: 90vw;
}
</style>
