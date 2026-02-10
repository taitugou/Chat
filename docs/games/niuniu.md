# 牛牛（niuniu）规则说明书（基础版）

## 1. 概览
- 玩法类型：扑克（5 张比牌，庄家对比）
- 人数范围：2–10（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/niuniu`
- 服务端实现： [niuniu.js](file:///f:/C/backend/services/games/other/niuniu.js)
- 规则基线（实现摘要）：[gamerules.md](file:///f:/C/gamerules.md#L226-L240)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L69-L81)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 20（开局每人投入，构成 pot）

## 3. 状态模型（GameState 摘要）
- 公开状态：`phase(reveal/settled)`、`bankerId`、`playerRevealed`、`pot`、`gameOver`
- 私有信息：每人 5 张手牌通过 `game:hand` 单发

## 4. 动作与合法性校验
- `reveal`：亮牌（玩家主动确认；不限制回合；全部亮牌后自动结算）
- `settle`：强制结算（用于超时/测试兜底）

## 5. 牌型计算（实现口径）
- 从 5 张牌中选任意 3 张，使点数和为 10 的倍数 ⇒ “有牛”
- 剩余 2 张点数和 %10 ⇒ 牛几（0 记作 牛牛=10）
- 若不存在满足条件的 3 张组合 ⇒ 无牛（0）

比较规则（摘要）：
- 先比牛值（0–10）
- 牛值相同按最大单牌点数比较（更细花色/扩展牌型未覆盖）

## 6. 终局与结算
- 庄家：固定为 `playerIds[0]`
- 结算：逐个与庄家对比
  - 闲家赢：`chipsChange = bet * 2`
  - 平局：`chipsChange = bet`
  - 闲家输：`chipsChange = 0`
  - 庄家 payout 在实现中按“庄家本金 + 庄家净输赢 + 庄家本金”计算并做下限截断（建议用例验证资金守恒）

## 7. 测试用例矩阵（摘要）
- 边界：暴力枚举 5 张组合校验牛值（无牛/有牛/牛牛）；同牛值 tie-break
- 异常：重复 reveal；非 active 玩家 reveal；结算前强制 settle
- 并发：多人同时 reveal，必须只结算一次且结果一致

## 8. UI 动态适配要点（文字版设计稿）
- 亮牌提示：手牌区域显示“推荐成牛拆分”（占位，可后续做算法提示）
- 庄家标识：头像“庄”徽标；结算时逐个飞筹码动画

## 9. 性能指标与优化点
- 牛值计算可缓存（同一手牌多次渲染复用结果），避免组合枚举反复执行

## 10. 与通行规则差异（风险登记）
- 未实现五花牛/炸弹牛/五小牛等扩展牌型与倍率体系（见 [rules_research.md](file:///f:/C/rules_research.md#L69-L81)）

