# 房间对局模块：设备/浏览器/网络环境测试基线
文档版本：v0.1.0  
关联应用版本：ttg-chat v1.0.0  
最后更新：2026-02-08  
范围：仅“房间对局模块”（GameRoom / GamePlay / Socket / 语音 / 局内聊天）

---

## 1. 设备基线（Devices）
### 1.1 必测（Must）
- iPhone 15 / 15 Pro（iOS 17+，Safari）
- iPhone 13（iOS 16+，Safari）
- iPhone SE（第三代）（iOS 16+，Safari；小屏/触控热区/字体折行）
- iPad 10th / iPad Air（iPadOS 16+，Safari；横屏/分屏）

### 1.2 选测（Should）
- Android 13/14（Chrome 最新，WebView）：覆盖输入法、返回键、音频权限差异
- macOS（Safari 最新）：桌面端布局与多窗口行为
- Windows（Chrome/Edge 最新）：快速回归与自动化执行平台

---

## 2. 浏览器基线（Browsers）
### 2.1 必测组合
| 平台 | 浏览器 | 重点风险 |
|---|---|---|
| iOS | Safari | WebSocket 稳定性、后台挂起/恢复、音频权限/回声消除 |
| iOS | Chrome（实际内核同 WebKit） | UA 差异、PWA 行为差异 |
| Android | Chrome | WebRTC/音频权限、弱网重连、输入与滚动冲突 |
| 桌面 | Chrome/Edge | DevTools 辅助定位、并发多标签页测试 |

---

## 3. 网络基线（Network）
### 3.1 必测网络场景矩阵
| 场景 | 目标 | 触发方式（建议） |
|---|---|---|
| Wi‑Fi 正常 | 基线稳定性 | 正常网络 |
| 4G/5G 正常 | 移动网络稳定性 | 真机移动网络 |
| 弱网：高延迟（200–800ms） | 状态同步与超时提示 | 网络限速/延迟注入 |
| 弱网：丢包（1%/5%/10%） | 动作幂等与回滚 | 丢包注入 |
| 断网 5–30 秒后恢复 | 重连与状态补发 | 断开 Wi‑Fi/开飞行模式再恢复 |
| 网络切换（Wi‑Fi⇄蜂窝） | 连接迁移 | 真机切网 |
| 后台挂起 30–120 秒再回来 | iOS 挂起恢复 | Home 键/切 App |

### 3.2 断线重连验收基线
- 断线期间：应阻止继续出牌/落子或给出明确“离线”提示，避免“客户端以为成功但服务端失败”的假成功。
- 重连后：必须补发 room 公开状态（game:state_update）与本人私有数据（game:hand，如适用）。
- 任何玩家：不得因重连拿到其他玩家手牌或私密信息。

### 3.3 IPv6 Mesh 直连（语音）验收基线
- 目标：在双方具备公网 IPv6 时，房间语音优先走 WebRTC host/mesh 直连；仅在不可达时回退 STUN/TURN。
- 必测用例：两台设备均在 IPv6 网络（或同一 IPv6-only/双栈网络）进入同一房间，开启语音后应快速出声且无明显延迟抖动。
- 观测手段（桌面 Chrome/Edge）：打开 `chrome://webrtc-internals`，查看对应 PeerConnection 的 selected candidate pair，确认候选地址为 IPv6（含 `:`）且优先为 host/srflx，必要时记录连接建立耗时与重连行为。

---

## 4. 并发与多端基线（Concurrency）
### 4.1 必测并发
- 同一账号多设备/多标签页加入同一房间：准备/开始/动作冲突处理
- 多玩家同时点击同一动作（如准备、开始、重复落子）：服务端应以回合/权限为准并给出确定性错误
- 高频 state_update：前端渲染不应卡顿，且状态不倒退

---

## 5. iOS 审美相关的 UI 判定基线（与测试素材联动）
- 可点击区域：≥44pt（用 testkit-overlays 的 tk-overlay-hitarea-44 辅助核对）。
- 安全区适配：刘海/底部 Home 指示条不遮挡关键按钮（用 tk-overlay-safe-area 核对）。
- 错误与弱网：必须有清晰的提示与恢复入口（建议展示重连按钮与当前状态快照）。
