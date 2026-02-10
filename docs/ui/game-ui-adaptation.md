# /game UI 动态适配系统（实现说明）

## 1. 目标
- 让 18 个玩法共享同一套对局页框架，同时按玩法差异自动调整布局、交互与默认面板状态。
- 在移动端保证可操作性：横屏优先、侧栏自动折叠、关键操作不被遮挡。

## 2. 入口与分发
- 对局页入口： [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue)
- Board/Controls 分类组件：
  - 扑克/牌类：PokerBoard / PokerControls
  - 麻将：MahjongBoard / MahjongControls
  - 棋类：ChessBoard / ChessControls
  - 其他：DiceBoard（骰宝/二八杠）；Controls 由对局页内联渲染

## 3. UI Profile（按玩法配置的布局档案）
- 配置来源： [uiProfile.ts](file:///f:/C/frontend/src/games/uiProfile.ts)
- 核心字段：
  - `prefersLandscape`：是否强制横屏全屏（移动端）
  - `autoCollapsePanelsBelowPx`：低于该宽度自动折叠左右侧栏
  - `leftPanelWidth/rightPanelWidth/compactPanelWidth`：宽度档位
- 对局页接入：对局页根据 `effectiveGameType` 计算 profile，并在窗口尺寸变化时自动折叠侧栏。

## 4. 响应式策略
- 移动端：横屏全屏优先；当屏宽不足时自动折叠左右面板，仅保留棋盘/牌桌主区域。
- 桌面端：默认展开左右面板（功能区/房间工具），用户可手动折叠。

## 5. 后续可扩展点（已预留接口形态）
- 棋类回放：依赖服务端 `moveHistory`/对局日志，在右侧工具区加入“回放/步进”面板。
- AI 提示层：以“本地计算 + 可选服务端建议”方式叠加在 Board 上，按玩法开关控制渲染。

