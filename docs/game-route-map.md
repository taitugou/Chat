# /game 路由与玩法入口地图

本文件用于快速定位「前端 /game 路径下」所有玩法的入口与分发位置，便于规则文档、测试与 UI 适配的对照溯源。

## 路由定义

- `/game`：大厅页 → [Game.vue](file:///f:/C/frontend/src/views/Game.vue)
- `/game/room/:roomId`：房间页 → [GameRoom.vue](file:///f:/C/frontend/src/views/GameRoom.vue)
- `/game/room/:roomId/:gameType`：对局页（玩法分发入口）→ [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue)
- `/game/room/:roomId/n/:gameType`：兼容别名，重定向到对局页（name: GamePlay）

路由来源： [router/index.ts](file:///f:/C/frontend/src/router/index.ts#L242-L266)

## 玩法清单（/game 实际可进入）

对局页按 `gameType`（即 gameCode）做分发，当前实现覆盖以下 18 个 code：

- 扑克/牌类：`texas_holdem`、`zhajinhua`、`doudizhu`、`paodekuai`、`blackjack`、`shengji`、`niuniu`
- 麻将：`sichuan_mahjong`、`guangdong_mahjong`、`guobiao_mahjong`、`ren_mahjong`
- 棋类：`xiangqi`、`weiqi`、`wuziqi`、`international_chess`、`junqi`
- 其他：`touzi_bao`、`erbaban`

权威来源（数据库默认类型清单）：[ensureGameTypes.js](file:///f:/C/backend/services/ensureGameTypes.js)

## 前端 UI 组件分发

对局页使用 4 套「棋盘/桌面 Board」与 3 套「操作面板 Controls」组件进行分类分发：

- 扑克/牌类
  - Board： [PokerBoard.vue](file:///f:/C/frontend/src/components/games/boards/PokerBoard.vue)
  - Controls： [PokerControls.vue](file:///f:/C/frontend/src/components/games/controls/PokerControls.vue)
- 麻将
  - Board： [MahjongBoard.vue](file:///f:/C/frontend/src/components/games/boards/MahjongBoard.vue)
  - Controls： [MahjongControls.vue](file:///f:/C/frontend/src/components/games/controls/MahjongControls.vue)
- 棋类
  - Board： [ChessBoard.vue](file:///f:/C/frontend/src/components/games/boards/ChessBoard.vue)
  - Controls： [ChessControls.vue](file:///f:/C/frontend/src/components/games/controls/ChessControls.vue)
- 其他（骰宝/二八杠）
  - Board： [DiceBoard.vue](file:///f:/C/frontend/src/components/games/boards/DiceBoard.vue)
  - Controls：对局页内联（见 [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue#L138-L183)）

分发条件与判断变量位置：

- Controls 分发： [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue#L96-L136)
- Board 分发： [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue#L261-L303)
- 游戏类型分类判断： [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue#L652-L665)

