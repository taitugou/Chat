<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" @click.self="$emit('close')">
    <div class="glass-modal w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar animate-modal-enter">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-white">加入房间</h3>
          <button @click="$emit('close')" class="text-white/40 hover:text-white transition-colors">
            <span class="text-2xl">×</span>
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div class="space-y-2">
            <label class="text-sm font-medium text-white/60 ml-1">房间代码</label>
            <input 
              v-model="form.roomCode"
              type="text" 
              placeholder="请输入6位房间代码"
              maxlength="6"
              class="glass-input w-full uppercase"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-white/60 ml-1">房间密码 (可选)</label>
            <input 
              v-model="form.password"
              type="password" 
              placeholder="如果房间有密码请输入"
              class="glass-input w-full"
            />
          </div>

          <div class="flex gap-4 pt-2">
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
              :disabled="!form.roomCode"
            >
              加入
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'join', data: { roomCode: string; password?: string }): void;
}>();

const form = reactive({
  roomCode: '',
  password: ''
});

function handleSubmit() {
  if (!form.roomCode) return;
  emit('join', {
    roomCode: form.roomCode.toUpperCase(),
    password: form.password || undefined
  });
}
</script>

<style scoped>
.glass-modal {
  max-width: 90vw;
}
</style>
