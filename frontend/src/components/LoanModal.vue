<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" @click.self="$emit('close')">
    <div class="glass-modal w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar animate-modal-enter">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-white">申请筹码借贷</h3>
          <button @click="$emit('close')" class="text-white/40 hover:text-white transition-colors">
            <span class="text-2xl">×</span>
          </button>
        </div>

        <div class="mb-6 p-4 glass-card-content space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-white/60">当前余额</span>
            <span class="text-white font-bold">{{ userInfo?.chips || 0 }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-white/60">当前欠款</span>
            <span class="text-red-400 font-bold">{{ userInfo?.debt || 0 }}</span>
          </div>
          <div class="border-t border-white/5 my-1 pt-1"></div>
          <div class="flex justify-between items-center">
            <span class="text-white/60">当前额度</span>
            <span class="text-primary font-bold">{{ maxLoan }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-white/60">可用额度</span>
            <span class="text-green-400 font-bold">{{ availableLoan }}</span>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div class="space-y-2">
            <label class="text-sm font-medium text-white/60 ml-1">借贷金额</label>
            <div class="grid grid-cols-3 gap-2">
              <button 
                v-for="amount in quickAmounts" 
                :key="amount"
                type="button"
                @click="selectedAmount = amount"
                class="glass-btn py-2 text-sm"
                :class="{ 'bg-primary/40 border-primary/60': selectedAmount === amount }"
              >
                {{ amount }}
              </button>
            </div>
            <div class="relative mt-2">
              <input 
                v-model.number="selectedAmount"
                type="number" 
                placeholder="或者输入自定义金额"
                class="glass-input w-full pr-12"
                min="100"
                step="100"
              />
              <span class="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">筹码</span>
            </div>
          </div>

          <div class="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p class="text-xs text-yellow-200/80 leading-relaxed">
              提示：借贷的筹码将在后续通过游戏盈利或每日签到自动偿还。借贷额度受信用等级影响。
            </p>
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
              :disabled="!selectedAmount || selectedAmount < 100"
            >
              申请借贷
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  userInfo?: any;
}>();

const maxLoan = computed(() => (props.userInfo?.follower_count || 0) * 1000);
const availableLoan = computed(() => Math.max(0, maxLoan.value - (props.userInfo?.total_active_amount || 0)));

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'loan', amount: number): void;
}>();

const quickAmounts = [1000, 5000, 10000];
const selectedAmount = ref<number | null>(null);

function handleSubmit() {
  if (selectedAmount.value && selectedAmount.value >= 100) {
    emit('loan', selectedAmount.value);
  }
}
</script>

<style scoped>
.glass-modal {
  max-width: 90vw;
}
</style>
