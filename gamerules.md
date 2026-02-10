# TTG Chat 游戏规则文档
文档版本：v0.1.0  
关联应用版本：ttg-chat v1.0.0（见根目录 package.json）  
最后更新：2026-02-08  
覆盖范围：游戏大厅/房间/对局（筹码结算、语音与局内聊天、断线重连、记录与排行）  
实现溯源：backend/services、backend/socket、frontend/src/views（以当前仓库实现为准）

---

## 0. 术语与实体
- 用户：注册登录后的玩家身份（userId）。
- 游戏类型：game_types 表中的一条记录（gameTypeId），包含 code（gameCode）、人数限制、分类等。
- 房间：game_rooms 表中的一条记录（roomId / room_code），承载一局或多局对局。
- 房主：room.creator_id。仅房主可开始游戏。
- 房间玩家：game_room_players 表记录（seat_number、is_ready、is_online 等）。
- 对局：game_records 表的一条记录（gameId）。开始对局时创建，结束时置为 finished 并写入玩家记录。
- 筹码：game_chips.balance，为游戏模块内部的通用资源；下注/底注/买入等会扣除，结算会增加。
- 奖池：pot / totalPot。含义随具体游戏实现而定；在结算时用于计算赢家 chipsChange（派奖）与玩家净输赢。

## 1. 核心循环（Core Loop）
1. 选择游戏类型（game_types）
2. 创建或加入房间（game_rooms / game_room_players）
3. 房间内：准备（is_ready）、语音加入、局内聊天
4. 房主手动开始对局：服务端创建 gameId、初始化对局状态、扣除底注/买入
5. 对局进行：客户端通过 Socket 发送动作，服务端校验回合/合法性并广播最新公开状态
6. 对局结束：服务端结算筹码、写入对局记录与玩家记录、房间状态回到 waiting、全员准备重置

## 2. 游戏类型（定义 vs 实现）
系统会在数据库中确保存在一批默认游戏类型（共 18 个 gameCode）。当前仓库对这 18 个 gameCode 均提供了对应的服务端对局实现（由 gameFactory 显式映射到具体游戏类），未在这 18 个默认列表中的新 gameCode 才会走占位实现（GenericGame）。

实现覆盖的 gameCode（按默认游戏类型清单）：
- texas_holdem：德州扑克
- zhajinhua：炸金花
- doudizhu：斗地主
- shengji：升级
- paodekuai：跑得快
- blackjack：21点
- sichuan_mahjong：四川麻将
- guangdong_mahjong：广东麻将
- guobiao_mahjong：国标麻将
- ren_mahjong：二人麻将
- xiangqi：中国象棋
- weiqi：围棋
- wuziqi：五子棋
- international_chess：国际象棋
- junqi：军棋
- niuniu：牛牛
- erbaban：二八杠
- touzi_bao：骰宝

注意：不同游戏的规则完整度不同，部分玩法属于“可测/可玩版本”，与通行规则存在差异；差异与风险点请结合 rules_research.md 与各游戏章节的“已知规则缺口”条目进行测试与验收。

## 3. 房间规则（Room Rules）
### 3.1 创建房间
- 校验 gameTypeId 必须存在且 is_active=true。
- maxPlayers 必须落在游戏类型的人数限制 [min_players, max_players] 内。
- 房间名长度限制：2–20 字符。
- 筹码限制：minBet/maxBet 需为有效数字；maxBet>0 时必须满足 minBet ≤ maxBet。
- 房间初始状态：waiting；创建者自动成为房主，并作为 1 号座位加入房间。
- permission：默认 public；若为 approval 则禁止直接加入（需要房主同意，但当前实现为直接拒绝加入，并未实现审批流程）。
- password：可选；存在时加入必须提供正确密码。

### 3.2 加入/离开与重连
- 加入允许的房间状态：waiting 或 playing（closed 明确拒绝）。
- 重连：若用户已在房间玩家表中存在记录，则视为重连，服务端将 is_online 置为 true，并清除 empty_at 标记。
- 新加入：
  - 满员拒绝
  - permission=approval 直接拒绝（作为“需审批”的占位行为）
  - 密码不匹配拒绝
  - seat_number 分配为最小可用正整数（按 1,2,3... 填坑）
  - current_players 使用 COUNT(*) 强制同步，降低并发计数误差
- 离开：
  - 会删除 game_room_players 中该玩家记录
  - 若房间空：设置 empty_at=NOW，room.status 重置为 waiting，current_players=0
  - 若房主离开：随机指定新的房主（owner_changed 广播）
  - 若房间存在正在进行的对局：服务端会尝试为离开者执行 fold（扑克）或 surrender（棋类）以避免僵局

### 3.3 房间状态机
- waiting：等待中，可准备/开始
- playing：游戏中，对局已启动
- closed：关闭，不允许加入（实际出现与置位逻辑依赖管理接口）

### 3.4 无操作超时（前端行为）
- 前端房间页存在“10 分钟无操作自动退出房间”的计时器；这是客户端侧保护逻辑，服务端不强制执行。

### 3.5 房间清理（服务端定时）
- 服务端存在定时清理服务：按 empty_at（空房间）与 last_active_at（闲置房间）TTL 删除房间记录。
- 默认 TTL 为 24 小时；代码注释中出现“6 小时后清理”的描述，属于实现与注释不一致的风险点，应纳入测试关注项。

## 4. 多人同步与冲突处理（Socket Rules）
### 4.1 权威性与一致性原则
- 服务端为权威状态源：客户端只发送意图（action + payload），服务端校验并广播结果。
- 冲突/非法操作：服务端抛错并给触发者单发 game:error（不会广播到全房间）。
- 状态同步：
  - game:state_update：广播公开局面
  - game:hand：单发私有手牌（扑克类）

### 4.2 关键事件列表（概要）
| 方向 | 事件 | 目的 | 主要字段（摘要） |
|---|---|---|---|
| C→S | game:join_room | 进入房间的 Socket 房间频道 | roomId |
| C→S | game:leave_room | 离开房间并清理语音 | roomId |
| C→S | game:player_ready | 设置准备状态 | roomId, isReady |
| C→S | game:start | 房主手动开始对局 | roomId |
| C→S | game:action | 对局动作（统一入口） | roomId, action, payload |
| C→S | game:chat | 局内聊天 | roomId, message, messageType |
| C→S | game:voice:* | 语音加入/离开/信令 | roomId, toId, type, signal |
| S→C | game:started | 对局开始 | gameId, roomId, gameType, gameState |
| S→C | game:state_update | 公开局面同步 | roomId, gameState |
| S→C | game:hand | 私有手牌 | roomId, hand |
| S→C | game:player_action | 动作广播（日志） | userId, action, payload, currentPlayer |
| S→C | game:player_bet | 本次扣筹码量广播 | userId, amount |
| S→C | game:finished | 结算广播 | gameId, winnerId, results, totalPot |
| S→C | game:error | 错误提示（单发） | error |

## 5. 通用资源：筹码/借贷/签到
### 5.1 筹码（game_chips）
- addChips：增加余额并写入 chip_transactions（正数 amount）。
- deductChips：扣减余额并写入 chip_transactions（流水金额为负数），余额不足会抛错“筹码不足”。
- 对局开始时：会按 game.playerBets 里的初始下注/买入逐一扣除（标记为 GAME_LOSS，描述“底注”）。
- 对局进行中：每次动作后如果玩家本局累计下注增加，会按差值继续扣除（标记为 GAME_LOSS，描述“下注”）。
- 对局结束时：赢家 chipsChange>0 的会 addChips（标记为 GAME_WIN，描述“游戏胜利”）；随后写入 game_player_records，记录净变化 netChange = chipsChange - totalSpent。

### 5.2 局内借贷（loanService）
- 客户端可在对局内发起借贷请求（game:loan），服务端会创建 loan 记录并广播 game:player_loan。
- 借贷规则（额度、利息、是否允许在下注不足时借贷等）属于经济系统规则，需要在后续测试中重点做边界与风控验证。

### 5.3 每日签到（checkin）
- 签到奖励：基础 1000；连续天数每 +1 天奖励 +200（从第 2 天开始计增量）。
- 同一天重复签到会失败（“今日已签到”）。

## 6. 游戏规则：德州扑克（texas_holdem）
### 6.1 基本设定
- 手牌：每人 2 张，公共牌最多 5 张（flop 3 + turn 1 + river 1）。
- 盲注：小盲 10，大盲 20。
- 阶段：preflop → flop → turn → river → 结算。
- 公开状态（对全房间可见）：communityCards、pot、currentBet、phase、playerBets、playerStatus、currentPlayer、dealerIndex、gameOver。
- 私有信息：每位玩家手牌通过 game:hand 单发。

### 6.2 动作与回合
- 动作：check / call / raise / fold（以及内部的 bet 路径）。
- 回合合法性：必须是 currentPlayer；且 playerStatus=active；gameOver=false。
- 下注匹配推进：当所有 active 玩家都已行动且其 playerBets 均等于 currentBet 时，推进到下一阶段并重置阶段行动集合。

### 6.3 胜负与结算
- 若只剩 1 名 active（其余 folded）：该玩家直接胜出（不进入摊牌）。
- river 后进入摊牌：
  - 每位 active 玩家取 7 张牌（2 手牌 + 5 公共牌）组合评估最优 5 张牌。
  - 胜者按 rank 与 highCard 比较选出。
- 已知规则缺口（实现层面限制，需测试验证并决定是否修复）：
  - 平局/分池未实现
  - 边池（side pot）与 all-in 逻辑未实现
  - 同 rank 时仅按 highCard 比较，未覆盖 kicker 等完整细则

## 7. 游戏规则：炸金花（zhajinhua）
### 7.1 基本设定
- 每人 3 张牌。
- 初始注额：baseBet 默认 10；底注 ante 默认等于 baseBet。
- 开局：所有玩家先下 ante 入池。
- 玩家状态：active / folded / lost（比牌失败）。
- 公开状态：pot、currentBet(=baseBet)、playerBets、playerStatus、playerSeen、currentPlayer、gameOver、activePlayers、allowCompare。
- 私有信息：每位玩家手牌通过 game:hand 单发；看牌行为只改变 playerSeen（不自动推送手牌，手牌在开局已发送）。

### 7.2 动作与规则
- see：看牌（不要求回合，但要求玩家 active 且未结束）。
- call：跟注，下注单位 = baseBet（未看牌）或 baseBet*2（已看牌）。
- raise：加注，传入 newBaseBet 必须：
  - newBaseBet > baseBet
  - newBaseBet ≤ baseBet * maxRaiseMultiplier（默认 4）
  - 加注后，本次仍按“玩家当前是否看牌”决定下注单位（baseBet 或 baseBet*2），并推进到下一位。
- fold：弃牌，置为 folded 并推进回合。
- compare：比牌（只能在自己回合发起）：
  - 目标必须为 active 且不能是自己
  - 消耗 cost = 下注单位 * compareCostMultiplier（默认 2）并入池
  - 牌小的一方置为 lost

### 7.3 牌型大小与特殊规则
- 牌型从低到高：单张 < 对子 < 顺子 < 金花(同花) < 同花顺 < 豹子(三条)。
- 特殊：235 吃豹子（enable235 默认开启）
  - 若一方为豹子，另一方为“杂色 2-3-5”（非顺子/同花/对子），则 235 获胜。
- A23 顺子处理：
  - a23Rule='low'：A23 视为 3 高顺
  - a23Rule='second'：A23 视为介于 A 高与 K 高之间的特殊比较值（实现返回 13.5）

### 7.4 胜负与结算
- 只剩 1 名 active 或显式触发结束：winnerId 获得 pot。
- 已知规则缺口（需测试验证并决定是否修复）：
  - 平局/分池未实现
  - “看牌后是否可回看手牌 UI/重连补发”依赖前端实现细节，需要用例覆盖

## 8. 游戏规则：五子棋（wuziqi）
### 8.1 基本设定
- 棋盘：15x15。
- 先手/后手：currentPlayerIndex=0 先手（黑），=1 后手（白）。
- 初始买入：每人固定 100（写入 playerBets/playerTotalSpent），开局会被统一扣除为“底注”。

### 8.2 动作与回合
- move：落子（需要在自己回合；坐标必须为 0–14；落点必须为空）。
- surrender：认输（判对手胜）。
- 胜利判定：最后落子点向 4 个方向统计连续同色棋子数，任一方向 count≥5 即胜。

### 8.3 结算
- totalPot = 所有玩家 playerBets 之和（默认 200）。
- 胜者 chipsChange=totalPot，败者 0。
- 写入战绩时记录净变化：netChange = chipsChange - totalSpent（败者通常为 -100，胜者为 +100）。

## 9. 游戏规则：21点（blackjack）
### 9.1 基本设定
- 每位玩家 2 张起手，庄家 2 张（1 张暗牌，结算时翻开）。
- 默认底注：每人 baseBet=20（写入 playerBets/playerTotalSpent，开局统一扣除）。
- 阶段：player_turns → dealer_turn → settled。

### 9.2 动作与回合
- hit：要牌（仅当前玩家回合可用）；点数>21 爆牌并自动结束该玩家回合。
- stand：停牌（仅当前玩家回合可用）；进入下一位玩家，所有玩家结束后进入庄家回合。
- double：加倍（仅前两张牌时可用）；追加 baseBet 下注并自动要 1 张牌，然后强制停牌/爆牌结算回合。

### 9.3 庄家规则与结算
- 庄家要牌规则：点数 < 17 必须要牌，>=17 停牌。
- 结算（筹码回收+派奖合并为 chipsChange）：
  - 玩家胜：chipsChange = bet*2（返还本金+赢额），净变化 +bet
  - 平局 push：chipsChange = bet（返还本金），净变化 0
  - 玩家负/爆牌：chipsChange = 0，净变化 -bet
  - Blackjack：chipsChange = floor(bet*2.5)（近似 3:2，取整），净变化约 +1.5bet

## 10. 游戏规则：牛牛（niuniu）
### 10.1 基本设定
- 每位玩家 5 张牌；庄家默认为座位 1（playerIds[0]）。
- 默认底注：每人 baseBet=20（开局统一扣除）。
- 阶段：reveal → settled。

### 10.2 规则与动作
- 牌型计算：从 5 张中任选 3 张使其点数和为 10 的倍数，剩余两张点数和 %10 得“牛几”；若为 0 记作 牛牛(10)。
- reveal：亮牌（不限制回合）；所有人亮牌后自动结算。
- settle：庄家可强制结算（用于超时/托管场景）。

### 10.3 结算
- 以庄家为基准逐一比牌（牛值优先，其次比最大单牌点数）。
- 赢家：chipsChange = bet*2；输家：0；平局：chipsChange = bet（返还本金）。

## 11. 游戏规则：骰宝（touzi_bao）
### 11.1 基本设定
- 3 颗骰子开奖。
- 默认下注：脚本/用例使用 10（每位玩家下注一次写入 playerBets/playerTotalSpent）。
- 阶段：betting → rolling → settled。

### 11.2 动作与回合
- place_bet：下注（仅当前玩家回合）；selection 取 big/small，amount 为下注金额。
- roll：开奖（仅座位1可发起）；生成 3 颗骰子。

### 11.3 判定与结算
- 若为豹子（三骰相同）：全员判负。
- 否则：sum 11–17 为 big，4–10 为 small；押中者 chipsChange=bet*2，未中 chipsChange=0。

## 12. 游戏规则：斗地主（doudizhu）（简化可测版）
### 12.1 基本设定
- 3 人，54 张（含大小王），预留 3 张底牌。
- 默认底注：每人 baseBet=10（开局统一扣除，构成 pot）。
- 阶段：bidding → playing → settled。

### 12.2 动作
- bid：叫分（points 0–3），按座位顺序依次进行；结束后最高分为地主并获得底牌。
- play：出牌（cardIds），支持牌型：
  - 单张/对子/三条
  - 三带一/三带二
  - 顺子（不含 2/王）
  - 连对（不含 2/王）
  - 飞机/飞机带单/飞机带对（不含 2/王）
  - 四带二（两单）/四带两对
  - 炸弹/王炸
- pass：过牌（要求 lastPlay 存在且不是自己）。
- surrender：认输（直接结束）。

### 12.3 结算
- 任意一方出完牌或 surrender：winner 获得 pot（chipsChange=pot）。

## 13. 游戏规则：跑得快（paodekuai）（简化可测版）
### 13.1 基本设定
- 2–4 人，52 张（不含王）轮发。
- 默认底注：每人 baseBet=10。
- 支持：play/pass/surrender；当前已实现牌型：
  - 单张/对子/三条
  - 三带一/三带二
  - 顺子/连对（不含 2）
  - 炸弹

## 14. 游戏规则：升级（shengji）（可玩规则版）
### 14.1 基本设定
- 4 人，两副 52 张（不含王）均分，形成 104 张。
- 默认底注：每人 baseBet=10。
- 队伍：座位 1&3 为一队（Team A），座位 2&4 为一队（Team B）。
- 主牌：可选参数 trumpSuit（默认 ♠）、trumpRank（默认 2）；满足“花色为 trumpSuit 或点数为 trumpRank”的牌视为主牌（TRUMP）。
- 跟牌：若首家出 TRUMP，后手有 TRUMP 必须跟主；若首家出非主花色，后手有该花色的非主牌必须跟花色。
- 赢墩：本墩若有人出 TRUMP，则 TRUMP 最大者赢；否则首家花色最大者赢；赢者先出下一墩。
- 计分：5 计 5 分、10 计 10 分、K 计 10 分；按赢墩累计到队伍 teamPoints。
- 结算：teamPoints 高的一队获胜；pot 平均分给胜方两名玩家。
- 可选参数：handSize（默认 26）。测试场景可设置更小手牌数以便快速完成对局。

## 15. 游戏规则：麻将（sichuan/guangdong/guobiao/ren）（最小可测实现）
### 15.1 基本设定
- 采用 136 张基础牌（万/筒/条 + 字牌），ren_mahjong 为 2 人，其余为 4 人。
- 默认底注：每人 baseBet=10。
- 庄家 14 张起手，闲家 13 张；下家弃牌后自动摸牌。

### 15.2 动作
- discard：弃牌（tileId），仅当前玩家回合可用。
- hu：自摸胡（仅当前玩家回合，标准 4 面子+1 对判断）。
- ron：点炮胡（对上一手 lastDiscard）。
- peng：碰牌（对 lastDiscard，提供两张手牌 useTileIds）。
- chi：吃牌（仅下家，对 lastDiscard，提供两张手牌 useTileIds 组成顺子）。
- gang：明杠（对 lastDiscard，提供三张手牌 useTileIds）。
- settle：强制结算（用于超时/测试）。按手牌的简单评估得分选出 winner 并结束。
- surrender：认输结束。

## 16. 游戏规则：棋类（xiangqi/weiqi/international_chess/junqi）
### 16.1 中国象棋（xiangqi）
- move（from/to）：完整走子规则校验（马腿/象眼/炮架/过河兵/九宫等），并包含“将帅照面”与“不能送将”校验。
- 终局：吃掉将/帅或将死（checkmate）结束。

### 16.2 国际象棋（international_chess）
- move（from/to）：完整走子规则校验（含易位、吃过路兵、兵升变默认后）。
- 终局：吃王或将死结束；无合法走法但未被将军按“和棋”处理并结算。

### 16.3 围棋（weiqi）
- place（x/y）：落子并执行提子；禁入点（自杀）禁止；支持劫（ko）。
- pass：过一手；连续两次 pass 自动结算。
- settle：强制结算（用于超时/测试）。
- 计分：黑/白以“棋子数 + 提子数 + komi（默认白 6.5）”比较，确定 winner。

### 16.4 军棋（junqi）
- setup：布阵（placements），双方都完成后进入 playing；默认 autoSetup 直接开局。
- move（from/to）：一步移动与战斗结算；炸弹同归于尽、工兵可挖雷、夺旗即胜。

## 17. 游戏规则：二八杠（erbaban）（可测版）
### 17.1 动作与结算
- roll：按回合掷两骰；全员 roll 后比较点数组合（28 为最大、对子次之、其余按 sum/高点比较）并结算。

## 18. 占位游戏规则：GenericGame（除已实现玩法之外）
- 仅提供：
  - 回合轮转（必须是当前玩家）
  - 记录 history
  - action 为 finish / win / surrender 时结束
- 默认底注：每人 baseBet=10（开局统一扣除，构成 pot）。
- 结算：winner 获得 pot（chipsChange=pot），其余 0；用于“玩法未实现但流程可跑通”的最小可测试版本。

## 19. 测试关注点（阶段 3/4 将展开为用例）
1. 断线重连：playing 中 join_room 是否能收到最新 state_update 与自己的 hand；其他玩家手牌不泄露。
2. 并发动作：同一回合多端重复点击、重复 raise/compare/move 的一致性与幂等性。
3. 筹码边界：下注不足、扣款失败时的状态回滚与前端提示（是否出现“扣失败但状态已推进”的不一致）。
4. 规则缺口：德州平局/边池/全量比牌细则；炸金花平局；中途加入 playing 的处理。
5. 清理策略：empty_at/last_active_at TTL 与注释不一致；清理时是否级联删除玩家/记录导致残留或误删。
