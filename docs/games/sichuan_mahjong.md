# 四川麻将（sichuan_mahjong）规则说明书（最小可测实现）

## 1. 概览
- 玩法类型：麻将
- 人数范围：4（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/sichuan_mahjong`
- 服务端实现： [mahjong.js](file:///f:/C/backend/services/games/mahjong/mahjong.js) 、[scorer.js](file:///f:/C/backend/services/games/mahjong/scorer.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L119-L130)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10（开局每人投入，构成 pot）
- `maxTurns:number`：回合上限，默认 60（达到后走强制结算）

## 3. 状态模型（GameState 摘要）
- 公开状态：`pot`、`currentPlayer`、`discards`、`melds`、`lastDiscard`、`turnCount`、`tilesRemaining`（隐含于牌墙长度）等
- 私有信息：手牌 `hands[userId]` 通过 `game:hand` 单发（麻将属于“全私有”，前端通常只展示自己的手牌）

## 4. 动作与合法性校验
- `discard`：payload `{ tileId }`（仅当前回合；tileId 必须在手牌中）
- `hu`：自摸胡（当前回合；基于最基础 4 面子+1 对判定）
- `ron`：点炮胡（对 `lastDiscard`；不能对自己弃牌胡）
- `peng` / `chi` / `gang`：对 `lastDiscard` 的吃碰杠（实现存在“时序窗口”与并发冲突风险，需用例覆盖）
- `settle`：强制结算（用于超时/测试）
- `surrender`：认输结束

出牌后自动摸牌（实现行为）：
- 当前玩家弃牌后，服务端会立即为下家自动摸一张并推进回合。
- 为支持点炮胡/吃碰杠，服务端在部分动作前会尝试撤销该次“自动摸牌”（见 [mahjong.js](file:///f:/C/backend/services/games/mahjong/mahjong.js#L195-L206)）。

## 5. 胡牌与计分（实现口径）
- 胡牌判定：`canHu(hand)` 为最小可测版（不覆盖四川完整番种体系）
- 番数：四川玩法会以 `MahjongScorer('sichuan')` 计算（具体番种覆盖程度以实现为准）
- 番数对 pot 的影响：胡牌时 `pot += score * 10`（作为倍数化的简化模型）

## 6. 流局与结算
- 牌墙耗尽：流局结束
- `turnCount >= maxTurns`：触发强制结算
- 结算：当前实现会选出 winner 并结束（详细结构以返回结果为准）

## 7. 测试用例矩阵（摘要）
- 边界：牌墙耗尽；maxTurns 触发；庄家 14 张与闲家 13 张
- 异常：弃牌不在手牌；非回合弃牌；对自己弃牌 ron
- 特殊：多人同时可碰/杠/胡同一张弃牌的并发冲突（必须保证只允许一个动作生效或明确仲裁规则）
- 并发：快速连点 discard 与 chi/peng/gang/ron 的状态一致性

## 8. UI 动态适配要点（文字版设计稿）
- 手牌排列算法：根据屏幕宽度动态换行/缩放；选中牌上浮
- 吃碰杠特效：meld 区域动画插入；可点击查看明牌组
- 胡牌提示：当 `canHu` 满足时高亮“胡/自摸”按钮；番数计算器作为占位（当前实现为最小可测）

## 9. 性能指标与优化点
- 手牌与弃牌区 DOM 数量较大：建议合并图层、使用 CSS contain 与按需渲染历史弃牌

## 10. 与通行规则差异（风险登记）
- 地方麻将规则差异巨大；当前实现为“最小可测实现”，不等同于完整四川麻将（见 [rules_research.md](file:///f:/C/rules_research.md#L119-L130)）

