<template>
  <div class="dice-container w-[8vh] h-[8vh] relative perspective-1000">
    <div class="dice relative w-full h-full transform-style-3d transition-transform duration-[2000ms] ease-out"
         :class="{ 'rolling': isRolling }"
         :style="diceStyle">
      <div class="face front flex items-center justify-center bg-white border border-gray-300 rounded-[1vh]">
        <div class="dot w-[20%] h-[20%] bg-red-500 rounded-full"></div>
      </div>
      <div class="face back flex items-center justify-center bg-white border border-gray-300 rounded-[1vh]">
        <div class="flex flex-col gap-[15%]">
          <div class="flex gap-[15%]">
             <div class="dot w-[1.2vh] h-[1.2vh] bg-blue-800 rounded-full"></div>
             <div class="dot w-[1.2vh] h-[1.2vh] bg-blue-800 rounded-full"></div>
             <div class="dot w-[1.2vh] h-[1.2vh] bg-blue-800 rounded-full"></div>
          </div>
          <div class="flex gap-[15%]">
             <div class="dot w-[1.2vh] h-[1.2vh] bg-blue-800 rounded-full"></div>
             <div class="dot w-[1.2vh] h-[1.2vh] bg-blue-800 rounded-full"></div>
             <div class="dot w-[1.2vh] h-[1.2vh] bg-blue-800 rounded-full"></div>
          </div>
        </div>
      </div>
      <div class="face right flex items-center justify-center bg-white border border-gray-300 rounded-[1vh]">
        <div class="flex flex-col gap-[20%]">
          <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full self-start"></div>
          <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full self-center"></div>
          <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full self-end"></div>
        </div>
      </div>
      <div class="face left flex items-center justify-center bg-white border border-gray-300 rounded-[1vh]">
        <div class="grid grid-cols-2 gap-[2vh]">
          <div class="dot w-[1.5vh] h-[1.5vh] bg-red-500 rounded-full"></div>
          <div class="dot w-[1.5vh] h-[1.5vh] bg-red-500 rounded-full"></div>
          <div class="dot w-[1.5vh] h-[1.5vh] bg-red-500 rounded-full"></div>
          <div class="dot w-[1.5vh] h-[1.5vh] bg-red-500 rounded-full"></div>
        </div>
      </div>
      <div class="face top flex items-center justify-center bg-white border border-gray-300 rounded-[1vh]">
        <div class="flex flex-col gap-[25%]">
          <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full self-start"></div>
          <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full self-end"></div>
        </div>
      </div>
      <div class="face bottom flex items-center justify-center bg-white border border-gray-300 rounded-[1vh]">
        <div class="grid grid-cols-2 gap-[1vh] relative">
           <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full"></div>
           <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full"></div>
           <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2"></div>
           <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full mt-[2vh]"></div>
           <div class="dot w-[1.5vh] h-[1.5vh] bg-blue-800 rounded-full mt-[2vh]"></div>
        </div>
      </div>
      
      <!-- 简易版面：为避免复杂CSS布局，使用贴图或简单数字替代 -->
      <!-- 这里使用 CSS 绘制点数作为回退 -->
      <div class="face front bg-white flex items-center justify-center text-[4vh] font-black text-red-500">1</div>
      <div class="face back bg-white flex items-center justify-center text-[4vh] font-black text-blue-800">6</div>
      <div class="face right bg-white flex items-center justify-center text-[4vh] font-black text-blue-800">3</div>
      <div class="face left bg-white flex items-center justify-center text-[4vh] font-black text-red-500">4</div>
      <div class="face top bg-white flex items-center justify-center text-[4vh] font-black text-blue-800">2</div>
      <div class="face bottom bg-white flex items-center justify-center text-[4vh] font-black text-blue-800">5</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed, ref, watch } from 'vue';

const props = defineProps<{
  value: number; // 1-6
  rolling: boolean;
}>();

const isRolling = ref(false);

const diceStyle = computed(() => {
  // 根据点数旋转到对应面
  // 1: front (0,0), 6: back (180,0), 2: top (-90,0), 5: bottom (90,0), 3: right (0,-90), 4: left (0,90)
  if (isRolling.value) return { transform: `rotateX(${Math.random()*720}deg) rotateY(${Math.random()*720}deg)` };
  
  switch (props.value) {
    case 1: return { transform: 'rotateX(0deg) rotateY(0deg)' };
    case 6: return { transform: 'rotateX(180deg) rotateY(0deg)' };
    case 2: return { transform: 'rotateX(-90deg) rotateY(0deg)' };
    case 5: return { transform: 'rotateX(90deg) rotateY(0deg)' };
    case 3: return { transform: 'rotateY(-90deg)' };
    case 4: return { transform: 'rotateY(90deg)' };
    default: return { transform: 'rotateX(0deg) rotateY(0deg)' };
  }
});

watch(() => props.rolling, (val) => {
  if (val) {
    isRolling.value = true;
  } else {
    setTimeout(() => {
      isRolling.value = false;
    }, 100);
  }
});
</script>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}
.transform-style-3d {
  transform-style: preserve-3d;
}
.face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  box-shadow: inset 0 0 1vh rgba(0,0,0,0.1);
}
.front  { transform: rotateY(0deg) translateZ(4vh); }
.back   { transform: rotateY(180deg) translateZ(4vh); }
.right  { transform: rotateY(90deg) translateZ(4vh); }
.left   { transform: rotateY(-90deg) translateZ(4vh); }
.top    { transform: rotateX(90deg) translateZ(4vh); }
.bottom { transform: rotateX(-90deg) translateZ(4vh); }

.rolling {
  animation: roll 0.5s linear infinite;
}

@keyframes roll {
  0% { transform: rotateX(0) rotateY(0); }
  100% { transform: rotateX(360deg) rotateY(360deg); }
}
</style>
