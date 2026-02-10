# 升级（shengji）规则说明书（可玩规则版）

## 1. 概览
- 玩法类型：扑克（4 人两队墩分）
- 人数范围：4（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/shengji`
- 服务端实现： [shengji.js](file:///f:/C/backend/services/games/poker/shengji.js)
- 规则基线（实现摘要）：[gamerules.md](file:///f:/C/gamerules.md#L287-L298)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L107-L118)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10（开局每人投入，构成 pot）
- `handSize:number`：每人发牌张数，默认 26（用于测试可缩短对局）
- `trumpSuit:string`：主花色，默认 `♠`
- `trumpRank:string`：主级牌点数，默认 `'2'`

## 3. 状态模型（GameState 摘要）
- 公开状态：`phase(playing/settled)`、`currentPlayer`、`trick[]`（当前墩）、`trickLeaderIndex`、`teamPoints`、`pot`
- 私有信息：手牌通过 `game:hand` 单发

## 4. 动作与合法性校验
- `play`：payload `{ cardId: string }`（当前实现按单张出牌推进“墩”）
- 回合约束：必须当前回合；且 `phase=playing` 且玩家 active
- 跟牌约束（摘要）：
  - 若首家出 TRUMP，后手有 TRUMP 必须跟主
  - 若首家出非主花色，后手有该花色的非主牌必须跟花色

## 5. 计分与胜负（实现口径）
- 赢墩：若本墩有人出 TRUMP，则 TRUMP 最大者赢；否则首家花色最大者赢；赢者先出下一墩
- 计分牌：5=5 分、10=10 分、K=10 分；赢墩累计到队伍 `teamPoints`
- 队伍：座位 1&3 为 A 队，座位 2&4 为 B 队

## 6. 终局与结算
- 终局：手牌耗尽后按队伍分数比较确定胜队
- 结算：pot 平均分给胜方两名玩家（chipsChange=pot/2）；败方 0

## 7. 测试用例矩阵（摘要）
- 边界：trumpSuit/trumpRank 组合；handSize 极小值；最后一墩结算
- 异常：有同花色不跟牌应拒绝；非回合出牌；cardId 不在手牌中
- 并发：同回合重复出牌幂等性；trick 状态一致性

## 8. UI 动态适配要点（文字版设计稿）
- 墩区：展示本墩 4 张牌与胜者高亮
- 主牌信息：明显展示主花色/主级牌
- 队伍分数：A/B 分数条与计分牌统计

## 9. 性能指标与优化点
- 手牌区高频交互，建议按花色/主牌分组渲染，减少重排

## 10. 与通行规则差异（风险登记）
- 当前为“可玩规则版”：不含抠底、亮主/反主、复杂甩牌与升级体系细则（见 [rules_research.md](file:///f:/C/rules_research.md#L107-L118)）

