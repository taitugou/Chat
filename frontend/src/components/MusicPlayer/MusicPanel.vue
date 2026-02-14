<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="visible" class="music-panel-overlay" @click.self="handleOverlayClick">
        <div class="music-panel">
          <div class="panel-header">
            <div class="header-title">正在播放</div>
            <button class="close-btn" @click="$emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="panel-content">
            <div class="cover-container" :class="{ playing: isPlaying }">
              <img
                v-if="currentTrack?.cover"
                :src="currentTrack.cover"
                :alt="currentTrack.name"
                class="cover-image"
                @error="onCoverError"
              />
              <div v-else class="cover-placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
            </div>

            <div class="track-info">
              <div class="track-name">{{ currentTrack?.name || '未知歌曲' }}</div>
              <div class="track-artist">{{ currentTrack?.artist || '未知歌手' }}</div>
            </div>

            <div class="controls-section">
              <button class="control-btn" @click="$emit('prev')" title="上一首">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>
              
              <button class="control-btn play-btn" @click="$emit('togglePlay')" :title="isPlaying ? '暂停' : '播放'">
                <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              </button>
              
              <button class="control-btn" @click="$emit('next')" title="下一首">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>
            </div>

            <div class="volume-section">
              <button class="volume-btn" @click="$emit('toggleMute')">
                <svg v-if="!muted && volume > 0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
                <svg v-else-if="!muted && volume > 0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              </button>
              <div class="volume-slider" @click="setVolume">
                <div class="volume-bg"></div>
                <div class="volume-fill" :style="{ width: `${muted ? 0 : volume * 100}%` }"></div>
              </div>
            </div>

            <div class="settings-section">
              <div class="setting-item">
                <span class="setting-label">自动播放</span>
                <button
                  class="toggle-switch"
                  :class="{ active: autoPlayEnabled }"
                  @click="$emit('toggleAutoPlay')"
                >
                  <span class="toggle-thumb"></span>
                </button>
              </div>
            </div>

            <div v-if="roomState" class="room-section">
              <div class="room-info">
                <svg viewBox="0 0 24 24" fill="currentColor" class="room-icon">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>房间音乐同步</span>
                <span v-if="roomState.isOwner" class="owner-badge">房主</span>
                <span v-else class="member-badge">成员</span>
              </div>
              <div class="room-hint">
                {{ roomState.isOwner ? '你的播放控制将同步给所有房间成员' : '跟随房主的音乐播放' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { MusicTrack } from '@/utils/musicApi';

const props = defineProps<{
  visible: boolean;
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  autoPlayEnabled: boolean;
  roomState: { roomId: string; isOwner: boolean } | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'togglePlay'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'setVolume', volume: number): void;
  (e: 'toggleMute'): void;
  (e: 'toggleAutoPlay'): void;
}>();

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close');
  }
}

function setVolume(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  emit('setVolume', Math.max(0, Math.min(1, percent)));
}

function onCoverError(e: Event) {
  const target = e.target as HTMLImageElement;
  target.style.display = 'none';
  const parent = target.parentElement;
  if (parent && !parent.querySelector('.cover-placeholder')) {
    const placeholder = document.createElement('div');
    placeholder.className = 'cover-placeholder';
    placeholder.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
    parent.appendChild(placeholder);
  }
}
</script>

<style scoped>
.music-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 20px;
}

.music-panel {
  width: 100%;
  max-width: 420px;
  max-height: 85vh;
  background: var(--ios-systemGray6);
  border-radius: 24px 24px 16px 16px;
  overflow: hidden;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.3);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ios-separator);
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ios-label-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ios-systemGray5);
  border: none;
  color: var(--ios-label-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--ios-systemGray4);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.panel-content {
  padding: 24px 20px;
  overflow-y: auto;
  max-height: calc(85vh - 60px);
}

.cover-container {
  width: 200px;
  height: 200px;
  margin: 0 auto 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  position: relative;
}

.cover-container.playing {
  animation: coverPulse 3s ease-in-out infinite;
}

@keyframes coverPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: var(--ios-blue);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-placeholder svg {
  width: 80px;
  height: 80px;
  color: rgba(255, 255, 255, 0.5);
}

.track-info {
  text-align: center;
  margin-bottom: 24px;
}

.track-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--ios-label-primary);
  margin-bottom: 8px;
  line-height: 1.3;
}

.track-artist {
  font-size: 14px;
  color: var(--ios-label-secondary);
  margin-bottom: 8px;
}

.track-source {
  display: flex;
  justify-content: center;
}

.source-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.source-badge.netease {
  background: rgba(236, 72, 72, 0.2);
  color: #f87171;
}

.source-badge.kuwo {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.controls-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 24px;
}

.control-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--ios-systemGray5);
  border: none;
  color: var(--ios-label-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background: var(--ios-systemGray4);
  transform: scale(1.1);
}

.control-btn:active {
  transform: scale(0.95);
}

.control-btn svg {
  width: 24px;
  height: 24px;
}

.play-btn {
  width: 64px;
  height: 64px;
  background: var(--ios-blue);
  box-shadow: 0 4px 15px rgba(0, 122, 255, 0.4);
  color: white;
}

.play-btn:hover {
  box-shadow: 0 6px 20px rgba(0, 122, 255, 0.5);
}

.play-btn svg {
  width: 28px;
  height: 28px;
}

.volume-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 0 20px;
}

.volume-btn {
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  color: var(--ios-label-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.2s;
}

.volume-btn:hover {
  color: var(--ios-label-primary);
}

.volume-btn svg {
  width: 24px;
  height: 24px;
}

.volume-slider {
  flex: 1;
  height: 24px;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.volume-bg {
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--ios-systemGray5);
  border-radius: 2px;
}

.volume-fill {
  position: absolute;
  left: 0;
  height: 4px;
  background: var(--ios-blue);
  border-radius: 2px;
  transition: width 0.1s;
}

.settings-section {
  border-top: 1px solid var(--ios-separator);
  padding-top: 20px;
  margin-bottom: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.setting-label {
  font-size: 14px;
  color: var(--ios-label-secondary);
}

.setting-options {
  display: flex;
  gap: 8px;
}

.source-option {
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  background: var(--ios-systemGray5);
  border: none;
  color: var(--ios-label-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.source-option:hover {
  background: var(--ios-systemGray4);
}

.source-option.active {
  background: var(--ios-blue);
  color: white;
}

.toggle-switch {
  width: 48px;
  height: 28px;
  border-radius: 14px;
  background: var(--ios-systemGray5);
  border: none;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-switch.active {
  background: var(--ios-blue);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--ios-label-primary);
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(20px);
  background: white;
}

.room-section {
  background: rgba(0, 122, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ios-label-primary);
  margin-bottom: 8px;
}

.room-icon {
  width: 18px;
  height: 18px;
  color: var(--ios-blue);
}

.owner-badge {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.member-badge {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.room-hint {
  font-size: 12px;
  color: var(--ios-label-tertiary);
}

.panel-enter-active,
.panel-leave-active {
  transition: all 0.3s ease;
}

.panel-enter-active .music-panel,
.panel-leave-active .music-panel {
  transition: transform 0.3s ease;
}

.panel-enter-from,
.panel-leave-to {
  background: rgba(0, 0, 0, 0);
}

.panel-enter-from .music-panel,
.panel-leave-to .music-panel {
  transform: translateY(100%);
}
</style>
