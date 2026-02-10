# 二人麻将（ren_mahjong）规则说明书（最小可测实现）

## 1. 概览
- 玩法类型：麻将（2 人）
- 人数范围：2（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/ren_mahjong`
- 服务端实现： [mahjong.js](file:///f:/C/backend/services/games/mahjong/mahjong.js) 、[scorer.js](file:///f:/C/backend/services/games/mahjong/scorer.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L119-L130)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10
- `maxTurns:number`：默认 60

## 3. 动作与流程（实现口径）
- `discard` 后自动摸牌推进回合
- 支持 `hu / ron / chi / peng / gang`，但二人玩法下部分动作（如 chi）在通行规则中可能有差异，需以实现为准并纳入差异登记
- `settle / surrender` 作为兜底结束路径

## 4. 流局与结算
- 牌墙耗尽 / maxTurns / 强制 settle

## 5. 测试用例矩阵（摘要）
- 二人对局的动作窗口：点炮胡与“自动摸牌撤销”逻辑一致性
- 非法 tileId、非回合弃牌、重复动作幂等性

## 6. UI 动态适配要点（文字版设计稿）
- 手牌区域更大、弃牌区更紧凑；二人视角可采用对称布局（上下对坐）

## 7. 与通行规则差异（风险登记）
- 当前实现为“最小可测实现”，并非特定二人麻将流派的完整规则

