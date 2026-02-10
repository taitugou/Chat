# /game 前端性能分析报告（基线 + 已落地优化）

## 1. 关键指标（验收口径）
- 首屏加载：< 1.5s（以生产构建、开启缓存、常见移动网络为目标）
- 操作响应：< 100ms（按钮点击/落子/出牌等交互）
- 动画流畅：60fps（低端设备允许降级）

## 2. 已落地优化（本仓库实现）

### 2.1 代码层：按需加载
- 对局页将 Board/Controls 组件改为异步加载，降低初始 JS 体积：
  - 入口： [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue)
  - 典型效果：对局页主 chunk 明显变小，Poker/Mahjong/Chess/Dice 组件拆分为独立 chunk

### 2.2 UI 层：小屏自动折叠侧栏
- 根据屏幕宽度与玩法 profile 自动折叠左右侧栏，避免信息区挤压主棋盘：
  - 配置： [uiProfile.ts](file:///f:/C/frontend/src/games/uiProfile.ts)
  - 接入： [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue)

### 2.3 网络层：心跳与断线重连稳态化
- 可见性/在线状态更新与心跳仅在连接存在时发送，减少离线缓冲与无效 emit：
  - 实现： [socket.ts](file:///f:/C/frontend/src/utils/socket.ts)
- 增加浏览器 online/offline 监听，在网络恢复时主动尝试连接。

## 3. 后续优化清单（建议优先级）
- 动画：把高频动画统一改为 rAF 驱动的 transform（筹码飞入、发牌、提子等）
- 渲染：棋盘类优先 Canvas 局部重绘；麻将/扑克牌列表做“按需渲染/虚拟化”
- 资源：对局页按玩法预加载必要音效与少量关键图片，其余延迟加载

