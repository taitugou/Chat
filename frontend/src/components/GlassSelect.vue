<template>
  <div class="relative ios-select" ref="containerRef">
    <div 
      @click="toggleDropdown"
      class="ios-input w-full py-3 px-5 rounded-2xl flex items-center justify-between transition-all"
      :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:scale-[0.98]'"
      :aria-disabled="disabled ? 'true' : 'false'"
    >
      <span v-if="selectedLabel" class="text-ios-label-primary font-bold">{{ selectedLabel }}</span>
      <span v-else class="text-ios-label-quaternary">{{ placeholder }}</span>
      <span class="text-ios-label-quaternary transition-transform duration-300" :class="{ 'rotate-180': isOpen }">▼</span>
    </div>

    <Teleport to="body">
      <Transition name="fade-slide">
        <div 
          v-if="isOpen && canOpen" 
          ref="dropdownRef"
          class="fixed z-[9999] ios-modal rounded-2xl overflow-hidden shadow-2xl border border-ios-separator"
          :style="dropdownStyle"
        >
          <div class="max-h-[300px] overflow-y-auto custom-scrollbar bg-ios-systemGray5/80 backdrop-blur-xl">
          <div v-if="normalizedOptions.length === 0" class="px-5 py-4 text-sm text-ios-label-tertiary">
            暂无可选项
          </div>
          <template v-else>
            <div
              v-for="(option, index) in normalizedOptions"
              :key="index"
              @click="selectOption(option)"
              class="px-5 py-4 hover:bg-ios-systemGray5 transition-colors cursor-pointer flex items-center justify-between border-b border-ios-separator last:border-0"
              :class="{ 'bg-ios-blue/30': modelValue === option.value }"
            >
              <span class="text-sm font-bold" :class="modelValue === option.value ? 'text-ios-blue' : 'text-ios-label-primary'">
                {{ option.label }}
              </span>
              <span v-if="modelValue === option.value" class="text-ios-blue text-xs">✓</span>
            </div>
          </template>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useElementBounding } from '@vueuse/core';

const props = defineProps<{
  modelValue: any;
  options: Array<any>;
  placeholder?: string;
  labelKey?: string;
  valueKey?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
  'change': [value: any];
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const { left, bottom, width } = useElementBounding(containerRef);

const dropdownStyle = computed(() => ({
  top: `${bottom.value + 8}px`,
  left: `${left.value}px`,
  width: `${width.value}px`,
}));

const normalizedOptions = computed(() => {
  return props.options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return {
      value: props.valueKey ? opt[props.valueKey] : opt.value,
      label: props.labelKey ? opt[props.labelKey] : opt.label
    };
  });
});

const selectedLabel = computed(() => {
  const option = normalizedOptions.value.find(o => o.value === props.modelValue);
  return option ? option.label : '';
});

const disabled = computed(() => !!props.disabled);
const canOpen = computed(() => !disabled.value && normalizedOptions.value.length > 0);

function toggleDropdown() {
  if (!canOpen.value) return;
  isOpen.value = !isOpen.value;
}

function selectOption(option: any) {
  emit('update:modelValue', option.value);
  emit('change', option.value);
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  const isInsideContainer = containerRef.value && containerRef.value.contains(target);
  const isInsideDropdown = dropdownRef.value && dropdownRef.value.contains(target);
  
  if (!isInsideContainer && !isInsideDropdown) {
    isOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-slide-enter-from, .fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
