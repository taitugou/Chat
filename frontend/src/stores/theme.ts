import { defineStore } from 'pinia';
import { ref, computed, watch, onMounted } from 'vue';

type ThemeMode = 'system' | 'dark' | 'light';

export const useThemeStore = defineStore('theme', () => {
  // 主题模式：system-跟随系统, dark-深色, light-浅色
  const themeMode = ref<ThemeMode>('system');
  
  // 当前实际应用的主题（根据模式和系统偏好计算得出）
  const isDark = ref(true);

  // 从 localStorage 加载主题设置
  const loadThemeFromStorage = () => {
    const saved = localStorage.getItem('theme-mode');
    if (saved && ['system', 'dark', 'light'].includes(saved)) {
      themeMode.value = saved as ThemeMode;
    }
  };

  // 检测系统主题偏好
  const getSystemPreference = (): boolean => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // 根据主题模式计算实际主题
  const updateActualTheme = () => {
    if (themeMode.value === 'system') {
      isDark.value = getSystemPreference();
    } else {
      isDark.value = themeMode.value === 'dark';
    }
    applyTheme();
  };

  // 应用主题到 DOM
  const applyTheme = () => {
    if (typeof document === 'undefined') return;
    
    const html = document.documentElement;
    if (isDark.value) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
  };

  // 设置主题模式
  const setThemeMode = (mode: ThemeMode) => {
    themeMode.value = mode;
    localStorage.setItem('theme-mode', mode);
    updateActualTheme();
  };

  // 监听系统主题变化
  const setupSystemThemeListener = () => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themeMode.value === 'system') {
        updateActualTheme();
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  };

  // 初始化主题
  const initTheme = () => {
    loadThemeFromStorage();
    updateActualTheme();
    setupSystemThemeListener();
  };

  // 主题选项配置
  const themeOptions = [
    { value: 'system' as ThemeMode, label: '跟随系统', icon: 'Monitor' },
    { value: 'light' as ThemeMode, label: '浅色模式', icon: 'Sun' },
    { value: 'dark' as ThemeMode, label: '深色模式', icon: 'Moon' },
  ];

  return {
    themeMode,
    isDark,
    themeOptions,
    setThemeMode,
    initTheme,
    updateActualTheme,
  };
});
