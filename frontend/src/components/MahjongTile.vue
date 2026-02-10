<template>
  <button
    type="button"
    class="relative flex flex-col items-center justify-center rounded-[1.1vh] border border-white/10 bg-white/5 px-[0.7vh] py-[0.6vh] text-center transition-all active:scale-95"
    :class="selected ? 'ring-2 ring-primary/70 border-primary/40 bg-primary/10' : ''"
    @click="$emit('click')"
  >
    <div class="text-[2.1vh] font-black leading-none" :class="isHonor ? 'text-yellow-200' : 'text-white'">
      {{ mainText }}
    </div>
    <div class="mt-[0.3vh] text-[1.6vh] font-bold text-white/50 leading-none">
      {{ subText }}
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Tile {
  id?: string;
  suit: string;
  rank: number | string;
}

interface Props {
  tile: Tile;
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
});

defineEmits(['click']);

const isHonor = computed(() => String(props.tile?.suit) === 'z');

const honorName = computed(() => {
  const r = Number(props.tile?.rank);
  const map: Record<number, string> = {
    1: '东',
    2: '南',
    3: '西',
    4: '北',
    5: '中',
    6: '发',
    7: '白'
  };
  return map[r] || String(props.tile?.rank);
});

const suitName = computed(() => {
  const s = String(props.tile?.suit);
  if (s === 'm') return '万';
  if (s === 'p') return '筒';
  if (s === 's') return '条';
  if (s === 'z') return '字';
  return s;
});

const mainText = computed(() => (isHonor.value ? honorName.value : String(props.tile?.rank)));
const subText = computed(() => (isHonor.value ? ' ' : suitName.value));
</script>

