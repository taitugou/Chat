<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

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

const viewportEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);

const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);

const suppressClick = ref(false);
const pendingMove = ref<{ x: number; y: number } | null>(null);

const pointers = new Map<number, { x: number; y: number }>();
let panStart: { x: number; y: number; tx: number; ty: number } | null = null;
let pinchStart: { dist: number; midX: number; midY: number; scale: number; tx: number; ty: number } | null = null;

function clampTransform() {
  const vp = viewportEl.value;
  const ct = contentEl.value;
  if (!vp || !ct) return;

  const vpRect = vp.getBoundingClientRect();
  const ctRect = ct.getBoundingClientRect();

  const vpW = vpRect.width;
  const vpH = vpRect.height;
  const ctW = ctRect.width;
  const ctH = ctRect.height;

  const maxX = Math.max(0, (ctW - vpW) / 2);
  const maxY = Math.max(0, (ctH - vpH) / 2);

  translateX.value = Math.min(maxX, Math.max(-maxX, translateX.value));
  translateY.value = Math.min(maxY, Math.max(-maxY, translateY.value));
}

function setScale(next: number, anchorX: number, anchorY: number) {
  const vp = viewportEl.value;
  if (!vp) return;

  const rect = vp.getBoundingClientRect();
  const ax = anchorX - rect.left - rect.width / 2;
  const ay = anchorY - rect.top - rect.height / 2;

  const prev = scale.value;
  const clamped = Math.min(3, Math.max(1, next));
  if (clamped === prev) return;

  const ratio = clamped / prev;
  translateX.value = translateX.value - ax * (ratio - 1);
  translateY.value = translateY.value - ay * (ratio - 1);
  scale.value = clamped;
  nextTick(() => clampTransform());
}

function onPointerDown(e: PointerEvent) {
  if (!viewportEl.value) return;
  if (e.pointerType === 'mouse') return;
  viewportEl.value.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  suppressClick.value = false;

  if (pointers.size === 1) {
    panStart = { x: e.clientX, y: e.clientY, tx: translateX.value, ty: translateY.value };
    pinchStart = null;
  } else if (pointers.size === 2) {
    const pts = Array.from(pointers.values());
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    const dist = Math.hypot(dx, dy) || 1;
    const midX = (pts[0].x + pts[1].x) / 2;
    const midY = (pts[0].y + pts[1].y) / 2;
    pinchStart = { dist, midX, midY, scale: scale.value, tx: translateX.value, ty: translateY.value };
    panStart = null;
    suppressClick.value = true;
  }
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1 && panStart) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    if (Math.hypot(dx, dy) > 8) suppressClick.value = true;
    if (scale.value > 1.01) {
      translateX.value = panStart.tx + dx;
      translateY.value = panStart.ty + dy;
      clampTransform();
    }
    return;
  }

  if (pointers.size === 2 && pinchStart) {
    const pts = Array.from(pointers.values());
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    const dist = Math.hypot(dx, dy) || 1;
    const midX = (pts[0].x + pts[1].x) / 2;
    const midY = (pts[0].y + pts[1].y) / 2;

    const nextScale = pinchStart.scale * (dist / pinchStart.dist);
    setScale(nextScale, midX, midY);

    const dmx = midX - pinchStart.midX;
    const dmy = midY - pinchStart.midY;
    translateX.value = pinchStart.tx + dmx;
    translateY.value = pinchStart.ty + dmy;
    clampTransform();
    suppressClick.value = true;
  }
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) {
    panStart = null;
    pinchStart = null;
    return;
  }
  if (pointers.size === 1) {
    const pt = Array.from(pointers.values())[0];
    panStart = { x: pt.x, y: pt.y, tx: translateX.value, ty: translateY.value };
    pinchStart = null;
  }
}

function onWheel(e: WheelEvent) {
  if (!viewportEl.value) return;
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const delta = -e.deltaY;
  const factor = delta > 0 ? 1.08 : 1 / 1.08;
  setScale(scale.value * factor, e.clientX, e.clientY);
}

const handleClick = (x: number, y: number) => {
  if (suppressClick.value) {
    suppressClick.value = false;
    return;
  }
  if (props.gameOver) return;
  if (String(props.currentPlayerId) !== String(props.myUserId)) return;
  if (props.board[y][x] !== 0) return;
  if (pendingMove.value && pendingMove.value.x === x && pendingMove.value.y === y) {
    pendingMove.value = null;
    emit('move', x, y);
    return;
  }
  pendingMove.value = { x, y };
};

const isMyTurn = computed(() => String(props.currentPlayerId) === String(props.myUserId));

watch([() => props.currentPlayerId, () => props.gameOver], () => {
  pendingMove.value = null;
});

watch(() => JSON.stringify(props.board), () => {
  pendingMove.value = null;
});

function handleMouseCellClick(e: MouseEvent, x: number, y: number) {
  if (e.button !== 0) return;
  handleClick(x, y);
}

function handleCellPointerUp(e: PointerEvent, x: number, y: number) {
  if (e.pointerType === 'mouse') return;
  handleClick(x, y);
}

function resetView() {
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
  nextTick(() => clampTransform());
}

let ro: ResizeObserver | null = null;
onMounted(() => {
  const vp = viewportEl.value;
  if (vp) {
    ro = new ResizeObserver(() => clampTransform());
    ro.observe(vp);
  }
  resetView();
});

onUnmounted(() => {
  if (ro && viewportEl.value) ro.unobserve(viewportEl.value);
  ro = null;
});
</script>

<template>
  <div class="w-full h-full flex flex-col items-center justify-center select-none">
    <div
      ref="viewportEl"
      class="relative w-full h-full max-w-full max-h-full aspect-square rounded shadow-2xl border-4 border-[#8b4513] bg-[#dcb35c] overflow-hidden"
      :class="{ 'ring-4 ring-yellow-400': isMyTurn && !gameOver }"
      style="touch-action: none;"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
    >
      <div class="absolute top-[1vh] right-[1vh] z-10 flex gap-[0.8vh]">
        <button class="glass-btn px-[1.2vh] py-[0.8vh] rounded-[1vh] text-[1.8vh] font-bold active:scale-95 transition-all" @click="resetView">
          复位
        </button>
      </div>

      <div
        ref="contentEl"
        class="absolute inset-0"
        :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`, transformOrigin: 'center center' }"
      >
        <div
          class="grid w-full h-full"
          :style="{
            gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
            gridTemplateRows: `repeat(${boardSize}, 1fr)`
          }"
        >
          <div
            v-for="(_, i) in boardSize * boardSize"
            :key="i"
            class="relative border border-black/20 flex items-center justify-center cursor-pointer hover:bg-black/5 aspect-square"
            @click="handleMouseCellClick($event, i % boardSize, Math.floor(i / boardSize))"
            @pointerup="handleCellPointerUp($event, i % boardSize, Math.floor(i / boardSize))"
          >
            <div
              v-if="board[Math.floor(i / boardSize)][i % boardSize] !== 0"
              class="w-[80%] h-[80%] rounded-full shadow-md transition-all duration-200"
              :class="{
                'bg-black': board[Math.floor(i / boardSize)][i % boardSize] === 1,
                'bg-white': board[Math.floor(i / boardSize)][i % boardSize] === 2
              }"
            ></div>

            <div
              v-else-if="pendingMove && pendingMove.x === (i % boardSize) && pendingMove.y === Math.floor(i / boardSize)"
              class="w-[78%] h-[78%] rounded-full border-2 border-green-400/80 bg-white/10"
            ></div>

            <div
              v-else-if="isMyTurn && !gameOver"
              class="w-[40%] h-[40%] rounded-full bg-white/30 opacity-0 hover:opacity-100 transition-opacity"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4 text-white text-[2vh] font-bold px-4 py-2 bg-black/40 rounded-full backdrop-blur-md text-center">
      <template v-if="gameOver">游戏结束</template>
      <template v-else-if="isMyTurn">
        <span v-if="pendingMove">再点一次确认落子</span>
        <span v-else>点击一次选点，再点一次落子</span>
      </template>
      <template v-else>等待对方落子...</template>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
}
</style>
