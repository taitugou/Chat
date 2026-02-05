# 网站设计语言指南 (Design System Guide) - 详细实例版

本指南提供了当前网站设计语言的深度总结及具体的代码实现实例。通过遵循这些规范，您可以构建出视觉统一、交互丝滑且具有 iOS 玻璃质感的界面。

---

## 1. 核心视觉理念 (Design Philosophy)
- **玻璃拟态 (Glassmorphism)**: 强调透明度、背景模糊和多层阴影，营造深度感。
- **iOS 质感**: 大圆角、平滑渐变、弹簧动效、底部滑入式模态框。
- **动态沉浸**: 使用 WebGL 背景涟漪和全屏渐变，使页面不再死板。

---

## 2. 基础规范 (Foundations)

### 色彩系统 (Color Palette)
| 类别 | 变量名 | 数值 | 示例用法 |
| :--- | :--- | :--- | :--- |
| **背景** | `--bg-main` | `#1a1a2e` | 页面 body 背景 |
| **主色** | `primary` | `#6366F1` | 主要按钮、激活态、进度条 |
| **次色** | `secondary` | `#8B5CF6` | 装饰性元素、次要标签 |
| **VIP 金** | `vip-gold` | `#FFD700` | VIP 勋章、特殊边框 |
| **错误/危险** | `danger` | `#ef4444` | 删除按钮、错误提示 |

### 圆角分级 (Border Radius)
```css
--radius-xs: 0.5rem;    /* 8px - Badges, Tags */
--radius-sm: 0.75rem;   /* 12px - Small Inputs, Buttons */
--radius-md: 1rem;      /* 16px - Standard Buttons, Small Cards */
--radius-lg: 1.5rem;    /* 24px - Main Cards, Modals */
--radius-xl: 2.25rem;   /* 36px - Large Sections */
--radius-modal: 2.5rem; /* 40px - iOS Style Slide-up Modals */
```

---

## 3. 玻璃拟态组件实例 (Component Examples)

### A. 玻璃卡片 (Glass Card)
用于承载主要内容的容器，具有柔和的模糊效果和内发光边框。

**实例代码：**
```html
<div class="glass-card p-6 border border-white/5 hover:border-primary/30 transition-all">
  <h3 class="text-white font-bold">卡片标题</h3>
  <p class="text-white/40 text-sm">卡片内容描述...</p>
</div>
```
**关键 CSS 类：** `.glass-card` (包含 `backdrop-filter: blur(24px)` 和 `background: rgba(255, 255, 255, 0.1)`)。

### B. 玻璃按钮 (Glass Buttons)
按钮分为主按钮（渐变色）和次要按钮（透明玻璃）。

**主按钮 (Primary)：**
```html
<button class="glass-btn-primary py-4 px-8 rounded-2xl shadow-2xl shadow-primary/20 active:scale-95 transition-all">
  立即发布
</button>
```
**次要按钮 (Secondary)：**
```html
<button class="glass-btn py-3 px-6 rounded-xl text-white/60 hover:text-white active:scale-95 transition-all">
  取消
</button>
```

### C. 玻璃输入框 (Glass Input)
```html
<div class="space-y-1.5">
  <label class="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">输入标题</label>
  <input 
    type="text" 
    class="glass-input w-full py-4 px-5 rounded-2xl focus:ring-2 focus:ring-primary/40" 
    placeholder="请输入内容..."
  >
</div>
```

---

## 4. 特色交互组件 (Signature Components)

### A. iOS 风格滑入弹窗 (Slide-up Modal)
这是本设计的核心特色，弹窗从底部滑出，圆角极大。

**实现逻辑：**
```html
<!-- Vue 示例 -->
<Transition name="slide-up">
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="w-full max-w-2xl glass-modal rounded-[2.5rem] p-6 shadow-2xl">
      <!-- 内容 -->
    </div>
  </div>
</Transition>
```
**CSS 动画：**
```css
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
```

### B. 背景涟漪 (Liquid Glass)
背景通过 WebGL 渲染，对鼠标点击和移动做出反应。
- **效果描述**: 鼠标点击处产生水波纹，背景图片在波纹处产生物理折射。
- **实现建议**: 使用 [LiquidGlass.vue](file:///f:/C/frontend/src/components/LiquidGlass.vue) 作为全屏背景组件。

---

## 5. 样式细节技巧 (Styling Tips)

### A. 桌面图标文字阴影 (Windows/iOS Style)
为了在浅色背景下也能看清白色文字，在特定页面（如个人资料页）使用复合文字阴影。
```css
.text-shadow-strong {
  text-shadow: 
    0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.8), 
    0 0 0.125rem rgba(0, 0, 0, 0.8);
}
```

### B. 玻璃徽章 (Glass Badge)
用于标签或状态展示。
```html
<span class="glass-badge px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-red-500 text-white">
  HOT
</span>
```

### C. 微动效 (Micro-interactions)
- **Hover**: `hover:scale-[1.01]` 或 `hover:brightness-110`。
- **Active**: 始终使用 `active:scale-95` 或 `active:scale-[0.98]`。
- **Loading**: 使用自定义旋转动画配合 `border-t-primary`。

---

## 6. 典型布局模板 (Layout Template)

```html
<div class="min-h-screen bg-black">
  <!-- 全屏 WebGL 背景 -->
  <LiquidGlass />
  
  <!-- 顶部导航 -->
  <TopNav title="页面标题" />
  
  <main class="max-w-7xl mx-auto px-4 py-8 space-y-8">
    <!-- 玻璃卡片网格 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="glass-card p-6">...</div>
      <div class="glass-card p-6">...</div>
      <div class="glass-card p-6">...</div>
    </div>
  </main>
  
  <!-- 底部固定导航 -->
  <BottomNav />
</div>
```
