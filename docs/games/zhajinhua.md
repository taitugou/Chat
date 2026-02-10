# 炸金花（zhajinhua）规则说明书

## 1. 概览
- 玩法类型：扑克（3 张手牌）
- 人数范围：2–6（由 game_types 配置决定）
- 对局入口：`/game/room/:roomId/zhajinhua`
- 服务端实现： [zhajinhua.js](file:///f:/C/backend/services/games/poker/zhajinhua.js)
- 规则基线（实现摘要）：[gamerules.md](file:///f:/C/gamerules.md#L155-L190)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L29-L43)

## 2. 房间配置参数（room.settings.gameOptions）
以下参数由 `new ZhajinhuaGame(playerIds, options)` 读取：
- `baseBet:number`：基础注额，默认 10
- `ante:number`：底注（开局每人强制投入），默认 = baseBet
- `maxRaiseMultiplier:number`：加注上限倍率，默认 4（约束：`newBaseBet <= baseBet * maxRaiseMultiplier`）
- `compareCostMultiplier:number`：比牌成本倍率，默认 2（比牌扣费 = 单位注额 * compareCostMultiplier）
- `enable235:boolean`：是否启用 235 吃豹子，默认 true（传 false 关闭）
- `a23Rule:'low'|'second'`：A23 顺子比较口径，默认 `'low'`

## 3. 状态模型（GameState 摘要）
- 公开状态：`pot`、`baseBet`、`playerBets`、`playerStatus(active/folded/lost)`、`playerSeen`、`currentPlayer`、`gameOver`
- 私有信息：3 张手牌通过 `game:hand` 单发（开局即下发）

## 4. 动作与合法性校验
- `see`：看牌（不要求回合，但要求玩家为 active 且游戏未结束）
- `call`：跟注（必须当前回合；按“是否看牌”决定下注单位）
- `raise`：加注（必须当前回合；更新 `baseBet`；受倍率上限约束）
- `fold`：弃牌（必须当前回合）
- `compare`：比牌（必须当前回合；目标必须 active 且不是自己；扣费入池；牌小者置为 `lost`）

下注单位规则（实现口径）：
- 未看牌：单位下注 = `baseBet`
- 已看牌：单位下注 = `baseBet * 2`

## 5. 牌型与比较（实现口径）
### 5.1 牌型等级（从低到高）
单张 < 对子 < 顺子 < 金花（同花） < 同花顺 < 豹子（三条）

### 5.2 特殊规则
- 235 吃豹子（可选）：当一方为豹子，另一方为“杂色 2-3-5”（非顺子/非同花/非对子/非三条且三花色全不同）则 235 获胜。
- A23 顺子：
  - `a23Rule='low'`：A23 视为 3 高顺
  - `a23Rule='second'`：A23 视为特殊值 13.5（介于 A 高与 K 高之间）

### 5.3 同牌型 tie-break
- 单张 / 金花：按 3 张点数从大到小逐张比较
- 对子：先比对子点数，再比踢脚
- 顺子 / 同花顺：比顺子最高张（A23 按配置）
- 豹子：比三条点数

## 6. 终局与结算
- 终局：只剩 1 名 active 或显式进入 showdown
- 结算：winner `chipsChange = pot`，其余为 0；并记录 `totalSpent`

## 7. 测试用例矩阵（摘要）
- 边界：2 人最小开局、6 人满员、`baseBet` 极小/极大、`maxRaiseMultiplier` 边界（刚好上限/超上限）
- 异常：非当前回合 `call/raise/fold/compare`；对已出局玩家 compare；compare 自己
- 特殊：235 开/关；235 但同花/顺子/对子时不应触发；A23 两种口径的对比用例
- 并发：同回合双端重复 raise/compare，pot 与 baseBet 必须一致且不重复扣费

## 8. UI 动态适配要点（文字版设计稿）
- 牌型展示：显示自己的 3 张牌；他人牌背；展示“是否看牌”标记与本局累计投入
- 操作区：看牌/跟注/加注/弃牌/比牌；加注提供常用倍率按钮（x2/x3/x4）并显示上限
- 比牌交互：进入 compare 模式后在玩家列表中选择目标（当前对局页已有该交互）

## 9. 性能指标与优化点
- 下注与比牌动画使用 transform/opacity，避免频繁重排
- 动作记录列表限制条数并虚拟化（目前对局页已 slice）

## 10. 与通行规则差异（风险登记）
- 平局/分池未实现：相同手牌会硬选 winner
- 235 规则细节属于平台口径差异，需要与产品确认（见 [rules_research.md](file:///f:/C/rules_research.md#L29-L43)）

