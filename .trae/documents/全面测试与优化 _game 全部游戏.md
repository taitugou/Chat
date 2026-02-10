## 游戏清单（当前仓库内 /game 支持的全部玩法）
- texas_holdem：德州扑克（2-10）
- zhajinhua：炸金花（2-6）
- doudizhu：斗地主（3）
- shengji：升级（4）
- paodekuai：跑得快（2-4）
- blackjack：21点（2-7）
- sichuan_mahjong：四川麻将（4）
- guangdong_mahjong：广东麻将（4）
- guobiao_mahjong：国标麻将（4）
- ren_mahjong：二人麻将（2）
- xiangqi：中国象棋（2）
- weiqi：围棋（2）
- wuziqi：五子棋（2）
- international_chess：国际象棋（2）
- junqi：军棋（2）
- niuniu：牛牛（2-10）
- erbaban：二八杠（2-8）
- touzi_bao：骰宝（2-10）

对应来源：后端游戏类型定义 [ensureGameTypes.js](file:///f:/C/backend/services/ensureGameTypes.js#L3-L23) / [game_tables.sql](file:///f:/C/database/game_tables.sql#L202-L223)，后端实例映射 [gameFactory.js](file:///f:/C/backend/services/gameFactory.js#L19-L58)，前端 /game 路由 [router/index.ts](file:///f:/C/frontend/src/router/index.ts#L242-L266)。

## 联网整理规则（产出“规则基线 + 实现差异”）
1. 以每个 gameCode 为单位，联网收集“通行规则/常见线上规则”的权威或可复核来源（百科/规则站/竞赛规则等），每个游戏至少 2 个来源。
2. 把联网规则与当前实现逐条对照：
   - 已有文档：实现基线在 [gamerules.md](file:///f:/C/gamerules.md)，目前仅 3 个游戏做了联网差异分析在 [rules_research.md](file:///f:/C/rules_research.md)。
   - 扩展 [rules_research.md](file:///f:/C/rules_research.md) 覆盖全部 18 个游戏，并明确“与通行规则不同但属于本项目设计”的点。
3. 修正文档矛盾点：例如 [gamerules.md](file:///f:/C/gamerules.md#L28-L35) 中“仅实现 3 个”的描述与 [gameFactory.js](file:///f:/C/backend/services/gameFactory.js#L19-L58) 不一致。

## 全面测试（覆盖“任何情况下不出问题”的最接近实现方式）
1. 先跑通全量冒烟：
   - 现有脚本已能把 18 个游戏都跑一遍并完成对局： [backend/scripts/game-e2e.mjs](file:///f:/C/backend/scripts/game-e2e.mjs#L681-L716)。
2. 扩展为“场景矩阵”自动化：为每个游戏追加以下通用场景（脚本化，可重复）：
   - 房间：创建/加入/满员/密码错误/permission=approval（当前是直接拒绝）/房主离开换房主
   - 对局：未准备/非房主开始/重复开始/重复动作/越权动作/非法 payload（坐标越界、cardId 不在手牌等）
   - 经济：筹码不足下注/扣款失败回滚一致性/结算净变化正确性
   - 网络：断线重连（playing 中重连能拿到最新 state；私有手牌不泄漏）
   - 并发：同一回合多端连点导致的幂等性、状态不漂移
3. 增加“崩溃防护”检查：所有 socket handler 的异常必须被捕获并以 game:error 单发返回，不能让进程崩溃；并把关键错误写入日志。

## 前端 UI 优化（保证视觉效果好 + 所有操作可达）
1. 统一 /game（大厅）与 /game/room（房间）与 /game/room/:id/:gameType（对局）的交互一致性：
   - 加载态/空态/错误态统一
   - 不可用按钮禁用策略（例如不是当前玩家/不是房主/不在可操作阶段）
   - 关键动作二次确认（解散房间、认输等）
2. 逐游戏校对操作面板：确保每个游戏在 UI 上能触发其后端支持的动作集合（例如：斗地主/跑得快出牌选择、军棋布阵、围棋 pass/settle 等）。
3. 视觉与适配：优化棋盘/牌桌在手机端的缩放、信息密度、点击热区与反馈；修复可能的溢出/遮挡。

## 验收方式（我会按这个自检并给出结果）
- 每个 gameCode：能创建房间→满员加入→全部准备→开始→完成一局→结算→离开房间；脚本与 UI 两条路径都覆盖。
- 所有“错误场景”都能在前端显示明确提示，不出现白屏、不出现卡死房间。
- 文档：rules_research 覆盖 18 个游戏并标注差异；gamerules 不再与实现矛盾。

如果你确认这个计划，我将按顺序开始：先补齐联网规则与差异文档 → 扩展自动化场景脚本 → 修复发现的后端/前端问题 → 最后做 UI 统一与视觉优化。