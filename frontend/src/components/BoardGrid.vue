<template>
  <div class="inline-block select-none">
    <div
      class="grid gap-[0.4vh] rounded-[1.5vh] border border-white/10 bg-black/40 p-[1vh]"
      :style="{ gridTemplateColumns: `repeat(${cols}, ${cellSize})` }"
    >
      <button
        v-for="cell in cells"
        :key="cell.key"
        type="button"
        class="relative flex items-center justify-center rounded-[0.9vh] border border-white/10 bg-white/5 p-0 text-center text-[2.1vh] font-black leading-none transition-all active:scale-95"
        :class="isSelected(cell.x, cell.y) ? 'ring-2 ring-primary/70 border-primary/40 bg-primary/10' : ''"
        :style="{ width: cellSize, height: cellSize }"
        @click="$emit('cellClick', { x: cell.x, y: cell.y, value: cell.value })"
      >
        <slot name="cell" :x="cell.x" :y="cell.y" :value="cell.value">
          <span class="text-white/80">{{ cell.value ?? '' }}</span>
        </slot>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Coord = { x: number; y: number };

interface Props {
  board: any[][];
  cols: number;
  rows: number;
  selected?: Coord | null;
  cellSize?: string;
}

const props = withDefaults(defineProps<Props>(), {
  selected: null,
  cellSize: '5.2vh'
});

defineEmits<{
  (e: 'cellClick', payload: { x: number; y: number; value: any }): void;
}>();

const cells = computed(() => {
  const out: Array<{ key: string; x: number; y: number; value: any }> = [];
  for (let y = 0; y < props.rows; y++) {
    for (let x = 0; x < props.cols; x++) {
      const value = props.board?.[y]?.[x];
      out.push({ key: `${x},${y}`, x, y, value });
    }
  }
  return out;
});

function isSelected(x: number, y: number) {
  return !!props.selected && props.selected.x === x && props.selected.y === y;
}
</script>
