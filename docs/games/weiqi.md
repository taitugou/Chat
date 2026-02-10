# 围棋（weiqi）规则说明书（19 路简化计分）

## 1. 概览
- 玩法类型：棋类（19x19）
- 人数范围：2
- 对局入口：`/game/room/:roomId/weiqi`
- 服务端实现： [weiqi.js](file:///f:/C/backend/services/games/chess/weiqi.js) 、[abstractBoard.js](file:///f:/C/backend/services/games/chess/abstractBoard.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L161-L170)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10
- `boardW:number`：默认 19（可覆盖）
- `boardH:number`：默认 19（可覆盖）
- `komi:number`：贴目，默认 6.5（白方加分）

## 3. 状态模型（GameState 摘要）
- 公开状态：`board`、`currentPlayer`、`passCount`、`captureCount`、`lastMove`、`gameOver`

## 4. 动作与合法性校验
- `place`：payload `{ x:number, y:number }`
  - 坐标合法、落点为空
  - 提子：落子后检查相邻对方棋块无气则提走
  - 自杀禁入：若自身棋块无气且未提子则拒绝
  - 劫（ko）：禁止立即重复上一手局面（基于棋盘 hash）
- `pass`：过一手；连续两次 pass 自动结算
- `settle`：强制结算（用于超时/测试）
- `surrender`：认输结束

## 5. 计分与胜负（实现口径）
- 计分：黑/白以「棋子数 + 提子数 + komi（白方）」比较
- 终局：连续两次 pass 或 settle/surrender

## 6. 结算
- winner `chipsChange = pot`，其余 0（pot 为 baseBet 汇总）

## 7. 测试用例矩阵（摘要）
- 边界：角/边提子连锁；单子自杀禁入；眼位落子
- 特殊：标准 ko 复现；连续 pass 自动结算
- 异常：非回合落子、重复落子、越界坐标
- 并发：同回合双端 place 幂等性

## 8. UI 动态适配要点（文字版设计稿）
- 棋盘渲染：Canvas 优先（19x19 高频点击）；移动端放大镜辅助落子
- 提子反馈：被提子以淡出动画移除；最后一步标记
- 历史回放：lastMove + moveHistory（可扩展）

## 9. 性能指标与优化点
- Canvas 单层绘制 + 局部重绘（仅刷新受影响区域），避免 DOM 361 格频繁更新

## 10. 与通行规则差异（风险登记）
- 计分与死活争议处理为简化口径；未覆盖复杂裁判规则（见 [rules_research.md](file:///f:/C/rules_research.md#L161-L170)）

