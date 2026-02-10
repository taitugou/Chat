# 修复与回归验证报告（房间对局模块）
文档版本：v0.1.0  
关联应用版本：ttg-chat v1.0.0  
最后更新：2026-02-08  
范围：仅“房间对局模块”

---

## 1. 已修复缺陷与验证结果
| 缺陷ID | 修复内容 | 影响范围 | 验证方式 | 结果 |
|---|---|---|---|---|
| BUG-001 | 修复德州顺子误判：4 连不再判顺子 | 德州摊牌与牌型评估 | 运行 backend/scripts/game-logic-smoke.mjs（含反例断言） | 通过 |
| BUG-002 | 修复 A2345（wheel）顺子高张：高张=5 | 德州顺子比较 | 同上（含 wheel 断言） | 通过 |
| BUG-003 | 修复前端 dev 代理到 IPv6 后端：proxy 目标改为 https://[::1]:888 | 前端 /api 与 /socket.io 代理稳定性 | 启动前后端 dev + 前端构建 npm run build | 通过 |
| BUG-004 | 增强事务抗死锁：transaction 自动重试 + leaveRoom/destroy 加 FOR UPDATE | 离开房间/销毁房间并发一致性 | 运行 backend/scripts/game-e2e.mjs（三玩法 + join/chat/voice + destroy） | 通过 |

代码变更：
- [texasHoldem.js](file:///f:/C/backend/services/games/poker/texasHoldem.js)
- [game-logic-smoke.mjs](file:///f:/C/backend/scripts/game-logic-smoke.mjs)
- [connection.js](file:///f:/C/backend/database/connection.js)
- [roomService.js](file:///f:/C/backend/services/roomService.js)
- [rooms.js](file:///f:/C/backend/routes/rooms.js)
- [vite.config.js](file:///f:/C/frontend/vite.config.js)
- [game-e2e.mjs](file:///f:/C/backend/scripts/game-e2e.mjs)

---

## 2. 回归测试通过率
### 2.1 逻辑冒烟集
- 覆盖：德州牌型判断、炸金花基础动作、五子棋五连胜利
- 执行：1 组
- 通过率：100%

---

## 3. 新增测试用例（针对修复引入的变更）
- TC-TX-101：非顺子误判防护
- TC-TX-102：A2345 wheel 高张正确

---

## 4. 剩余风险与建议（需进入后续阶段 4/5 的联调验证）
- 德州：平局/分池、边池与 all-in、完整 kicker 比较未实现（属于规则缺口/需求缺口，见 rules_research）。
- 弱网/断网：需要在真机 iOS Safari 上做断网/切网/后台挂起验证（见 test_baseline）。
- Socket 端到端：需要带真实账号 token 的自动化或半自动化脚本执行（下阶段将补齐 socket 自动化脚本模板）。
