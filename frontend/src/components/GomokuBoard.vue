<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  board: number[][];
  currentPlayerId: string | number;
  myUserId: string | number;
  gameOver: boolean;
}>();

const emit = defineEmits<{
  (e: 'move', x: number, y: number): void;
}>();

const boardSize = 15;

const handleClick = (x: number, y: number) => {
  if (props.gameOver) return;
  if (String(props.currentPlayerId) !== String(props.myUserId)) return;
  if (props.board[y][x] !== 0) return;
  emit('move', x, y);
};

const isMyTurn = computed(() => String(props.currentPlayerId) === String(props.myUserId));
</script>

<template>
  <div class="flex flex-col items-center select-none">
    <div 
      class="relative bg-[#dcb35c] p-2 rounded shadow-2xl border-4 border-[#8b4513]"
      :class="{ 'ring-4 ring-yellow-400': isMyTurn && !gameOver }"
    >
      <!-- Grid Lines -->
      <div 
        class="grid" 
        :style="{ 
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          width: 'min(70vw, 70vh)',
          height: 'min(70vw, 70vh)'
        }"
      >
        <div 
          v-for="(_, i) in boardSize * boardSize" 
          :key="i"
          class="relative border border-black/20 flex items-center justify-center cursor-pointer hover:bg-black/5"
          @click="handleClick(i % boardSize, Math.floor(i / boardSize))"
        >
          <!-- The Piece -->
          <div 
            v-if="board[Math.floor(i / boardSize)][i % boardSize] !== 0"
            class="w-[80%] h-[80%] rounded-full shadow-md transition-all duration-200"
            :class="{
              'bg-black': board[Math.floor(i / boardSize)][i % boardSize] === 1,
              'bg-white': board[Math.floor(i / boardSize)][i % boardSize] === 2
            }"
          ></div>
          
          <!-- Hover indicator -->
          <div 
            v-else-if="isMyTurn && !gameOver"
            class="w-[40%] h-[40%] rounded-full bg-white/30 opacity-0 hover:opacity-100 transition-opacity"
          ></div>
        </div>
      </div>
      
      <!-- Coordinate dots (standard Gomoku board) -->
      <div class="absolute inset-0 pointer-events-none">
          <!-- Add 5 dots at standard positions if needed -->
      </div>
    </div>
    
    <div class="mt-4 text-white text-[2vh] font-bold px-4 py-2 bg-black/40 rounded-full backdrop-blur-md">
      <template v-if="gameOver">游戏结束</template>
      <template v-else-if="isMyTurn">该你落子了 ({{ board[0][0] === 0 ? '黑棋' : '白棋' }})</template>
      <template v-else>等待对方落子...</template>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
}
</style>
