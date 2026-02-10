# 德州扑克（texas_holdem）规则说明书

## 1. 概览
- 玩法类型：扑克（公共牌）
- 人数范围：2–10（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/texas_holdem`
- 服务端实现： [texasHoldem.js](file:///f:/C/backend/services/games/poker/texasHoldem.js)
- 规则基线（实现摘要）：[gamerules.md](file:///f:/C/gamerules.md#L132-L155)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L13-L28)

## 2. 房间配置参数（room.settings.gameOptions）
当前实现未读取 `options`（构造函数不接收 options），因此以下参数为硬编码：
- `smallBlind=10`、`bigBlind=20`

## 3. 状态模型（GameState 摘要）
- 公开状态：`communityCards`、`pot`、`currentBet`、`phase(preflop/flop/turn/river)`、`playerBets`、`playerStatus(active/folded)`、`currentPlayer`、`dealerIndex`、`gameOver`
- 私有信息：`hands[userId]` 由服务端单发 `game:hand` 推送（见 [gameHandlers.js](file:///f:/C/backend/socket/gameHandlers.js#L67-L73)）

## 4. 动作与合法性校验
- 动作：`check / call / raise / fold`
- 回合约束：
  - 必须 `playerId === currentPlayer`
  - `playerStatus[playerId] === 'active'`
  - `gameOver === false`
- 下注约束：
  - `bet`/`call`/`raise` 最终投入额必须满足 `playerTotalContribution >= currentBet`
  - `raise` 会提升 `currentBet`，并清空本阶段行动集合（要求其他玩家重新响应）

## 5. 牌型与胜负判定（实现口径）
### 5.1 牌型评估
- 评估集合：每位玩家取 `2 手牌 + 5 公共牌` 共 7 张，枚举所有 5 张组合，取「rank 最大」的最佳组合。
- tie-break：当前实现仅按 `highCard` 比较，未做完整逐张比较（kicker 等）。

### 5.2 终局
- 若只剩 1 名 `active` 玩家：直接胜出（不摊牌）。
- river 后进入摊牌：评估所有 `active` 玩家最佳牌型，选出 winner。

## 6. 结算
- 奖池：`pot`
- 结果结构：`results[].chipsChange` 赢家为 `pot`，其余为 `0`；并记录 `totalSpent`

## 7. 测试用例矩阵（摘要）
- 边界
  - 2 人/10 人创建房间与开始流程
  - preflop 直接全弃只剩 1 人的快速结束
- 异常
  - 非当前玩家动作、重复动作、非法 raise 额度（负数/NaN）
  - 下注扣款失败（筹码不足）时服务端必须回滚房间状态为 waiting
- 特殊
  - board plays（公共牌构成最佳 5 张导致平局）：当前实现会硬选 winner
  - kicker 比较：同牌型但次高不同，当前实现可能误判
- 并发
  - 同回合多端连点 `call/raise/fold`，状态不能漂移，非法动作必须单发 `game:error`

## 8. UI 动态适配要点（文字版设计稿）
- 牌桌区域：公共牌（5）居中，底池/阶段在上方；玩家手牌在下方居中；其他玩家手牌背面环绕
- 下注操作区：check/call/raise/fold；raise 使用滑杆 + 快捷倍率（1/2 pot、pot、all-in 作为占位，后端未实现边池）
- 玩家状态面板：当前回合高亮、已弃牌灰化、下注额/本局累计投入展示

## 9. 性能指标与优化点
- 渲染：公共牌与玩家手牌组件按需渲染，隐藏玩家仅显示摘要（避免大列表重排）
- 动画：发牌/下注筹码使用 rAF 与 transform，避免 layout 抖动
- 网络：断线重连后需补发 `game:hand`（服务端已在 start 时单发；重连场景需专项用例）

## 10. 与通行规则差异（风险登记）
- 未实现平局分池、边池/All-in、完整 kicker 细则：见 [rules_research.md](file:///f:/C/rules_research.md#L13-L28)

