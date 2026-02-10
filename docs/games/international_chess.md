# 国际象棋（international_chess）规则说明书

## 1. 概览
- 玩法类型：棋类（8x8）
- 人数范围：2
- 对局入口：`/game/room/:roomId/international_chess`
- 服务端实现： [internationalChess.js](file:///f:/C/backend/services/games/chess/internationalChess.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L171-L180)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10

## 3. 状态模型（GameState 摘要）
- 公开状态：`board(8x8)`、`currentPlayer`、`castlingRights`、`enPassant`、`moveHistory`、`gameOver`

## 4. 动作与合法性校验
- `move`：payload `{ from:{x,y}, to:{x,y} }`
- 校验要点（实现口径）：
  - 只能走合法走法集合（含：易位、吃过路兵）
  - 不能走出“自杀王”的走法（必须解将）
  - 升变：当前实现默认升后（需要用例确认）

## 5. 终局与和棋（实现口径）
- 将死：结束
- 无合法走法且未被将军：按和棋处理并结算（实现细节需用例验证）
- 重复局面/50 步规则等裁判细则：未明确覆盖，需按差异登记处理

## 6. 结算
- winner `chipsChange = pot`，其余 0
- 和棋：按实现返回结果为准（建议在测试矩阵中固化“和棋期望”）

## 7. 测试用例矩阵（摘要）
- 边界：易位合法/非法（路径被攻击、王车移动过等）；吃过路兵时序；升变
- 异常：非回合走子、越界、起点无棋子、吃己方
- 特殊：将军状态下的唯一解将；逼和（stalemate）结算
- 并发：同回合双端 move 幂等性

## 8. UI 动态适配要点（文字版设计稿）
- 拖拽/点击两段式走子；可落点提示；将军提示
- 历史回放：基于 moveHistory 的逐步回放

## 9. 性能指标与优化点
- 走法提示计算可能较重：前端按需请求/本地缓存提示层（占位）

## 10. 与通行规则差异（风险登记）
- 和棋相关裁判规则覆盖程度需用例验证并登记（见 [rules_research.md](file:///f:/C/rules_research.md#L171-L180)）

