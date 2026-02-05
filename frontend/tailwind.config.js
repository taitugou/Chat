/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',
        secondary: '#8B5CF6',
        background: '#1a1a2e',
        foreground: '#ffffff',
        vip: {
          gold: '#FFD700',
          purple: '#8A2BE2',
          diamond: '#B9F2FF',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}

