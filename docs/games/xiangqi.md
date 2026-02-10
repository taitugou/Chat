# 中国象棋（xiangqi）规则说明书

## 1. 概览
- 玩法类型：棋类（9x10）
- 人数范围：2
- 对局入口：`/game/room/:roomId/xiangqi`
- 服务端实现： [xiangqi.js](file:///f:/C/backend/services/games/chess/xiangqi.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L151-L160)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10

## 3. 状态模型（GameState 摘要）
- 公开状态：`board(9x10)`、`currentPlayer`、`gameOver`、`pot/baseBet`
- 历史：`moveHistory`（服务端存储，用于回放/悔棋扩展的基础）

## 4. 动作与合法性校验
- `move`：payload `{ from:{x,y}, to:{x,y} }`
- 校验要点（实现口径）：
  - 坐标边界、起点有棋子、不能操作对方棋子、不能吃己方棋子
  - 走子规则：马腿/象眼/炮架/过河兵/九宫将帅等
  - 不能“送将”、将帅不能照面

## 5. 胜负判定
- 吃掉将/帅或将死（checkmate）结束

## 6. 结算
- winner `chipsChange = pot`，其余 0

## 7. 测试用例矩阵（摘要）
- 边界：九宫边界走法；马腿/象眼阻挡；炮吃子与炮架缺失
- 异常：非回合走子、越界坐标、起点无棋子、吃己方
- 特殊：将军状态下的应将合法性；将帅照面禁止
- 并发：同回合双端 move 幂等性与状态一致性

## 8. UI 动态适配要点（文字版设计稿）
- 棋盘渲染：Canvas/SVG 或 DOM 网格；点击两段式选子+落点；可选拖拽（移动端优先点击）
- 高亮：当前选中棋子、可落点、将军提示、最后一步标记
- 复盘：基于 moveHistory 的走子回放入口（占位）

## 9. 性能指标与优化点
- 棋盘更新采用局部更新（仅更新 from/to 两格），避免整盘重渲染

## 10. 与通行规则差异（风险登记）
- 长将/长捉等裁判细则未覆盖（见 [rules_research.md](file:///f:/C/rules_research.md#L151-L160)）

