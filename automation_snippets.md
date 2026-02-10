# 自动化辅助：房间对局模块测试脚本片段
文档版本：v0.1.0  
关联应用版本：ttg-chat v1.0.0  
最后更新：2026-02-08  
范围：仅“房间对局模块”

---

## 1. 纯逻辑冒烟（无需数据库/账号）
目标：快速验证三种已实现玩法的核心规则不回归。

脚本：
- [game-logic-smoke.mjs](file:///f:/C/backend/scripts/game-logic-smoke.mjs)

运行命令：
```bash
cd backend
node scripts/game-logic-smoke.mjs
```

预期输出：
```text
game-logic-smoke: ok
```

---

## 2. Socket 冒烟（需要账号 Token + roomId）
目标：验证 join_room → state_update 补发 → leave_room 的基础链路；用于弱网/断网回归前的快速检查。

脚本：
- [game-socket-smoke.mjs](file:///f:/C/backend/scripts/game-socket-smoke.mjs)

前置条件：
- 本地后端已启动且可通过 https://localhost:888 访问
- 有有效 JWT（登录后从前端存储或接口返回获取）
- 已存在一个可加入的房间 roomId（可从页面或 /api/rooms 列表获取）

运行命令：
```bash
cd backend
set SOCKET_URL=https://localhost:888
set TOKEN=YOUR_JWT_TOKEN
set ROOM_ID=123
node scripts/game-socket-smoke.mjs
```

判定点：
- 必须收到至少一次 game:state_update
- 不得收到他人手牌（hand 只能是自己的）
- leave_room 后应断开连接且无异常

---

## 3. 后续可扩展方向（阶段 4/5）
- 加入“多客户端并发脚本”：模拟房主+玩家双端 ready/start/action 并验证状态一致性。
- 加入“弱网注入回放”：在代理层模拟延迟/丢包并记录 Socket 事件序列，做确定性回归。

---

## 4. 端到端全流程冒烟（推荐）
覆盖：注册/登录、签到补筹码、创建房间、加入房间、语音 join/leave、房间聊天、房主开始对局、最小动作结束、销毁房间。

脚本：
- [game-e2e.mjs](file:///f:/C/backend/scripts/game-e2e.mjs)

说明：
- 会自动根据 `/api/games/types` 的 `min_players` 为每个玩法拉起 2/3/4 人对局
- 当前覆盖默认 18 个玩法 code（见 ensureGameTypes）
- E2E 在创建房间时可通过 `settings.gameOptions` 注入玩法参数，用于缩短对局（例如 shengji.handSize、mahjong.maxTurns）

运行命令：
```bash
cd backend
node scripts/game-e2e.mjs
```

可选环境变量：
```bash
BASE_URL=https://localhost:888
```
