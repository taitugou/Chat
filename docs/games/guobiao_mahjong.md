# 国标麻将（guobiao_mahjong）规则说明书（最小可测实现）

## 1. 概览
- 玩法类型：麻将
- 人数范围：4（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/guobiao_mahjong`
- 服务端实现： [mahjong.js](file:///f:/C/backend/services/games/mahjong/mahjong.js) 、[scorer.js](file:///f:/C/backend/services/games/mahjong/scorer.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L119-L130)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10
- `maxTurns:number`：默认 60

## 3. 规则说明（实现口径）
国标麻将（MCR）在通行规则下有严格番种与起和要求，但当前仓库实现为“最小可测版”：
- 提供摸打、吃碰杠、最基础胡牌判定与强制结算
- 不覆盖完整的 MCR 番种与计分体系

## 4. 动作与流程
- `discard` 后自动摸牌推进回合
- `hu / ron / chi / peng / gang` 以 `lastDiscard` 为中心（并发仲裁需专项测试）
- `settle / surrender` 作为兜底结束路径

## 5. 流局与结算
- 牌墙耗尽或 `maxTurns` 触发强制结算

## 6. 测试用例矩阵（摘要）
- 多家同时可操作的并发（尤其点炮胡/碰/杠）必须稳定且不出现“双赢”
- 非法 tileId、越权动作、重复动作均应 `game:error` 且不推进状态

## 7. UI 动态适配要点（文字版设计稿）
- “番种/番数计算器”以占位呈现，并明确为最小可测实现
- 手牌/副露/弃牌区布局与动效统一

## 8. 与通行规则差异（风险登记）
- 当前实现不等同于完整国标规则（见 [rules_research.md](file:///f:/C/rules_research.md#L119-L130)）

