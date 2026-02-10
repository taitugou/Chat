# 骰宝（touzi_bao）规则说明书（big/small/triple 简化盘）

## 1. 概览
- 玩法类型：其他（骰子投注）
- 人数范围：2–10
- 对局入口：`/game/room/:roomId/touzi_bao`
- 服务端实现： [diceBao.js](file:///f:/C/backend/services/games/other/diceBao.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L131-L140)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10（作为默认下注金额的参考；实际每位玩家下注金额由本次动作 payload 决定）

## 3. 状态模型（GameState 摘要）
- 公开状态：`phase(betting/rolling/settled)`、`currentPlayer`、`playerSelections`、`playerBets`、`pot`、`dice/result`

## 4. 动作与合法性校验
- `place_bet`：payload `{ selection:'big'|'small'|'triple', amount:number }`
  - 仅 betting 阶段；必须当前回合
  - 每位玩家一旦下注，会记录 `playerSelections[playerId]` 与 `playerBets[playerId]`
  - 全员下注后进入 rolling 阶段
- `roll`：开奖（仅座位 1 可发起；仅 rolling 阶段）
  - 掷 3 颗骰子，计算 outcome：豹子=triple，否则 sum 11–17 big，4–10 small

## 5. 赔率体系（实现口径）
当前实现不是固定赔率表，而是“输家筹码池分配”模型：
- 每位玩家本局投入为 `bet = amount`
- 把所有输家的 bet 汇总成 `loserPot`
- 将 `loserPot` 按赢家权重分配给赢家：
  - big/small 赢家权重 `w = bet * 1`
  - triple 赢家权重 `w = bet * 2`
- 返还口径：赢家 `payout = 自己bet + floor(loserPot * w / sumWinnersW)`（余数给 id 最小的赢家），输家 0，未下注为 push 返还本金

## 6. 终局与结算
- 开奖后立刻结算并结束
- `results[].chipsChange` 为每位玩家 payout；`totalSpent` 为 bet

## 7. 测试用例矩阵（摘要）
- 边界：多人不同金额下注；只有 1 个赢家/多个赢家；全员下注同一边导致“无赢家”分支
- 异常：非回合下注/负数下注/非法 selection；非座位 1 roll；未到 rolling 阶段 roll
- 并发：同回合重复下注幂等性；roll 重复触发只结算一次

## 8. UI 动态适配要点（文字版设计稿）
- 投注区：big/small/triple 三选一 + 金额输入 + 快捷金额（10/20/50/100）
- 开奖：3D 骰子动画（已有 Dice3D 组件可复用），开奖后展示 outcome 与 sum
- 历史轨迹：最近 N 局结果的 big/small/triple 序列（占位）

## 9. 性能指标与优化点
- 骰子动画建议基于 rAF；低端机降级为 2D sprite/简单旋转

## 10. 与通行规则差异（风险登记）
- 通行骰宝投注盘很丰富；当前仅实现 big/small/triple 且采用“输家池分配”而非固定赔率（见 [rules_research.md](file:///f:/C/rules_research.md#L131-L140)）

