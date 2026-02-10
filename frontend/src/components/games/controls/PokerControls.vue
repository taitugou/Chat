<template>
  <div class="poker-controls">
    <!-- 炸金花 / 德州扑克 -->
    <div v-if="['zhajinhua', 'texas_holdem'].includes(gameType)" class="grid grid-cols-1 gap-[1.5vh]">
      <button v-if="gameType === 'zhajinhua'" 
              class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished || mySeen || getPlayerStatus(myUserId) !== 'active'"
              @click="$emit('action', 'see')">
        看牌（看牌后下注翻倍）
      </button>

      <div class="space-y-[1.2vh]">
        <div class="flex flex-col gap-[1.2vh]">
          <input :value="betAmount" 
                 @input="$emit('update:betAmount', Number(($event.target as HTMLInputElement).value))"
                 type="number" :min="myUnitBet" class="glass-input w-full text-[2.3vh] py-[1.2vh]" placeholder="下注金额" />
          <button class="glass-btn-primary w-full py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
                  :disabled="!canAct || !betAmount || betAmount < myUnitBet"
                  @click="doBet">
            {{ betAmount > myUnitBet ? '加注' : (myUnitBet === 0 ? '过牌' : '跟注') }}（{{ betAmount }}）
          </button>
        </div>
      </div>

      <button v-if="gameType === 'zhajinhua'" class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="!canAct || !allowCompare"
              @click="$emit('openCompare')">
        比牌（{{ myUnitBet * 2 }}）
      </button>

      <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
              :disabled="!canAct"
              @click="$emit('action', 'fold')">
        弃牌
      </button>
    </div>

    <!-- 21点 -->
    <div v-else-if="gameType === 'blackjack'" class="grid grid-cols-1 gap-[1.5vh]">
      <button class="glass-btn-primary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="!canAct"
              @click="$emit('action', 'hit')">
        要牌
      </button>
      <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="!canAct"
              @click="$emit('action', 'stand')">
        停牌
      </button>
      <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="!canAct"
              @click="$emit('action', 'double')">
        加倍
      </button>
    </div>

    <!-- 牛牛 -->
    <div v-else-if="gameType === 'niuniu'" class="grid grid-cols-1 gap-[1.5vh]">
      <button class="glass-btn-primary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished"
              @click="$emit('action', 'reveal')">
        亮牌
      </button>
      <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished || String(gameState.bankerId) !== String(myUserId)"
              @click="$emit('action', 'settle')">
        庄家结算
      </button>
    </div>

    <!-- 升级 -->
    <div v-else-if="gameType === 'shengji'" class="grid grid-cols-1 gap-[1.5vh]">
      <button class="glass-btn-primary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="!canAct || selectedCardIds.length !== 1"
              @click="$emit('action', 'play', { cardId: selectedCardIds[0] })">
        出牌
      </button>
      <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished"
              @click="$emit('action', 'surrender')">
        认输
      </button>
    </div>

    <!-- 斗地主 / 跑得快 -->
    <div v-else-if="['doudizhu', 'paodekuai'].includes(gameType)" class="grid grid-cols-1 gap-[1.2vh]">
      <div v-if="gameType === 'doudizhu' && gameState.phase === 'bidding'" class="space-y-[1.2vh]">
        <div class="text-[1.9vh] text-white/50 text-center">叫分阶段</div>
        <div class="grid grid-cols-4 gap-[0.8vh]">
          <button v-for="p in [0,1,2,3]" :key="p"
                  class="glass-btn py-[1.2vh] rounded-[1vh] text-[2.1vh] font-black active:scale-95 transition-all disabled:opacity-40"
                  :disabled="!canAct"
                  @click="$emit('action', 'bid', { points: p })">
            {{ p }}
          </button>
        </div>
      </div>
      <div v-else class="space-y-[1.2vh]">
        <button class="glass-btn-primary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
                :disabled="!canAct || selectedCardIds.length === 0"
                @click="$emit('action', 'play', { cardIds: selectedCardIds })">
          出牌（{{ selectedCardIds.length }}）
        </button>
        <button class="glass-btn py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
                :disabled="!canAct"
                @click="$emit('action', 'pass')">
          过牌
        </button>
      </div>
      <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished"
              @click="$emit('action', 'surrender')">
        认输
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
  gameType: string;
  gameState: any;
  myUserId: string;
  isMyTurn: boolean;
  isFinished: boolean;
  canAct: boolean;
  // Specific
  mySeen?: boolean;
  myUnitBet?: number;
  allowCompare?: boolean;
  betAmount?: number;
  selectedCardIds?: string[];
}>();

const emit = defineEmits(['action', 'update:betAmount', 'openCompare']);

function getPlayerStatus(userId: string) {
  if (!userId) return 'unknown';
  const statusMap = props.gameState?.playerStatus || {};
  return statusMap[userId] ?? statusMap[String(userId)] ?? 'active';
}

function doBet() {
  const amount = props.betAmount || 0;
  const unit = props.myUnitBet || 0;
  
  if (amount === unit) {
    emit('action', 'call');
  } else {
    const multiplier = props.mySeen ? 2 : 1;
    const baseAmount = Math.floor(amount / multiplier);
    emit('action', 'raise', { amount: baseAmount });
  }
}
</script>
