<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-[4vh]">
    <div class="text-[2.2vh] text-white/50">阶段：{{ gameState.phase || '-' }}</div>
    
    <!-- 骰子区域 -->
    <div class="flex items-center gap-[3vw] h-[15vh]">
      <template v-if="gameState.dice || gameState.rolled">
        <!-- 骰宝显示3个骰子 -->
        <template v-if="gameType === 'sic_bo'">
          <Dice3D v-for="(d, i) in (gameState.dice || [1,1,1])" :key="'d-'+i" 
                  :value="d" 
                  :rolling="isRolling" />
        </template>
        <!-- 二八杠显示2个骰子 -->
        <template v-else-if="gameType === 'erbaban'">
           <Dice3D v-for="(d, i) in (myRolledDice || [1,1])" :key="'ed-'+i"
                   :value="d"
                   :rolling="isRolling" />
        </template>
      </template>
      <div v-else class="text-[2vh] text-white/30">等待开奖...</div>
    </div>

    <!-- 结果显示 -->
    <div v-if="gameState.outcome" class="text-[3vh] font-black text-yellow-300 animate-bounce">
      结果：{{ gameState.outcome }}
    </div>

    <!-- 信息面板 -->
    <div class="rounded-[1.5vh] border border-white/10 bg-black/30 px-[3vh] py-[2vh] text-[2.2vh] text-white/70 min-w-[30vw] text-center">
      <div v-if="gameType === 'sic_bo'">
        你的下注：{{ gameState.playerSelections?.[myUserId] || '-' }} · {{ gameState.playerBets?.[myUserId] || 0 }}
      </div>
      <div v-else-if="gameType === 'erbaban'">
        已掷骰：{{ Object.values(gameState.rolled || {}).filter(Boolean).length }}/{{ players.length }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed, ref, watch } from 'vue';
import Dice3D from '../dice/Dice3D.vue';
import { audioManager } from '@/utils/audio';

const props = defineProps<{
  gameType: string;
  gameState: any;
  myUserId: string;
  players: any[];
}>();

const isRolling = ref(false);

const myRolledDice = computed(() => {
  if (props.gameType !== 'erbaban') return [];
  return props.gameState.rolled?.[props.myUserId] || [1, 1];
});

// 监听开奖或掷骰事件触发动画
watch(() => props.gameState.dice, (newVal, oldVal) => {
  if (newVal && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    triggerRoll();
  }
});

watch(() => props.gameState.rolled?.[props.myUserId], (newVal, oldVal) => {
  if (newVal && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    triggerRoll();
  }
});

function triggerRoll() {
  isRolling.value = true;
  audioManager.play('game_chip'); // 借用音效，实际应用 dice_roll
  setTimeout(() => {
    isRolling.value = false;
  }, 800);
}
</script>
