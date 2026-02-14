<template>
  <div class="mahjong-controls grid grid-cols-1 gap-[1.2vh]">
    <div v-if="lastDiscard" class="rounded-[1vh] bg-ios-systemGray5 px-[1vw] py-[1vh] text-[2.1vh] text-ios-label-secondary">
      上一张弃牌：{{ mahjongTileText(lastDiscard.tile) }}（{{ getPlayerNickname(lastDiscard.playerId) }}）
    </div>

    <div class="grid grid-cols-2 gap-[1vh]">
      <button class="ios-btn-primary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="!canAct || selectedTileIds.length !== 1"
              @click="$emit('action', 'discard', { tileId: selectedTileIds[0] })">
        弃牌
      </button>
      <button class="ios-btn-secondary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="!canAct"
              @click="$emit('action', 'hu')">
        自摸胡
      </button>
    </div>

    <div class="grid grid-cols-2 gap-[1vh]">
      <button class="ios-btn-secondary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished || !lastDiscard || String(lastDiscard.playerId) === String(myUserId)"
              @click="$emit('action', 'ron')">
        点炮胡
      </button>
      <button class="ios-btn-secondary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished || !canMahjongPeng"
              @click="$emit('action', 'peng', { useTileIds: mahjongAutoPengIds })">
        碰
      </button>
      <button class="ios-btn-secondary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished || !canMahjongChi"
              @click="$emit('action', 'chi', { useTileIds: mahjongAutoChiIds })">
        吃
      </button>
      <button class="ios-btn-secondary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished || !canMahjongGang"
              @click="$emit('action', 'gang', { useTileIds: mahjongAutoGangIds })">
        杠
      </button>
    </div>

    <div class="grid grid-cols-2 gap-[1vh]">
      <button class="ios-btn-secondary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished"
              @click="$emit('clearSelection')">
        清空选中
      </button>
      <button class="ios-btn-secondary py-[1.6vh] rounded-[1.2vh] font-black text-[2.2vh] active:scale-95 transition-all disabled:opacity-40"
              :disabled="isFinished"
              @click="$emit('action', 'settle')">
        强制结算
      </button>
    </div>

    <button class="ios-btn-secondary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
            :disabled="isFinished"
            @click="$emit('action', 'surrender')">
      认输
    </button>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed } from 'vue';

const props = defineProps<{
  gameState: any;
  myUserId: string;
  isFinished: boolean;
  canAct: boolean;
  selectedTileIds: string[];
  hand: any[];
  players: any[];
}>();

const emit = defineEmits(['action', 'clearSelection']);

const lastDiscard = computed(() => props.gameState?.lastDiscard);
const lastDiscardTile = computed(() => lastDiscard.value?.tile);
const lastDiscardFrom = computed(() => lastDiscard.value?.playerId);

function getPlayerNickname(userId: number | string) {
  if (!userId) return '未知';
  const p = props.players.find(p => String(p.user_id || p.id) === String(userId));
  if (p) return p.nickname || p.username || `用户${userId}`;
  return `用户${userId}`;
}

function mahjongTileText(tile: any) {
  if (!tile) return '';
  const suit = String(tile.suit);
  const rank = Number(tile.rank);
  if (suit === 'm') return `${rank}万`;
  if (suit === 'p') return `${rank}筒`;
  if (suit === 's') return `${rank}条`;
  if (suit === 'z') {
    const map: Record<number, string> = { 1: '东', 2: '南', 3: '西', 4: '北', 5: '中', 6: '发', 7: '白' };
    return map[rank] || `字${rank}`;
  }
  return `${suit}${tile.rank}`;
}

const sameTileIds = computed(() => {
  const d = lastDiscardTile.value;
  if (!d) return [];
  if (String(lastDiscardFrom.value) === String(props.myUserId)) return [];
  return props.hand.filter((t: any) => String(t.suit) === String(d.suit) && Number(t.rank) === Number(d.rank)).map((t: any) => String(t.id));
});

const mahjongAutoPengIds = computed(() => sameTileIds.value.slice(0, 2));
const mahjongAutoGangIds = computed(() => sameTileIds.value.slice(0, 3));
const canMahjongPeng = computed(() => mahjongAutoPengIds.value.length === 2);
const canMahjongGang = computed(() => mahjongAutoGangIds.value.length === 3);

const mahjongAutoChiIds = computed(() => {
  const d = lastDiscardTile.value;
  if (!d) return [];
  if (String(d.suit) === 'z') return [];
  if (!props.canAct) return [];
  if (String(lastDiscardFrom.value) === String(props.myUserId)) return [];
  
  const rank = Number(d.rank);
  const suit = String(d.suit);
  const pickId = (r: number) => String(props.hand.find((t: any) => String(t.suit) === suit && Number(t.rank) === r)?.id || '');

  const candidates: Array<[number, number]> = [
    [rank - 2, rank - 1],
    [rank - 1, rank + 1],
    [rank + 1, rank + 2]
  ];
  for (const [a, b] of candidates) {
    if (a < 1 || b > 9) continue;
    const id1 = pickId(a);
    const id2 = pickId(b);
    if (id1 && id2) return [id1, id2];
  }
  return [];
});

const canMahjongChi = computed(() => mahjongAutoChiIds.value.length === 2);
</script>
