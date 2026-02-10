# 测试素材库说明（SVG Testkit，历史文档）
文档版本：v0.1.0  
关联应用版本：ttg-chat v1.0.0  
最后更新：2026-02-10  
范围：仅“房间对局模块”（房间页/对局页/语音/局内聊天/状态与错误提示）

说明：仓库内的 SVG Testkit 素材已移除（未被生产代码引用），本文仅保留为“测试占位素材命名与用法规范”的参考。

素材文件（已移除，名称保留）：
- testkit-icons.svg
- testkit-widgets.svg
- testkit-overlays.svg

---

## 1. 素材索引（按场景/功能分类）
### 1.1 房间页（GameRoom）
| 素材 | 作用 | 关键交互属性 |
|---|---|---|
| tk-icon-ready | “准备/取消准备”图标 | 点击区域建议≥44pt，支持连点防抖测试 |
| tk-icon-play | “开始游戏”图标 | 仅房主可点；禁用态需可视化 |
| tk-icon-leave | “离开房间”图标 | 高风险：离开时服务端会删除玩家记录 |
| tk-icon-voice / tk-icon-mute | “加入语音/静音”图标 | 首次需权限弹窗；断线需自动恢复策略验证 |
| tk-icon-chat | “房间聊天”图标 | 输入框 Enter 提交与按钮提交一致性 |

### 1.2 对局页（GamePlay）
| 素材 | 作用 | 关键交互属性 |
|---|---|---|
| tk-widget-chip | 筹码变动/下注视觉占位 | 用于覆盖扣筹码/派奖动画与数值刷新 |
| tk-widget-toast | 成功/提示 Toast 占位 | 用于覆盖 game:error / 操作成功提示等 |
| tk-overlay-network | 断网提示卡片占位 | 触发点：弱网/断网/重连；需与状态回滚联测 |

### 1.3 通用覆盖层（可视化测试）
| 素材 | 作用 | 关键交互属性 |
|---|---|---|
| tk-overlay-hitarea-44 | 44pt 点击热区标注 | iOS 可用性基线：可点击控件≥44pt |
| tk-overlay-focus-ring | 焦点/选中态描边 | 用于按钮按下态、禁用态、聚焦态差异对比 |
| tk-overlay-safe-area | 安全区可视化 | 覆盖刘海屏/底部 Home 指示条区域适配 |

---

## 2. 关键素材交互属性标注
### 2.1 iOS 审美与可用性基线（用于 UI 测试判定）
- 圆角体系：按钮/卡片建议 14–20pt；底部弹层建议 24–28pt。
- 透明材质：半透明底（0.06–0.12）+ 细边框（0.10–0.18）+ 轻阴影（可选）。
- 点击热区：所有可点击元素的可用区域建议≥44pt。
- 文本层级：标题 17–20/粗；正文 13–15；辅助信息 10–12/中等透明度。

### 2.2 动画触发器（用于自动化与回归）
- Toast：出现/消失（200–280ms），连续触发需队列或合并策略。
- Bottom Sheet：从底部弹出（280–360ms），支持手势下滑关闭（若产品决定实现）。
- Chip 变动：扣筹码/派奖时的数值与动画一致性（先扣后推状态 vs 先推状态后扣款）。

---

## 3. 素材与玩法规则的映射关系表
| 规则/事件（服务端） | 前端场景 | 建议绑定素材 | 主要验证点 |
|---|---|---|---|
| game:player_ready | GameRoom | tk-icon-ready、tk-widget-toast | 非房主准备态切换；多人并发一致性 |
| game:start / game:started | GameRoom→GamePlay | tk-icon-play、tk-widget-toast | 仅房主可开始；人数/准备校验；开局扣筹码 |
| game:state_update | GamePlay | tk-widget-chip | 状态快照刷新频率；不泄露他人手牌 |
| game:hand（私有） | GamePlay | tk-widget-toast（提示） | 仅本人接收；重连补发正确 |
| game:error（私有） | 任意 | tk-icon-error、tk-widget-toast | 非法操作/回合错误/筹码不足提示准确 |
| 断网/重连（Socket） | 任意 | tk-overlay-network、tk-icon-reconnect | 断网后 UI 与状态一致；重连后补发 state/hand |

---

## 4. 资产使用方式（测试建议）
- 这些 SVG 是“测试占位素材库”，用于：视觉回归截图、交互热区核对、错误态/弱网态覆盖。
- 默认不要求接入生产 UI；若需要重新引入，可在 `frontend/src/assets/` 下新增 `testkit/` 目录并按本文命名导入或以 symbol 方式使用。
