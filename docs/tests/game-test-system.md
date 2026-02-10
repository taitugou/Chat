# /game 全玩法规则验证测试体系

## 1. 测试分层

### 1.1 规则单元测试（不依赖服务器）
- 目标：验证“牌型识别/比较/核心判定”在边界输入下稳定、可回归
- 位置：`backend/tests/games/*Rules.test.js`
- 运行：`backend` 下执行 `npm test`

### 1.2 联机集成测试（依赖后端服务）
- 目标：覆盖房间/Socket/断线重连/扣筹码一致性/并发等系统性风险
- 位置：`backend/scripts/game-e2e.mjs`、`backend/scripts/game-scenarios.mjs`
- 汇总报告：`backend/scripts/game-test-report.mjs`（执行并生成 `backend/reports/game-tests/...`）

## 2. 用例维度矩阵（适用于所有玩法）

### 2.1 边界情况
- 人数边界：minPlayers / maxPlayers
- 输入边界：最小/最大下注、最小/最大坐标、最小/最大手牌长度
- 时间边界：超时触发（若玩法或房间策略存在）与极端长局

### 2.2 异常流程
- 网络：断线、重连、重复连接、重连后状态补全（含私有信息不泄露）
- 退出：玩家中途离开、房主离开换房主、游戏中离开导致的托管/认输兜底
- 非法动作：越权（非当前回合）、非法 payload（越界/不存在 id）、重复动作幂等性

### 2.3 特殊规则触发
- 罕见牌型/局面：如炸金花 235、围棋 ko、象棋送将、国际象棋易位/吃过路兵
- 规则缺口：对照 [rules_research.md](file:///f:/C/rules_research.md) 中登记的差异点

### 2.4 并发场景
- 多人同时操作：同一弃牌的多家响应（麻将）、同时亮牌（牛牛）、同时下注（骰宝）
- 快速连续操作：同一客户端连点、双端登录同时发动作

## 3. 报告与交付物
- 单元测试：Vitest 输出 + 失败用例定位（文件/用例名）
- 集成测试：自动生成 `summary.md / summary.json` + stdout/stderr 日志
- 对照规则：每个玩法规则说明书见 `docs/games/*.md`

