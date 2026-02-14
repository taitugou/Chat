<template>
  <div class="flex-1 flex flex-col overflow-auto h-full">
    <div class="flex items-center justify-between">
      <div class="text-[2.2vh] text-ios-label-tertiary">你的手牌</div>
      <div class="text-[1.8vh] text-ios-label-tertiary">
        剩余牌墙 {{ gameState.wallCount ?? '-' }} · 回合 {{ gameState.turnCount ?? 0 }}/{{ gameState.maxTurns ?? '-' }}
      </div>
    </div>

    <!-- 弃牌区动画 -->
    <div class="mt-[1.5vh] h-[8vh] relative">
      <transition name="discard-pop">
        <div v-if="gameState.lastDiscard" :key="gameState.lastDiscard.tile.id" 
             class="absolute inset-0 rounded-[1.2vh] border border-ios-separator bg-black/30 p-[1.2vh] flex items-center justify-between">
          <div class="text-[2vh] text-ios-label-tertiary">上一张弃牌（{{ getPlayerNickname(gameState.lastDiscard.playerId) }}）</div>
          <MahjongTile :tile="gameState.lastDiscard.tile" />
        </div>
      </transition>
    </div>

    <!-- 手牌区动画 -->
    <div class="mt-[2vh]">
      <transition-group name="tile-list" tag="div" class="flex flex-wrap gap-[1vh]">
        <div v-for="t in displayHand" :key="t.id" class="transition-all duration-300">
          <MahjongTile
            :tile="t"
            :selected="selectedTileIds.includes(String(t.id))"
            @click="toggleTileSelection(t.id)"
          />
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, watch } from 'vue';
import MahjongTile from '@/components/MahjongTile.vue';
import { audioManager } from '@/utils/audio';

const props = defineProps<{
  gameState: any;
  myUserId: string;
  displayHand: any[];
  selectedTileIds: string[];
  players: any[];
}>();

// Sound Effects
watch(() => props.gameState.lastDiscard, (newVal) => {
  if (newVal) {
    audioManager.play('game_card');
  }
});

watch(() => props.displayHand.length, (newVal, oldVal) => {
  if (newVal > oldVal) {
    // 摸牌
    audioManager.play('game_card');
  }
});

const emit = defineEmits(['update:selectedTileIds']);

function getPlayerNickname(userId: number | string) {
  if (!userId) return '未知';
  const p = props.players.find(p => String(p.user_id || p.id) === String(userId));
  if (p) return p.nickname || p.username || `用户${userId}`;
  return `用户${userId}`;
}

function toggleTileSelection(tileId: any) {
  const id = String(tileId || '');
  if (!id) return;
  
  let newIds = [...props.selectedTileIds];
  if (newIds.includes(id)) newIds = newIds.filter(x => x !== id);
  else newIds.push(id);
  
  emit('update:selectedTileIds', newIds);
}
</script>

<style scoped>
/* 弃牌弹出效果 */
.discard-pop-enter-active {
  animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.discard-pop-leave-active {
  transition: opacity 0.2s;
}
.discard-pop-leave-to {
  opacity: 0;
}

@keyframes pop-in {
  0% { opacity: 0; transform: scale(0.5) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* 手牌列表动画 */
.tile-list-enter-active,
.tile-list-leave-active {
  transition: all 0.4s ease;
}
.tile-list-enter-from,
.tile-list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
.tile-list-move {
  transition: transform 0.4s ease;
}
</style>
