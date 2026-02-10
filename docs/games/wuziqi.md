# 五子棋（wuziqi）规则说明书（自由规则）

## 1. 概览
- 玩法类型：棋类（15x15）
- 人数范围：2
- 对局入口：`/game/room/:roomId/wuziqi`
- 服务端实现： [gomoku.js](file:///f:/C/backend/services/games/chess/gomoku.js)
- 规则基线（实现摘要）：[gamerules.md](file:///f:/C/gamerules.md#L191-L206)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L44-L55)

## 2. 房间配置参数（room.settings.gameOptions）
当前实现未读取 options（构造函数不接收 options），以下为硬编码：
- 棋盘：15x15
- 买入：每人固定 100（playerBets/playerTotalSpent）

## 3. 状态模型（GameState 摘要）
- 公开状态：`board(15x15)`、`currentPlayer`、`gameOver`、`winner`

## 4. 动作与合法性校验
- `move`：payload `{ x:number, y:number }`
  - 坐标合法、落点为空、必须当前回合
- `surrender`：认输结束

## 5. 胜负判定（实现口径）
- 自由规则：任一方向连续同色棋子 `>= 5` 即判胜（包含 6 连及以上）

## 6. 结算
- pot 为双方买入汇总（默认 200）；winner `chipsChange = pot`

## 7. 测试用例矩阵（摘要）
- 边界：四个方向（横竖撇捺）五连；边界坐标；重复落子
- 特殊：6 连（在标准五子棋/禁手体系下可能争议）：当前实现应判胜
- 并发：同回合双端落子幂等性

## 8. UI 动态适配要点（文字版设计稿）
- 棋盘渲染：轻量网格 + 点击落子；移动端提供“放大镜”或双击确认以降低误触
- 反馈：最后一步高亮、胜利连线标记、悔棋入口占位

## 9. 性能指标与优化点
- 局部更新：只更新落子点与胜利标记，避免整盘重渲染

## 10. 与通行规则差异（风险登记）
- 未实现 Renju 禁手（如三三/四四/长连禁手），属于明确差异点（见 [rules_research.md](file:///f:/C/rules_research.md#L44-L55)）

