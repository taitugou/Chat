# 广东麻将（guangdong_mahjong）规则说明书（最小可测实现）

## 1. 概览
- 玩法类型：麻将
- 人数范围：4（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/guangdong_mahjong`
- 服务端实现： [mahjong.js](file:///f:/C/backend/services/games/mahjong/mahjong.js) 、[scorer.js](file:///f:/C/backend/services/games/mahjong/scorer.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L119-L130)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10
- `maxTurns:number`：默认 60

## 3. 状态模型（GameState 摘要）
- 公开状态：`pot`、`currentPlayer`、`discards`、`melds`、`lastDiscard`、`turnCount`
- 私有信息：`hands[userId]`（单发）

## 4. 动作与合法性校验
- `discard / hu / ron / chi / peng / gang / settle / surrender`
- 出牌后自动摸牌与“撤销自动摸牌”逻辑：见 [mahjong.js](file:///f:/C/backend/services/games/mahjong/mahjong.js#L195-L206)

## 5. 胡牌与计分（实现口径）
- 胡牌判定为最小可测版（不覆盖广东完整番种体系）
- 计分器模式：非四川玩法走 `MahjongScorer('standard')`

## 6. 流局与结算
- 牌墙耗尽 / maxTurns 触发 / 强制 settle

## 7. 测试用例矩阵（摘要）
- 行为窗口与并发冲突：多人同时可吃碰杠胡的仲裁必须稳定
- 非法 tileId、非回合动作、重复动作不推进状态

## 8. UI 动态适配要点（文字版设计稿）
- 手牌缩放与分区（手牌/副露/弃牌/牌河）
- “可操作按钮”严格按 canAct 与动作窗口控制启用

## 9. 性能指标与优化点
- 弃牌历史按需渲染，避免长局导致列表过大

## 10. 与通行规则差异（风险登记）
- 当前实现为“最小可测实现”，不等同于完整广东麻将规则（见 [rules_research.md](file:///f:/C/rules_research.md#L119-L130)）

