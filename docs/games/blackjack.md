# 21点（blackjack）规则说明书

## 1. 概览
- 玩法类型：扑克（庄家对局）
- 人数范围：2–7（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/blackjack`
- 服务端实现： [blackjack.js](file:///f:/C/backend/services/games/poker/blackjack.js)
- 规则基线（实现摘要）：[gamerules.md](file:///f:/C/gamerules.md#L207-L225)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L56-L68)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 20（开局每人投入，构成 pot）

## 3. 状态模型（GameState 摘要）
- 公开状态：`phase(player_turns/dealer_turn/settled)`、`pot`、`currentPlayer`、`playerStatus(active/busted/stand/...)`、`dealerReveal`
- 私有信息：玩家手牌 `hands[userId]` 与庄家手牌 `dealerHand`（庄家暗牌在结算时翻开）

## 4. 动作与合法性校验
- `hit`：要牌（仅 `phase=player_turns` 且当前回合玩家可用）
- `stand`：停牌（仅 `phase=player_turns` 且当前回合玩家可用）
- `double`：加倍（仅前两张牌时可用；追加 baseBet 投入；补 1 张牌后自动结束该玩家回合）

## 5. 点数与特殊规则（实现口径）
- A 计 1 或 11（按不爆牌最大化）
- Blackjack：两张牌点数=21
- 庄家规则：点数 < 17 必须要牌，>=17 停牌（soft 17 口径需通过用例验证）

## 6. 终局与结算
- 当所有玩家均结束其回合后进入庄家回合，随后结算
- 结算口径（chipsChange 为返还本金+赢额的合并值）：
  - 玩家胜：`chipsChange = bet * 2`（净 +bet）
  - push：`chipsChange = bet`（净 0）
  - 玩家负/爆牌：`chipsChange = 0`（净 -bet）
  - Blackjack：`chipsChange = floor(bet * 2.5)`（近似 3:2，取整）

## 7. 测试用例矩阵（摘要）
- 边界：A 多张组合（A+A+9 等）；double 前置条件；庄家 <17 连续要牌
- 异常：非回合 hit/stand/double；double 时筹码不足扣款一致性
- 并发：同回合多端重复 hit 导致发牌重复的幂等性

## 8. UI 动态适配要点（文字版设计稿）
- 玩家区：手牌摊开，点数即时显示（soft/hard 区分）
- 庄家区：暗牌遮罩，结算时翻牌动画
- 操作区：Hit / Stand / Double（Double 按钮在不可用时禁用并提示原因）

## 9. 性能指标与优化点
- 发牌动画使用 rAF 驱动的 transform；点数计算纯函数缓存（避免频繁重算）

## 10. 与通行规则差异（风险登记）
- 不含 split/投保等扩展；赔率/soft 17 细节存在平台差异（见 [rules_research.md](file:///f:/C/rules_research.md#L56-L68)）

