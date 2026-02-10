<template>
  <div class="flex-1 flex flex-col overflow-auto h-full">
    <div class="flex items-center justify-between">
      <div class="text-[2.2vh] text-white/40">
        {{ isCardSelectPlayGame || isShengjiGame ? '选择出牌' : '你的底牌' }}
      </div>
      <div class="flex items-center gap-[3vw]">
        <div v-if="['zhajinhua', 'texas_holdem'].includes(gameType)" class="flex flex-col items-end">
          <div class="text-[1.8vh] text-white/30 uppercase tracking-tighter">你的最低下注</div>
          <div class="text-[2.6vh] font-bold text-green-400">{{ myUnitBet }}</div>
        </div>
        <div class="flex flex-col items-end">
          <div class="text-[1.8vh] text-white/30 uppercase tracking-tighter">当前总筹码</div>
          <div class="text-[3.8vh] font-black text-yellow-400 flex items-center gap-[0.5vw]">
            <span class="text-[2.6vh]">💰</span> {{ pot }}
          </div>
        </div>
      </div>
    </div>

    <div class="mt-[2vh] flex-1 flex flex-col items-center justify-center gap-[4vh]">
      <!-- Blackjack Dealer Hand -->
      <div v-if="gameType === 'blackjack' && Array.isArray(gameState.dealerHand) && gameState.dealerHand.length" class="flex flex-col items-center gap-[1vh]">
        <div class="text-[1.8vh] text-white/30 uppercase tracking-widest">庄家</div>
        <transition-group name="deal" tag="div" class="flex gap-[1.5vw]">
          <PokerCard
            v-for="(card, idx) in gameState.dealerHand"
            :key="'dealer-'+idx"
            :suit="String(card.rank) === 'HIDDEN' ? '♠' : card.suit"
            :value="String(card.rank) === 'HIDDEN' ? 'A' : card.rank"
            :is-flipped="String(card.rank) === 'HIDDEN'"
            size="md"
          />
        </transition-group>
      </div>

      <!-- Texas Community Cards -->
      <div v-if="gameType === 'texas_holdem' && gameState.communityCards?.length > 0" class="flex flex-col items-center gap-[1vh]">
        <div class="text-[1.8vh] text-white/30 uppercase tracking-widest">公共牌</div>
        <transition-group name="deal" tag="div" class="flex gap-[1.5vw]">
          <PokerCard
            v-for="(card, idx) in gameState.communityCards"
            :key="'comm-'+idx"
            :suit="card.suit"
            :value="card.rank"
            size="md"
          />
          <div v-for="n in (5 - gameState.communityCards.length)" :key="'empty-'+n"
               class="w-[8vh] h-[12vh] border border-white/5 bg-white/5 rounded-[1vh] flex items-center justify-center text-white/10 text-[4vh]">
            ?
          </div>
        </transition-group>
      </div>

      <!-- Player Hand -->
      <div class="flex flex-col items-center gap-[1vh]">
        <div v-if="gameType === 'texas_holdem'" class="text-[1.8vh] text-white/30 uppercase tracking-widest">你的手牌</div>
        <div v-else-if="isCardSelectPlayGame" class="text-[1.8vh] text-white/30 uppercase tracking-widest">
          {{ gameType === 'doudizhu' ? '手牌（多选）' : '手牌（多选）' }}
        </div>
        <div v-else-if="isShengjiGame" class="text-[1.8vh] text-white/30 uppercase tracking-widest">
          手牌（单选）
        </div>

        <div v-if="displayHand.length > 0">
          <div class="flex justify-center mb-[1vh] gap-[1vh]" v-if="isCardSelectPlayGame || isShengjiGame">
             <button class="text-[1.8vh] text-white/50 hover:text-white bg-black/20 px-[1vh] rounded" @click="sortHand('rank')">按点数排序</button>
             <button class="text-[1.8vh] text-white/50 hover:text-white bg-black/20 px-[1vh] rounded" @click="sortHand('suit')">按花色排序</button>
          </div>
          <transition-group name="deal" tag="div" class="flex flex-wrap justify-center gap-[2vw]">
            <div
              v-for="(card, idx) in sortedDisplayHand"
              :key="card.id || idx"
              class="rounded-[1.2vh] border border-transparent transition-all duration-300"
              :class="selectedCardIds.includes(String(card.id)) ? 'border-primary/50 ring-2 ring-primary/50 -translate-y-[2vh]' : ''"
            >
              <PokerCard
                :suit="card.suit"
                :value="card.rank"
                :is-flipped="shouldHideMyHand"
                size="lg"
                :clickable="isCardSelectPlayGame || isShengjiGame"
                @click="toggleCardSelection(card.id)"
              />
            </div>
          </transition-group>
        </div>
        <div v-else class="text-center text-white/30">
          <div v-if="gameType === 'zhajinhua'" class="flex gap-[2.5vw] justify-center">
            <PokerCard v-for="n in 3" :key="n" :is-flipped="true" size="lg" />
          </div>
          <template v-else>
            <div class="text-[8vh]">🃏</div>
            <div class="mt-[1vh] text-[2.2vh]">等待发牌...</div>
          </template>
        </div>
      </div>
    </div>

    <!-- Last Play Info -->
    <div v-if="isCardSelectPlayGame" class="mt-[2vh] rounded-[1.5vh] border border-white/10 bg-black/30 p-[1.5vh] text-[2.1vh] text-white/70">
      <div v-if="gameState.lastPlay?.play">
        上一手：{{ getPlayerNickname(gameState.lastPlay.playerId) }} · {{ gameState.lastPlay.play.type }} · 主 {{ gameState.lastPlay.play.main }}
      </div>
      <div v-else class="text-white/40">当前无上一手</div>
    </div>

    <!-- Shengji Info -->
    <div v-if="isShengjiGame" class="mt-[2vh] rounded-[1.5vh] border border-white/10 bg-black/30 p-[1.5vh] text-[2.1vh] text-white/70">
      主牌：{{ gameState.trumpSuit }} / {{ gameState.trumpRank }} · TeamA {{ gameState.teamPoints?.A || 0 }} · TeamB {{ gameState.teamPoints?.B || 0 }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed, watch, ref } from 'vue';
import PokerCard from '@/components/PokerCard.vue';
import { audioManager } from '@/utils/audio';

const props = defineProps<{
  gameType: string;
  gameState: any;
  myUserId: string;
  isFinished: boolean;
  pot: number;
  myUnitBet: number;
  displayHand: any[];
  shouldHideMyHand: boolean;
  selectedCardIds: string[];
  players: any[];
}>();

// Sound Effects
watch(() => props.displayHand.length, (newVal, oldVal) => {
  if (newVal > oldVal) {
    audioManager.play('game_card');
  }
});

watch(() => props.pot, (newVal, oldVal) => {
  if (newVal > oldVal) {
    audioManager.play('game_chip');
  }
});

watch(() => props.gameState?.dealerHand?.length, (newVal, oldVal) => {
  if (newVal > oldVal) {
    audioManager.play('game_card');
  }
});

watch(() => props.gameState?.communityCards?.length, (newVal, oldVal) => {
  if (newVal > oldVal) {
    audioManager.play('game_deal');
  }
});

const emit = defineEmits(['update:selectedCardIds']);

const sortMode = ref<'rank' | 'suit'>('rank');

const sortedDisplayHand = computed(() => {
  if (!props.displayHand) return [];
  const list = [...props.displayHand];
  const rankVal = (r: string) => {
    if (r === 'A') return 14;
    if (r === 'K') return 13;
    if (r === 'Q') return 12;
    if (r === 'J') return 11;
    if (r === '10') return 10;
    return Number(r) || 0;
  };
  const suitVal = (s: string) => {
    if (s === '♠') return 4;
    if (s === '♥') return 3;
    if (s === '♣') return 2;
    if (s === '♦') return 1;
    return 0;
  };

  list.sort((a, b) => {
    if (sortMode.value === 'rank') {
      const rd = rankVal(b.rank) - rankVal(a.rank);
      if (rd !== 0) return rd;
      return suitVal(b.suit) - suitVal(a.suit);
    } else {
      const sd = suitVal(b.suit) - suitVal(a.suit);
      if (sd !== 0) return sd;
      return rankVal(b.rank) - rankVal(a.rank);
    }
  });
  return list;
});

function sortHand(mode: 'rank' | 'suit') {
  sortMode.value = mode;
}

const isCardSelectPlayGame = computed(() => ['doudizhu', 'paodekuai'].includes(props.gameType));
const isShengjiGame = computed(() => props.gameType === 'shengji');

function toggleCardSelection(cardId: any) {
  const id = String(cardId || '');
  if (!id) return;
  
  if (isShengjiGame.value) {
    // Single select
    const newIds = props.selectedCardIds[0] === id ? [] : [id];
    emit('update:selectedCardIds', newIds);
    return;
  }
  
  if (!isCardSelectPlayGame.value) return;
  
  // Multi select
  let newIds = [...props.selectedCardIds];
  if (newIds.includes(id)) {
    newIds = newIds.filter(x => x !== id);
  } else {
    newIds.push(id);
  }
  emit('update:selectedCardIds', newIds);
}

function getPlayerNickname(userId: number | string) {
  if (!userId) return '未知';
  const p = props.players.find(p => String(p.user_id || p.id) === String(userId));
  if (p) return p.nickname || p.username || `用户${userId}`;
  return `用户${userId}`;
}
</script>

<style scoped>
.deal-enter-active {
  transition: all 0.5s ease-out;
}
.deal-leave-active {
  transition: all 0.3s ease-in;
  position: absolute; /* 让离开的元素不占据空间，实现平滑移除 */
}
.deal-enter-from {
  opacity: 0;
  transform: translateY(-50vh) scale(0.5); /* 从上方远处飞入 */
}
.deal-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
.deal-move {
  transition: transform 0.5s ease; /* 让列表其他元素平滑移动填补空缺 */
}
</style>
