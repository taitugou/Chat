# 全部玩法模式状态说明与传统对照检查（可转发）

本文基于当前仓库实现，对所有 `game_code`（共 18 个）做：
1) 运行态状态（`getGameState()`）字段精准说明  
2) 阶段（`phase`）/回合与动作（action）约束说明  
3) 与传统规则对照，标注不合逻辑点与风险等级（高/中/低）  

---

## 统一结算语义（非常关键）

后端结算/记账并不是“结算时扣输家钱”，而是：

- **开局**：根据游戏实例 `game.playerBets`，逐人扣筹码作为底注（底注/带入）。见 [gameHandlers.js](file:///f:/C/backend/socket/gameHandlers.js#L19-L66)  
- **过程中**：若某次 action 导致 `game.playerBets[userId]` 变大，则按增量继续扣“下注”。见 [gameHandlers.js](file:///f:/C/backend/socket/gameHandlers.js#L486-L497)  
- **结束时**：对每个玩家，只要 `chipsChange > 0` 就给玩家“加筹码”；同时记录 `netChange = chipsChange - totalSpent` 到 `game_player_records`。见 [finishGame](file:///f:/C/backend/socket/gameHandlers.js#L575-L620)  

因此：
- `results[].totalSpent`：该玩家本局已被扣走的总额（底注 + 下注增量）。  
- `results[].chipsChange`：结算时发回给玩家的“总返还/派奖金额”（包含返还本金的场景）。  
- 记账净输赢：`chipsChange - totalSpent`。  

**一致性要求**（否则会“凭空造筹码/凭空消失”）：
- 理想情况下：`Σ chipsChange == 总底池(pot/totalPot)`（允许舍入误差，但不应系统性超发）。  

---

## 玩法清单（权威来源）

后端默认游戏类型清单： [ensureGameTypes.js](file:///f:/C/backend/services/ensureGameTypes.js#L3-L23)  
运行时工厂映射： [gameFactory.js](file:///f:/C/backend/services/gameFactory.js#L19-L57)  

| game_code | 名称 | 人数 |
|---|---|---|
| texas_holdem | 德州扑克 | 2–10 |
| zhajinhua | 炸金花 | 2–6 |
| doudizhu | 斗地主 | 3 |
| shengji | 升级 | 4 |
| paodekuai | 跑得快 | 2–4 |
| blackjack | 21点 | 2–7 |
| sichuan_mahjong | 四川麻将 | 4 |
| guangdong_mahjong | 广东麻将 | 4 |
| guobiao_mahjong | 国标麻将 | 4 |
| ren_mahjong | 二人麻将 | 2 |
| xiangqi | 中国象棋 | 2 |
| weiqi | 围棋 | 2 |
| wuziqi | 五子棋 | 2 |
| international_chess | 国际象棋 | 2 |
| junqi | 军棋 | 2 |
| niuniu | 牛牛 | 2–10 |
| erbaban | 二八杠 | 2–8 |
| touzi_bao | 骰宝 | 2–10 |

---

## 扑克类（poker）

### texas_holdem（德州扑克）

- 实现： [texasHoldem.js](file:///f:/C/backend/services/games/poker/texasHoldem.js#L190-L465)
- phase：`preflop | flop | turn | river`（river 后 `endGame`）
- 状态（getGameState）字段含义：
  - `communityCards`：公共牌（0/3/4/5 张）
  - `phase`：阶段
  - `dealerIndex`：庄位索引（当前实现固定为 0，不轮转）
  - `currentPlayer`：当前行动玩家
  - `playerStatus`：`active | folded`
  - `playerBets`：当前阶段内每人已投入（每条街会被清零重算）
  - `currentBet`：当前需要匹配的投注额（每条街会归零）
  - `pot`：累计底池
  - `gameOver`：是否结束
- 动作/约束：
  - `bet(amount)`：本实现是“增量追加到自己本街投入”，内部要求 `投入后 >= currentBet`。见 [bet](file:///f:/C/backend/services/games/poker/texasHoldem.js#L262-L283)
  - `call()` / `raise(raiseAmount)` / `fold()` / `check()`
  - 只有 `currentPlayer` 且 `playerStatus=active` 可行动。见 [validateTurn](file:///f:/C/backend/services/games/poker/texasHoldem.js#L254-L260)
  - 当所有 active 玩家 `playerBets==currentBet` 且都行动过（phaseActions）时自动翻牌进入下一阶段。见 [shouldAdvancePhase](file:///f:/C/backend/services/games/poker/texasHoldem.js#L335-L341)
- 传统对照与不合逻辑点：
  - 高：**未实现边池/全下/筹码上限**（没有 stack 概念），多人下会出现与传统差异很大。  
  - 中：**胜负比较只用“牌型等级 + highCard”**，未做完整踢脚比较，多数平局/同型比较会错。见 [HandEvaluator.evaluate](file:///f:/C/backend/services/games/poker/texasHoldem.js#L57-L83)
  - 中：庄位 `dealerIndex` 不轮转（始终 0），与传统差异明显。  

### zhajinhua（炸金花）

- 实现： [zhajinhua.js](file:///f:/C/backend/services/games/poker/zhajinhua.js#L33-L287)
- phase：无（靠 `gameOver` 与 `currentPlayer` 驱动）
- 状态字段含义：
  - `pot`：底池
  - `currentBet`：当前“底注单位”（baseBet）
  - `playerSeen`：是否看牌（看牌后单位跟注翻倍）
  - `playerStatus`：`active | folded | lost`
  - `playerBets`：每人累计投入
  - `currentPlayer`：当前行动玩家
  - `activePlayers`：活跃人数
  - `allowCompare`：活跃人数>=2
- 动作/约束：
  - `see()`：看牌（不占回合）
  - `call()`：按单位注额投入（看牌×2）
  - `raise(newBaseBet)`：提高 baseBet（上限为 `maxRaiseMultiplier` 倍）并投入本次单位注额
  - `compare(targetId)`：比牌（额外支付 `compareCostMultiplier`×单位注额；输方淘汰）
  - `fold()`
- 传统对照与不合逻辑点：
  - 中：没有“轮数上限/强制开牌”机制，理论上可无限拖延（取决于玩家行为）。  
  - 低：A23 顺子规则与 235 吃豹子规则可配置，属于地方规则差异（实现里可开关）。  

### blackjack（21点）

- 实现： [blackjack.js](file:///f:/C/backend/services/games/poker/blackjack.js#L33-L320)
- phase：`player_turns | dealer_turn | settled`
- 状态字段含义：
  - `hands`：所有玩家手牌（服务器态）
  - `dealerHand`：庄家手牌（未揭示时第二张隐藏）
  - `dealerReveal`：是否已揭示
  - `playerStatus`：`active | stood | busted`
  - `playerBets`/`pot`/`baseBet`：下注与底池
  - `currentPlayer`：当前行动玩家（仅 player_turns 阶段有值）
- 动作/约束：
  - `hit | stand | double`（double 仅限两张牌时）
  - 轮到庄阶段自动补牌到 17+ 然后结算。见 [dealerPlay](file:///f:/C/backend/services/games/poker/blackjack.js#L182-L187)
- 传统对照与不合逻辑点：
  - 中：这是“多人共享底池 + 按输家池分配”的模型，不是赌场常见的“玩家各自对庄、庄家无限资金”模型；玩法可接受但应明确为“对赌/彩池制 21点”。见 [settle 分配](file:///f:/C/backend/services/games/poker/blackjack.js#L189-L299)
  - 中：未实现 split / insurance / surrender 等传统扩展规则。  

### doudizhu（斗地主）

- 实现： [doudizhu.js](file:///f:/C/backend/services/games/poker/doudizhu.js#L149-L333)
- phase：`bidding | playing | settled`
- 状态字段含义：
  - `landlordId`：地主
  - `bids`：叫分（0–3）
  - `currentPlayer`：当前出牌/叫分玩家
  - `lastPlay`：上一次有效出牌（含牌型信息）
  - `handsCount`：各玩家剩余手牌数量（不下发具体牌）
- 动作/约束：
  - `bid(points)`：叫分完成后，最高分成为地主并获得 3 张底牌。
  - `play(cardIds)`：校验牌型 + 能否压过上家
  - `pass()`：必须存在 `lastPlay` 且不能对自己 pass；当连续 pass 达到人数-1，会清空 lastPlay 重开一轮。  
- 传统对照与不合逻辑点：
  - 中：未实现倍数系统（炸弹/火箭翻倍、叫分倍数等），底池不会随倍数变化。  
  - 低：叫分并列时取座位靠前者为地主（规则差异）。  

### paodekuai（跑得快）

- 实现： [paodekuai.js](file:///f:/C/backend/services/games/poker/paodekuai.js#L95-L235)
- phase：`playing | settled`
- 状态字段含义：
  - `lastPlay`：上一次有效出牌（牌型）
  - `handsCount`：各玩家剩余手牌数量
- 动作/约束：
  - `play(cardIds)` / `pass()` / `surrender()`
- 传统对照与不合逻辑点：
  - 高：使用 52 张牌（无王）并“轮流发完”，玩家人数为 2/3/4 时每人手牌张数会与常见跑得快规则不一致（常见为固定张数/去牌）。见 [initializeGame 发牌](file:///f:/C/backend/services/games/poker/paodekuai.js#L126-L146)
  - 中：未实现“首出牌限制/黑桃三先出”等地方规则。  

### shengji（升级）

- 实现： [shengji.js](file:///f:/C/backend/services/games/poker/shengji.js#L33-L248)
- phase：`playing | settled`
- 状态字段含义：
  - `trumpSuit`/`trumpRank`：主花色/级牌（当前为 options 固定值）
  - `trick`：当前墩（只支持“每人出 1 张”）
  - `teamPoints`：按 5/10/K 计分
  - `tricksWon`：每人赢墩数
- 动作/约束：
  - `play(cardId)`：每次只出 1 张；支持跟花色/跟主的强制约束
- 传统对照与不合逻辑点：
  - 高：升级的核心是“成套牌型/拖拉机/甩牌/反主/扣底”等复杂规则；当前实现为“单张吃墩 + 简化主牌”，与传统差异很大（可视为“简化吃墩牌”）。  

---

## 麻将（mahjong）

### sichuan_mahjong / guangdong_mahjong / guobiao_mahjong / ren_mahjong（共用）

- 实现： [mahjong.js](file:///f:/C/backend/services/games/mahjong/mahjong.js#L120-L405)
- phase：`playing | settled`
- 状态字段含义：
  - `currentPlayer`：当前应出牌的玩家（实现内：弃牌后立即给下家“自动摸牌”）
  - `wallCount`：剩余牌墙数量
  - `lastDiscard`：最近一次弃牌 `{ playerId, tile }`
  - `handsCount`/`meldsCount`/`discardsCount`：只下发数量，不下发完整手牌
  - `turnCount`/`maxTurns`：回合计数与强制结算上限
- 动作/约束：
  - `discard(tileId)`：弃牌后下家自动摸一张；若其他人要“吃碰杠胡”，会尝试撤销这次自动摸牌。见 [undoLastAutoDrawIfNeeded](file:///f:/C/backend/services/games/mahjong/mahjong.js#L195-L206)
  - `hu()`：自摸胡（只校验基本 4 面子 1 将形态）
  - `ron()`：点炮胡（对 lastDiscard）
  - `chi()`：仅允许“下家吃”
  - `peng()` / `gang()`：对弃牌的明杠（不含暗杠/加杠）
  - `settle()`：到达 maxTurns 或手动结算时按简化评分决定赢家
- 传统对照与不合逻辑点：
  - 高：吃碰杠胡优先级/一炮多响/抢杠胡等未实现，且“弃牌后立刻自动摸牌”属于实现层面的简化，会导致边界行为与传统有差异。  
  - 中：胡牌判定与番型体系是简化版；四川/广东/国标差异无法完整体现。  
  - 中：`hu/ron` 里将 `result.score * 10` 直接加进 `pot`，与“筹码守恒”不一致（可能导致结算时 pot 与实际扣款不匹配）。见 [hu/ron](file:///f:/C/backend/services/games/mahjong/mahjong.js#L235-L265)

---

## 棋类（chess）

### xiangqi（中国象棋）

- 实现： [xiangqi.js](file:///f:/C/backend/services/games/chess/xiangqi.js#L238-L329)
- phase：`playing | settled`
- 状态字段含义：
  - `boardW=9` `boardH=10` `board`：棋盘矩阵（红方大写，黑方小写）
  - `redId`/`blackId`：先后手绑定（红=座位0）
  - `inCheck`：双方是否被将军
  - `moveCount`：走子次数
- 动作/约束：
  - `move({from,to})`：走法校验 + 不能送将 + 将帅不能照面 + 将杀检测。见 [move](file:///f:/C/backend/services/games/chess/xiangqi.js#L259-L307)
- 传统对照与不合逻辑点：
  - 低：无和棋规则（长将/重复/60回合等），属于功能缺失。  

### international_chess（国际象棋）

- 实现： [internationalChess.js](file:///f:/C/backend/services/games/chess/internationalChess.js#L310-L461)
- phase：`playing | settled`
- 状态字段含义：
  - `board`：8×8（白大写，黑小写）
  - `castlingRights`：王车易位权
  - `enPassant`：过路兵目标格
  - `inCheck`/`moveCount`
- 动作/约束：
  - `move({from,to})`：由 `generateLegalMoves` 生成合法走法（含升变为后、王车易位、吃过路兵）
- 传统对照与不合逻辑点：
  - 高：**僵局（stalemate）被判为“按子力决定胜负/甚至判胜”**，传统规则应为和棋。见 [enemyLegal.length===0 分支](file:///f:/C/backend/services/games/chess/internationalChess.js#L428-L434)
  - 中：无三次重复/50 步和/逼和等规则。  

### weiqi（围棋）

- 实现： [weiqi.js](file:///f:/C/backend/services/games/chess/weiqi.js#L59-L174)
- phase：`playing | settled`
- 状态字段含义：
  - `board`：默认 19×19，0 空，1 黑，2 白
  - `komi`：贴目（默认 6.5）
  - `passCount`：连续 pass 次数（>=2 触发结算）
  - `captureCount`：提子计数
  - `lastMove`
- 动作/约束：
  - `place(x,y)`：含打劫（简化 ko，仅与上一个局面比对）、禁入点（自杀）检查
  - `pass()`：两方连续 pass 结算
- 传统对照与不合逻辑点：
  - 高：结算只计算 `盘面棋子数 + 提子`，**未计算地盘（territory）**；与中日韩主流规则都不一致。见 [settle](file:///f:/C/backend/services/games/chess/weiqi.js#L138-L152)
  - 中：仅实现简单 ko（单劫），无超级劫等。  

### wuziqi（五子棋）

- 实现： [gomoku.js](file:///f:/C/backend/services/games/chess/gomoku.js#L2-L133)
- phase：无（仅 `gameOver`）
- 状态字段含义：`{ board, currentPlayer, gameOver }`
- 动作/约束：`move(x,y)`；连五即胜
- 传统对照与不合逻辑点：
  - 低：无禁手/三三等规则，属于规则简化。  
  - 中：底注固定为 100（不跟随 room/baseBet），与其他游戏不一致。见 [initializeGame](file:///f:/C/backend/services/games/chess/gomoku.js#L16-L31)

### junqi（军棋）

- 实现： [junqi.js](file:///f:/C/backend/services/games/chess/junqi.js#L53-L246)
- phase：`setup | playing | settled`
- 状态字段含义：
  - `ready`：双方是否完成布阵
  - `board`：5×12（红方大写/带前缀，黑方小写）
- 动作/约束：
  - `setup(placements)`：要求必须摆满 `requiredPieces`（15 枚）且只能摆在己方半场。见 [setup](file:///f:/C/backend/services/games/chess/junqi.js#L105-L153)
  - `move({from,to})`：一次仅走一格；按 rank 简化吃子；旗被吃即结束。见 [move](file:///f:/C/backend/services/games/chess/junqi.js#L155-L227)
- 传统对照与不合逻辑点：
  - 高：无铁路/行营/大本营等核心棋盘规则，属于“极简军棋”。
  - 修复：已把自动布阵从“只放 10 枚”修正为“按 requiredPieces 放满 15 枚”，避免自动开局时棋子数量与手动布阵规则不一致。见 [applyDefaultSetup](file:///f:/C/backend/services/games/chess/junqi.js#L80-L103)

---

## 其他（other）

### niuniu（牛牛）

- 实现： [niuniu.js](file:///f:/C/backend/services/games/other/niuniu.js#L53-L214)
- phase：`reveal | settled`
- 状态字段含义：
  - `bankerId`：庄家（默认座位 0）
  - `playerRevealed`：是否亮牌，全部亮牌自动结算
  - `hands`：所有人 5 张牌（当前实现会全量下发）
  - `playerBets`/`pot`：下注与底池
- 动作/约束：`reveal()`；庄家可 `settle()` 强制结算
- 传统对照与不合逻辑点：
  - 高：多人牛牛通常是“庄家对多家”，庄家需要足够资金覆盖多人输赢；否则会出现资金不守恒。
  - 修复：已把庄家底注调整为 `baseBet * (玩家数-1)`，并把庄家派奖改为“拿走剩余底池”，保证 **Σ chipsChange == pot**，避免凭空造筹码。见 [initializeGame/settle](file:///f:/C/backend/services/games/other/niuniu.js#L73-L189)

### erbaban（二八杠）

- 实现： [erbaban.js](file:///f:/C/backend/services/games/other/erbaban.js#L14-L112)
- phase：`rolling | settled`
- 状态字段含义：`rolled` 标记每个玩家是否已掷骰；全部掷完取最高分赢
- 动作/约束：`roll()`（按回合轮流掷）
- 传统对照与不合逻辑点：
  - 高：实现为“掷两骰比大小”，与常见二八杠（牌骨/牌型对庄）差异很大，可视为简化/另一个玩法。  

### touzi_bao（骰宝）

- 实现： [diceBao.js](file:///f:/C/backend/services/games/other/diceBao.js#L70-L238)
- phase：`betting | rolling | settled`
- 状态字段含义：
  - `playerSelections`：每人选择 `big|small|triple`
  - `playerBets`：每人下注金额
  - `dice/outcome`：开奖后公开
- 动作/约束：
  - `place_bet(selection, amount)`：按回合顺序逐个下注（不是倒计时同时下注）
  - `roll()`：仅座位 0 可开奖
- 传统对照与不合逻辑点：
  - 中：下注方式是“轮流下注”而非“同时下注+截止时间”，属于交互简化。  
