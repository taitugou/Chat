# 斗地主（doudizhu）规则说明书（可测版）

## 1. 概览
- 玩法类型：扑克（出牌对抗）
- 人数范围：3（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/doudizhu`
- 服务端实现： [doudizhu.js](file:///f:/C/backend/services/games/poker/doudizhu.js)
- 规则基线（实现摘要）：[gamerules.md](file:///f:/C/gamerules.md#L255-L276)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L82-L94)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10（开局每人投入，构成 pot）

## 3. 状态模型（GameState 摘要）
- 公开状态：`phase(bidding/playing/settled)`、`pot`、`currentPlayer`、`landlordId`、`bids`、`lastPlay`、`passCount`、`playerStatus`
- 私有信息：各玩家手牌通过 `game:hand` 单发；服务端内部以 `hands[userId]` 保存

## 4. 动作与合法性校验
- `bid`（叫分）：payload `{ points: 0|1|2|3 }`
  - 仅 `phase=bidding` 且当前回合可用
  - 每人只能叫一次；全部叫完后最高分为地主并获得 3 张底牌
- `play`（出牌）：payload `{ cardIds: string[] }`
  - 仅 `phase=playing` 且当前回合可用
  - `cardIds` 必须都在自己手牌中；牌型必须可识别且能压过上家（或为炸弹/王炸）
- `pass`（过牌）
  - 仅 `phase=playing` 且当前回合可用
  - 要求存在 `lastPlay` 且不能对自己过牌
  - 当 `passCount >= players-1` 时清空 `lastPlay`，重新由下一家自由出牌
- `surrender`：直接结束（对手胜）

## 5. 牌型支持（实现口径）
实现目前支持的可识别牌型（以代码为准）：
- 单张 / 对子 / 三条
- 三带一 / 三带二
- 顺子（>=5 张，不含 2/王）
- 连对（>=3 对，不含 2/王）
- 飞机 / 飞机带单 / 飞机带对（不含 2/王）
- 四带二（两单）/ 四带两对
- 炸弹（四张同点）
- 王炸（大小王）

比较规则（摘要）：
- 王炸 > 炸弹 > 其他
- 其他牌型要求 `type` 与 `length` 一致，比较 `main` 点数大小

## 6. 终局与结算
- 终局：任一玩家手牌出完 / surrender
- 结算：winner `chipsChange = pot`，其余 0（当前无倍数、春天等扩展）

## 7. 测试用例矩阵（摘要）
- 边界：叫分 0/3；地主底牌合并后排序；顺子边界（A2345 / 10JQKA）与“含 2/王应拒绝”
- 异常：出牌不在手牌中；`pass` 无 lastPlay；对自己 pass；非回合动作
- 特殊：炸弹压制；王炸压制；飞机带牌数量不匹配；四带二类型区分
- 并发：多端同时 `play` 导致手牌重复扣除的幂等性校验

## 8. UI 动态适配要点（文字版设计稿）
- 手牌选择：支持多选、按牌型自动分组提示（至少提示“当前选择牌型/是否可出”）
- 出牌区：显示上家牌型与张数；自己的出牌按钮（出牌/不出/认输）
- 地主标识：头像旁显示“地主”，底牌（3 张）在叫分结束后闪现动画

## 9. 性能指标与优化点
- 手牌区用虚拟列表/分行渲染（移动端避免一次性渲染 20+ 张导致卡顿）

## 10. 与通行规则差异（风险登记）
- 当前为“可测版”：不含倍数、春天、明牌等扩展（见 [rules_research.md](file:///f:/C/rules_research.md#L82-L94)）

