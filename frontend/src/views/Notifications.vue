<template>
  <div class="min-h-screen pb-20">
    <TopNav />
    
    <div class="max-w-4xl mx-auto px-4 py-4 sm:py-6 lg:py-8">
      <NotificationPanel variant="page" />
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';
import NotificationPanel from '@/components/NotificationPanel.vue';
</script>

<style scoped>
</style>
