<template>
  <div 
    class="poker-card relative transition-all duration-300"
    :class="[
      isFlipped ? 'is-flipped' : '',
      size === 'sm' ? 'h-[15vh] aspect-[2/3]' : size === 'md' ? 'h-[25vh] aspect-[2/3]' : 'h-[35vh] aspect-[2/3]',
      clickable ? 'cursor-pointer hover:-translate-y-2' : ''
    ]"
    @click="$emit('click')"
  >
    <div class="card-inner w-full h-full relative preserve-3d">
      <!-- Card Front -->
      <div class="card-front absolute inset-0 backface-hidden rounded-xl overflow-hidden shadow-lg border border-white/20">
        <img :src="cardImageUrl" :alt="cardName" class="w-full h-full object-contain bg-white" />
      </div>
      
      <!-- Card Back -->
      <div class="card-back absolute inset-0 backface-hidden rounded-xl overflow-hidden shadow-lg border border-white/10 rotate-y-180">
        <img src="@/assets/cards/back.svg" alt="Card Back" class="w-full h-full object-contain" />
        <!-- Center Icon -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img 
            src="/f.ico" 
            alt="Logo"
            class="rounded-lg shadow-xl border border-white/10 bg-white/5 backdrop-blur-sm"
            :class="[
              size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-10 h-10' : 'w-14 h-14'
            ]"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  suit?: string;   // spades, hearts, diamonds, clubs
  value?: string | number;  // 2-10, J, Q, K, A
  isFlipped?: boolean;
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  suit: '♠',
  value: 'A',
  isFlipped: false,
  size: 'md',
  clickable: false
});

defineEmits(['click']);

const suitMap: Record<string, string> = {
  '♠': 'spades',
  'spades': 'spades',
  '♥': 'hearts',
  'hearts': 'hearts',
  '♦': 'diamonds',
  'diamonds': 'diamonds',
  '♣': 'clubs',
  'clubs': 'clubs'
};

const cardName = computed(() => {
  if (String(props.suit).toUpperCase() === 'JOKER') {
    const v = String(props.value || '').toUpperCase();
    if (v === 'BJ') return 'joker_red';
    return 'joker_black';
  }
  const suitName = suitMap[props.suit] || props.suit;
  return `${suitName}_${props.value}`.toLowerCase();
});

const cardImageUrl = computed(() => {
  // Vite way to get dynamic assets
  return new URL(`../assets/cards/${cardName.value}.svg`, import.meta.url).href;
});
</script>

<style scoped>
.poker-card {
  perspective: 1000px;
}

.card-inner {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.is-flipped .card-inner {
  transform: rotateY(180deg);
}

.preserve-3d {
  transform-style: preserve-3d;
}

.backface-hidden {
  backface-visibility: hidden;
}

.rotate-y-180 {
  transform: rotateY(180deg);
}
</style>
