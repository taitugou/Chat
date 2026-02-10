<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-[2vh] h-full">
    <!-- Gomoku -->
    <div v-if="gameType === 'wuziqi'" class="flex-1 flex items-center justify-center">
      <GomokuBoard 
        :board="gameState.board || Array(15).fill(0).map(() => Array(15).fill(0))"
        :current-player-id="gameState.currentPlayer"
        :my-user-id="myUserId"
        :game-over="isFinished"
        @move="(x, y) => $emit('action', 'move', { x, y })"
      />
    </div>

    <!-- Move Games (Xiangqi/Junqi) -->
    <div v-else-if="isBoardMoveGame" class="flex-1 flex flex-col items-center justify-center gap-[2vh]">
      <div class="flex flex-wrap items-center justify-center gap-[1vw] text-[2vh] text-white/50">
        <div v-if="selectedFrom" class="px-[1vw] py-[0.6vh] rounded-full border border-primary/30 bg-primary/10">
          已选起点：({{ selectedFrom.x }},{{ selectedFrom.y }})
        </div>
        <div v-else class="px-[1vw] py-[0.6vh] rounded-full border border-white/10 bg-white/5">
          点击选择起点，再点击目标格
        </div>
      </div>
      <BoardGrid
        :board="boardDisplay"
        :cols="boardCols"
        :rows="boardRows"
        :cell-size="boardCellSize"
        :selected="selectedFrom"
        @cell-click="handleBoardCellClick"
      >
        <template #cell="{ value }">
          <transition name="chess-piece" mode="out-in">
             <span :key="value" class="text-[2.4vh] font-black inline-block" :class="boardCellClass(value)">{{ boardCellLabel(value) }}</span>
          </transition>
        </template>
      </BoardGrid>
    </div>

    <!-- Weiqi -->
    <div v-else-if="gameType === 'weiqi'" class="flex-1 flex flex-col items-center justify-center gap-[2vh]">
      <div class="flex flex-wrap items-center justify-center gap-[1vw] text-[2vh] text-white/50">
        <div class="px-[1vw] py-[0.6vh] rounded-full border border-white/10 bg-white/5">
          黑提子 {{ gameState.captureCount?.black || 0 }} · 白提子 {{ gameState.captureCount?.white || 0 }} · 贴目 {{ gameState.komi ?? 6.5 }}
        </div>
        <div class="px-[1vw] py-[0.6vh] rounded-full border border-white/10 bg-white/5">
          连续 pass：{{ gameState.passCount || 0 }}
        </div>
      </div>
      <BoardGrid
        :board="gameState.board || []"
        :cols="boardCols"
        :rows="boardRows"
        cell-size="2.4vh"
        @cell-click="handleWeiqiCellClick"
      >
        <template #cell="{ value }">
          <transition name="stone-pop">
            <div v-if="value === 1" class="w-[1.8vh] h-[1.8vh] rounded-full bg-black border border-white/20 shadow-lg"></div>
            <div v-else-if="value === 2" class="w-[1.8vh] h-[1.8vh] rounded-full bg-white border border-black/30 shadow-lg"></div>
          </transition>
        </template>
      </BoardGrid>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed, watch } from 'vue';
import GomokuBoard from '@/components/GomokuBoard.vue';
import BoardGrid from '@/components/BoardGrid.vue';
import { audioManager } from '@/utils/audio';

const props = defineProps<{
  gameType: string;
  gameState: any;
  myUserId: string;
  isFinished: boolean;
  canAct: boolean;
  selectedFrom: {x:number, y:number} | null;
}>();

// Sound Effects
watch(() => props.gameState.currentPlayer, (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    // 轮到某人，通常意味着上一个人落子了
    audioManager.play('game_turn');
  }
});

// 监听棋盘变化
watch(() => JSON.stringify(props.gameState.board), (newVal, oldVal) => {
  if (newVal !== oldVal) {
    // 棋子移动/落子
    audioManager.play('ui_click'); 
  }
});

const emit = defineEmits(['action', 'update:selectedFrom']);

const isXiangqiGame = computed(() => props.gameType === 'xiangqi');
const isInternationalChessGame = computed(() => props.gameType === 'international_chess');
const isJunqiGame = computed(() => props.gameType === 'junqi');
const isBoardMoveGame = computed(() => isXiangqiGame.value || isInternationalChessGame.value || isJunqiGame.value);

const boardCols = computed(() => Number(props.gameState?.boardW || (isXiangqiGame.value ? 9 : isJunqiGame.value ? 5 : 8)));
const boardRows = computed(() => Number(props.gameState?.boardH || (isXiangqiGame.value ? 10 : isJunqiGame.value ? 12 : 8)));

const boardCellSize = computed(() => {
  if (isXiangqiGame.value) return '4.9vh';
  if (isInternationalChessGame.value) return '5.4vh';
  if (isJunqiGame.value) return '4.4vh';
  return '5.2vh';
});

const boardDisplay = computed(() => {
  const b = props.gameState?.board;
  if (!Array.isArray(b)) return [];
  if (!isJunqiGame.value) return b;
  const me = String(props.myUserId || '');
  const myColor = String(props.gameState?.redId) === me ? 'red' : String(props.gameState?.blackId) === me ? 'black' : null;
  return b.map((row: any[]) =>
    (row || []).map((cell: any) => {
      if (!cell) return null;
      if (!myColor) return cell;
      const s = String(cell);
      const isRed = s === s.toUpperCase() || s.startsWith('R');
      const isMine = myColor === 'red' ? isRed : !isRed;
      if (!isMine) return '?';
      return cell;
    })
  );
});

function boardCellLabel(value: any) {
  if (!value) return '';
  if (value === '?') return '?';
  if (isXiangqiGame.value) {
    const p = String(value);
    const isRed = p === p.toUpperCase();
    const lower = p.toLowerCase();
    const mapRed: Record<string, string> = { r: '车', n: '马', b: '相', a: '仕', k: '帅', c: '炮', p: '兵' };
    const mapBlack: Record<string, string> = { r: '车', n: '马', b: '象', a: '士', k: '将', c: '炮', p: '卒' };
    return isRed ? (mapRed[lower] || p) : (mapBlack[lower] || p);
  }
  if (isInternationalChessGame.value) {
    const p = String(value);
    const isWhite = p === p.toUpperCase();
    const lower = p.toLowerCase();
    const w: Record<string, string> = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
    const b: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    return isWhite ? (w[lower] || p) : (b[lower] || p);
  }
  if (isJunqiGame.value) {
    const p = String(value);
    const lower = p.toLowerCase();
    if (lower === 'f') return '旗';
    if (lower === 'm') return '雷';
    if (lower === 'b') return '炸';
    if (lower === 'e') return '工';
    if (lower.length === 2 && lower[0] === 'r' && /^[2-9]$/.test(lower[1])) return lower[1];
    return p;
  }
  return String(value);
}

function boardCellClass(value: any) {
  if (!value) return 'text-white/20';
  if (value === '?') return 'text-white/50';
  const s = String(value);
  if (isXiangqiGame.value) return s === s.toUpperCase() ? 'text-red-300' : 'text-white/90';
  if (isInternationalChessGame.value) return s === s.toUpperCase() ? 'text-white' : 'text-white/90';
  if (isJunqiGame.value) {
    const isRed = s === s.toUpperCase() || s.startsWith('R');
    return isRed ? 'text-red-300' : 'text-white/90';
  }
  return 'text-white';
}

function handleBoardCellClick(payload: { x: number; y: number }) {
  if (props.isFinished) return;
  if (!props.canAct) return;
  if (!props.selectedFrom) {
    emit('update:selectedFrom', { x: payload.x, y: payload.y });
    return;
  }
  const from = props.selectedFrom;
  const to = { x: payload.x, y: payload.y };
  emit('update:selectedFrom', null);
  emit('action', 'move', { from, to });
}

function handleWeiqiCellClick(payload: { x: number; y: number }) {
  if (props.isFinished) return;
  if (!props.canAct) return;
  emit('action', 'place', { x: payload.x, y: payload.y });
}
</script>

<style scoped>
/* 棋子移动/更替动画 */
.chess-piece-enter-active,
.chess-piece-leave-active {
  transition: all 0.3s ease;
}
.chess-piece-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.chess-piece-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

/* 围棋落子动画 */
.stone-pop-enter-active {
  animation: stone-drop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes stone-drop {
  0% { transform: scale(3); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
