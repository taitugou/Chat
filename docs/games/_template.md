# {中文名}（{gameCode}）规则说明书

## 1. 概览
- 玩法类型：{扑克/麻将/棋类/其他}
- 人数范围：{min}-{max}
- 对局入口：`/game/room/:roomId/{gameCode}`（前端分发见 [GamePlay.vue](file:///f:/C/frontend/src/views/GamePlay.vue)）
- 服务端实现：{backend/services/games/...}
- 状态同步：Socket `game:started / game:state_update / game:hand / game:finished / game:error`

## 2. 房间配置参数（room.settings.gameOptions）
- {列出可配置参数、类型、默认值、约束、对局内含义}

## 3. 状态模型（GameState 摘要）
- 公开状态：{列出关键字段}
- 私有信息：{例如手牌 hand 仅私发}

## 4. 动作与合法性校验
- 统一入口：`game:action`（payload: `{ roomId, action, payload }`）
- 动作列表：{action 及 payload 字段}
- 回合/阶段约束：{currentPlayer / phase 等}
- 异常返回：非法动作单发 `game:error`，不得推进状态

## 5. 规则细则
### 5.1 {扑克/牌型/胡牌/走子等}
### 5.2 {下注/计分/特殊规则}

## 6. 胜负判定与结算
- 终局条件：{结束方式}
- 结算口径：chipsChange / totalSpent / netChange

## 7. 测试用例矩阵（摘要）
- 边界：{最小/最大牌型、极端时间等}
- 异常：{断线、退出、非法 payload、作弊检测占位}
- 特殊：{罕见牌型/循环局面等}
- 并发：{同回合多端连点、多人同时操作}

## 8. UI 动态适配要点（文字版设计稿）
- 关键区域：{牌型展示/公共牌/下注区/玩家状态等}
- 响应式与横竖屏：{策略}
- 动画与反馈：{关键交互}

## 9. 性能指标与优化点
- 首屏：<1.5s（Vite 分包 + 懒加载）
- 操作：<100ms（事件节流 + 状态最小化更新）
- 渲染：60fps（rAF + 硬件加速/降级）
- 网络：心跳/重连/压缩/缓存（实现见前端 socket 工具）

## 10. 与通行规则差异（风险登记）
- 参照： [rules_research.md](file:///f:/C/rules_research.md)
- 当前实现差异：{列出“已知规则缺口/产品口径差异”}

