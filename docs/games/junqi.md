# 军棋（junqi）规则说明书（含自动布阵）

## 1. 概览
- 玩法类型：棋类（5x12）
- 人数范围：2
- 对局入口：`/game/room/:roomId/junqi`
- 服务端实现： [junqi.js](file:///f:/C/backend/services/games/chess/junqi.js)
- 通行规则差异（风险登记）：[rules_research.md](file:///f:/C/rules_research.md#L181-L190)

## 2. 房间配置参数（room.settings.gameOptions）
- `baseBet:number`：默认 10
- `autoSetup:boolean`：是否自动布阵，默认 true（传 false 进入手动布阵）

## 3. 状态模型（GameState 摘要）
- 公开状态：`phase(setup/playing/settled)`、`board(5x12)`、`ready{red,black}`、`currentPlayer`、`gameOver`

## 4. 动作与合法性校验
- `setup`：payload `{ placements: {x,y,piece}[] }`
  - 仅 `phase=setup`；数量必须匹配 requiredPieces；位置必须在己方半场；棋子数量与类型必须匹配
- `move`：payload `{ from:{x,y}, to:{x,y} }`
  - 仅 `phase=playing` 且当前回合；坐标合法；只能移动可移动棋子；一步移动（实现口径）
- `surrender`：认输结束

## 5. 战斗与胜负（实现口径）
- 战斗结算：按军阶比较；炸弹同归于尽；工兵可挖雷；夺旗即胜
- 具体棋子与军阶口径以实现为准（属于平台规则族差异点）

## 6. 结算
- winner `chipsChange = pot`，其余 0

## 7. 测试用例矩阵（摘要）
- 布阵：重复放置、非法棋子、越界、放在对方半场应拒绝；autoSetup 开关
- 行棋：不可移动棋子移动、一步移动限制、战斗结算（炸弹/地雷/工兵/夺旗）
- 并发：双方同时 setup/同回合双端 move 的一致性

## 8. UI 动态适配要点（文字版设计稿）
- 布阵阶段：拖拽布阵（桌面）+ 点击放置（移动端）；校验提示
- 行棋阶段：暗棋显示（对方棋子信息隐藏）与战斗揭示动画

## 9. 性能指标与优化点
- 棋盘与战斗动画按需渲染，避免同时播放导致掉帧

## 10. 与通行规则差异（风险登记）
- 军棋规则存在大量平台差异（棋盘线路/行营等）；以当前实现为基准并在用例中固化（见 [rules_research.md](file:///f:/C/rules_research.md#L181-L190)）

