# 二八杠（erbaban）规则说明书（掷骰比较简化版）

## 1. 概览
- 玩法类型：其他（掷两骰比大小）
- 人数范围：2–8（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/erbaban`
- 服务端实现： [erbaban.js](file:///f:/C/backend/services/games/other/erbaban.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L141-L150)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10（开局每人投入，构成 pot）

## 3. 状态模型（GameState 摘要）
- 公开状态：`phase(rolling/settled)`、`currentPlayer`、`rolled{pid:boolean}`、`pot`、`baseBet`、`gameOver`
- 私有信息：无（掷骰结果在结算时进入 results）

## 4. 动作与合法性校验
- `roll`：掷两骰（仅 rolling 阶段；必须当前回合；每人只能 roll 一次）
- `surrender`：认输结束（当前回合可用）

## 5. 结果比较（实现口径）
每位玩家掷出 `(d1,d2)`，计算得分 `score`：
- 特殊最大牌：2 和 8 组合（不分顺序）为最大（rank=1000）
- 其次：对子（rank=500+...）
- 其余：按点数和与高点组合生成 rank（用于比较）

## 6. 终局与结算
- 全员 roll 后自动结算：rank 最大者胜
- 结算：winner `chipsChange = pot`，其余 0；results 附带每位玩家的掷骰与 score

## 7. 测试用例矩阵（摘要）
- 边界：28 最大、对子次之、普通点数组合排序；多人同时结束
- 异常：非回合 roll；重复 roll；未全员 roll 时手动触发 settle（当前无 settle 动作）
- 并发：同回合双端 roll 幂等性

## 8. UI 动态适配要点（文字版设计稿）
- 掷骰按钮按回合启用；掷骰动画完成后锁定
- 结果面板展示：每位玩家 `(d1,d2)` 与牌面等级（28/对子/点数）

## 9. 性能指标与优化点
- 骰子动画与结果列表渲染解耦；动画帧率自适应

## 10. 与通行规则差异（风险登记）
- 当前实现为简化比较模型，不含庄家/抽水/门位/赔率体系等平台玩法（见 [rules_research.md](file:///f:/C/rules_research.md#L141-L150)）

