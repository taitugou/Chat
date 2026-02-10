# 跑得快（paodekuai）规则说明书（可测版）

## 1. 概览
- 玩法类型：扑克（出牌对抗）
- 人数范围：2–4（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/paodekuai`
- 服务端实现： [paodekuai.js](file:///f:/C/backend/services/games/poker/paodekuai.js)
- 规则基线（实现摘要）：[gamerules.md](file:///f:/C/gamerules.md#L277-L286)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L95-L106)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10（开局每人投入，构成 pot）

## 3. 状态模型（GameState 摘要）
- 公开状态：`pot`、`currentPlayer`、`lastPlay`、`passCount`、`playerStatus`、`phase(playing/settled)`
- 私有信息：手牌通过 `game:hand` 单发

## 4. 动作与合法性校验
- `play`：payload `{ cardIds: string[] }`，必须当前回合，且牌型需能压过上家（炸弹可压制）
- `pass`：需要存在 `lastPlay` 且不能对自己过；全员过牌到阈值会清空 `lastPlay`
- `surrender`：直接结束（对手胜）

## 5. 牌型支持（实现口径）
以代码为准，当前可识别与比较的牌型包含：
- 单张 / 对子 / 三条
- 三带一 / 三带二
- 顺子 / 连对（不含 2）
- 炸弹

## 6. 终局与结算
- 终局：任一玩家手牌出完 / surrender
- 结算：winner `chipsChange = pot`，其余 0

## 7. 测试用例矩阵（摘要）
- 边界：2/4 人发牌；顺子/连对边界；“含 2 的顺子”拒绝
- 异常：出牌不在手牌中；`pass` 无 lastPlay；非回合动作
- 并发：多端重复出牌导致手牌一致性与幂等性

## 8. UI 动态适配要点（文字版设计稿）
- 手牌多选与“可压制提示”
- 出牌区显示上家牌型与张数；提供一键过牌/一键出最小可出（占位）

## 9. 性能指标与优化点
- 手牌渲染与交互高频，优先使用 transform/opacity 动画并限制重排

## 10. 与通行规则差异（风险登记）
- 当前为“可测版”：不含大量地区差异规则与计分（见 [rules_research.md](file:///f:/C/rules_research.md#L95-L106)）

