<template>
  <div class="chess-controls">
    <!-- Weiqi -->
    <div v-if="gameType === 'weiqi'" class="grid grid-cols-1 gap-[1.5vh]">
      <div class="text-[1.9vh] text-ios-label-tertiary text-center">点击棋盘落子</div>
      <button class="ios-btn-primary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished || !canAct"
              @click="$emit('action', 'pass')">
        过一手
      </button>
      <button class="ios-btn-secondary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished"
              @click="$emit('action', 'settle')">
        数子结算
      </button>
      <button class="ios-btn-secondary w-full px-[2.6vh] py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished"
              @click="$emit('action', 'surrender')">
        认输
      </button>
    </div>

    <!-- Board Move Games (Xiangqi, Junqi, etc) -->
    <div v-else-if="isBoardMoveGame" class="grid grid-cols-1 gap-[1.5vh]">
      <div v-if="isJunqiGame && gameState.phase === 'setup' && !junqiMyReady" class="space-y-[1.2vh]">
        <div class="text-[1.9vh] text-ios-label-tertiary text-center">布阵阶段：点击“自动布阵”后进入对局</div>
        <div class="flex gap-[0.8vh] items-center">
          <div class="text-[1.8vh] text-ios-label-tertiary whitespace-nowrap">种子</div>
          <input :value="junqiAutoSetupSeed" 
                 @input="$emit('update:junqiAutoSetupSeed', Number(($event.target as HTMLInputElement).value))"
                 type="number" min="1" class="ios-input flex-1 py-[0.8vh] text-[2.1vh]" />
        </div>
        <button class="ios-btn-primary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all"
                @click="junqiAutoSetup">
          自动布阵
        </button>
      </div>
      <div v-else class="space-y-[1.2vh]">
        <div class="text-[1.9vh] text-ios-label-tertiary text-center">点击棋盘选择起点，再点终点移动</div>
        <button class="ios-btn-secondary w-full px-[2.6vh] py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
                :disabled="isFinished"
                @click="$emit('action', 'surrender')">
          认输
        </button>
      </div>
    </div>

    <!-- Wuziqi -->
    <div v-else-if="gameType === 'wuziqi'" class="grid grid-cols-1 gap-[1.5vh]">
       <button class="ios-btn-secondary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished"
              @click="$emit('action', 'surrender')">
        投降
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed } from 'vue';

const props = defineProps<{
  gameType: string;
  gameState: any;
  myUserId: string;
  isFinished: boolean;
  canAct: boolean;
  selectedFrom: {x:number, y:number} | null;
  junqiAutoSetupSeed?: number;
}>();

const emit = defineEmits(['action', 'update:junqiAutoSetupSeed']);

const isXiangqiGame = computed(() => props.gameType === 'xiangqi');
const isInternationalChessGame = computed(() => props.gameType === 'international_chess');
const isJunqiGame = computed(() => props.gameType === 'junqi');
const isBoardMoveGame = computed(() => isXiangqiGame.value || isInternationalChessGame.value || isJunqiGame.value);

const junqiMyReady = computed(() => {
  if (!isJunqiGame.value) return true;
  const r = props.gameState?.ready || {};
  const me = String(props.myUserId || '');
  if (String(props.gameState?.redId) === me) return !!r.red;
  if (String(props.gameState?.blackId) === me) return !!r.black;
  return true;
});

function junqiAutoSetup() {
  const me = String(props.myUserId || '');
  const isRed = String(props.gameState?.redId) === me;
  const isBlack = String(props.gameState?.blackId) === me;
  if (!isRed && !isBlack) return;
  const pieces = ['F', 'B', 'B', 'M', 'M', 'M', 'E', '9', '8', '7', '6', '5', '4', '3', '2'];
  const w = 5;
  const h = 12;
  const yMin = isRed ? 6 : 0;
  const yMax = isRed ? 11 : 5;
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = yMin; y <= yMax; y++) for (let x = 0; x < w; x++) cells.push({ x, y });

  let seed = Math.max(1, Number(props.junqiAutoSetupSeed || 1));
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const placements = pieces.map((p, i) => ({ x: cells[i].x, y: cells[i].y, piece: p }));
  emit('action', 'setup', { placements });
}
</script>
