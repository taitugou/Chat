<template>
  <textarea
    ref="textareaRef"
    v-model="content"
    @input="handleInput"
    @keydown="handleKeydown"
    @blur="handleBlur"
    :placeholder="placeholder"
    class="mention-textarea ios-input"
    :rows="rows"
    :maxlength="maxLength"
    v-bind="$attrs"
  />
  
  <teleport to="body">
    <div
      v-if="showSuggestions && filteredUsers.length > 0"
      ref="suggestionsRef"
      class="mention-suggestions ios-glass fixed z-[9999] shadow-2xl"
      :style="suggestionsStyle"
    >
      <div
        v-for="user in filteredUsers"
        :key="user.id"
        @click="selectUser(user)"
        class="mention-suggestion-item"
        :class="{ active: selectedIndex === filteredUsers.indexOf(user) }"
      >
        <img
          :src="getImageUrl(user.avatar)"
          :alt="user.nickname"
          class="mention-suggestion-avatar"
        />
        <div class="mention-suggestion-info">
          <div class="mention-suggestion-name text-ios-label-primary">{{ user.nickname }}</div>
          <div class="mention-suggestion-username text-ios-label-secondary">@{{ user.username }}</div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useElementBounding, useWindowSize } from '@vueuse/core';
import api from '@/utils/api';
import { getImageUrl } from '@/utils/imageUrl';

defineOptions({
  inheritAttrs: false
});

interface User {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
}

interface Props {
  modelValue: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  postId?: number;
  topicId?: number;
  commentId?: number;
  showCharCount?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '输入内容...',
  rows: 4,
  maxLength: 500,
  postId: undefined,
  topicId: undefined,
  commentId: undefined,
  showCharCount: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const content = ref(props.modelValue);
const textareaRef = ref<HTMLTextAreaElement>();
const suggestionsRef = ref<HTMLElement>();
const showSuggestions = ref(false);
const searchKeyword = ref('');
const users = ref<User[]>([]);
const selectedIndex = ref(0);
const mentionStartPos = ref(-1);

const { top, left, bottom, width } = useElementBounding(textareaRef);
const { height: windowHeight } = useWindowSize();

const suggestionsStyle = computed(() => {
  if (!textareaRef.value) return {};
  
  const dropdownHeight = 300; // max-height is 18.75rem = 300px
  const spaceBelow = windowHeight.value - bottom.value;
  const showAbove = spaceBelow < dropdownHeight && top.value > dropdownHeight;

  return {
    top: showAbove ? 'auto' : `${bottom.value + 4}px`,
    bottom: showAbove ? `${windowHeight.value - top.value + 4}px` : 'auto',
    left: `${left.value}px`,
    width: `${width.value}px`,
  };
});

const filteredUsers = computed(() => {
  if (!searchKeyword.value) return users.value.slice(0, 10);
  return users.value
    .filter(user =>
      user.username.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      user.nickname.toLowerCase().includes(searchKeyword.value.toLowerCase())
    )
    .slice(0, 10);
});

watch(() => props.modelValue, (newValue) => {
  content.value = newValue;
});

watch(content, (newValue) => {
  emit('update:modelValue', newValue);
});

async function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  const text = target.value;
  const cursorPos = target.selectionStart;
  
  const textBeforeCursor = text.substring(0, cursorPos);
  const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
  
  if (mentionMatch) {
    mentionStartPos.value = cursorPos - mentionMatch[0].length;
    searchKeyword.value = mentionMatch[1];
    showSuggestions.value = true;
    selectedIndex.value = 0;
    
    if (searchKeyword.value.length >= 1) {
      await searchUsers(searchKeyword.value);
    } else {
      users.value = [];
    }
  } else {
    showSuggestions.value = false;
    searchKeyword.value = '';
    users.value = [];
  }
}

async function searchUsers(keyword: string) {
  try {
    const response = await api.get('/mention/search-users', {
      params: { keyword }
    });
    users.value = response.data.users || [];
  } catch (error) {
    console.error('搜索用户失败:', error);
    users.value = [];
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!showSuggestions.value || filteredUsers.value.length === 0) return;
  
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % filteredUsers.value.length;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectedIndex.value = (selectedIndex.value - 1 + filteredUsers.value.length) % filteredUsers.value.length;
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    const user = filteredUsers.value[selectedIndex.value];
    if (user) {
      selectUser(user);
    }
  } else if (event.key === 'Escape') {
    showSuggestions.value = false;
  }
}

function selectUser(user: User) {
  const text = content.value;
  const beforeMention = text.substring(0, mentionStartPos.value);
  const afterMention = text.substring(mentionStartPos.value + searchKeyword.value.length + 1);
  
  content.value = beforeMention + `@${user.username} ` + afterMention;
  showSuggestions.value = false;
  
  nextTick(() => {
    if (textareaRef.value) {
      const newCursorPos = mentionStartPos.value + user.username.length + 2;
      textareaRef.value.focus();
      textareaRef.value.setSelectionRange(newCursorPos, newCursorPos);
    }
  });
}

function handleBlur() {
  setTimeout(() => {
    showSuggestions.value = false;
  }, 200);
}
</script>

<style scoped>
.mention-textarea {
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
  /* Ensure it looks like a standard ios-input button */
  min-height: 2.75rem;
}

.mention-suggestions {
  max-height: 18.75rem;
  overflow-y: auto;
  border-radius: 0.75rem;
}

.mention-suggestion-item {
  display: flex;
  align-items: center;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.mention-suggestion-item:hover,
.mention-suggestion-item.active {
  background-color: rgba(255, 255, 255, 0.2);
}

.mention-suggestion-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 0.75rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.mention-suggestion-info {
  flex: 1;
}

.mention-suggestion-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.mention-suggestion-username {
  font-size: 0.75rem;
}

@media (max-width: 40rem) {
  .mention-suggestions {
    max-height: 12.5rem;
  }
  
  .mention-suggestion-item {
    padding: 0.5rem 0.625rem;
  }
  
  .mention-suggestion-avatar {
    width: 2rem;
    height: 2rem;
  }
}
</style>

