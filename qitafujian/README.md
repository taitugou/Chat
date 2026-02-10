# 其他附件（音频 & SVG 素材）

本目录用于集中保存网站需要的提示音与图像占位素材，便于统一管理与后续替换。

## 目录结构

- [audio](file:///f:/C/qitafujian/audio) ：提示音（WAV，单声道 44.1kHz）
- [images](file:///f:/C/qitafujian/images) ：图像素材（全部为 SVG）
- [asset-manifest.json](file:///f:/C/qitafujian/asset-manifest.json) ：素材清单（自动生成）
- [generate-assets.mjs](file:///f:/C/qitafujian/generate-assets.mjs) ：生成脚本（可重复执行）

## 生成/更新

在项目根目录执行：

```bash
node .\qitafujian\generate-assets.mjs
```

脚本会：

- 将品牌 Logo 从 `f:\C\f.svg` 复制为 `qitafujian/images/brand-logo.svg`
- 生成其余 SVG 占位素材
- 生成提示音 WAV 文件
- 刷新 `asset-manifest.json`

## 音频（WAV）说明

路径： [qitafujian/audio](file:///f:/C/qitafujian/audio)

| 文件 | 预期效果（听感） | 推荐触发点 |
| --- | --- | --- |
| `notify_msg.wav` | 清爽短“滴”，不刺耳（约 160ms） | 新私聊/群聊消息到达 |
| `notify_sys.wav` | 中性提示音，较稳重（约 220ms） | 系统通知、好友请求、关注提醒 |
| `notify_match.wav` | 上行三音阶（约 440ms） | 匹配成功弹窗出现 |
| `call_ring_in.wav` | 来电铃声片段（可循环） | 收到语音/视频来电等待接听 |
| `call_ring_out.wav` | 外呼回铃片段（可循环） | 呼叫中等待对方接听 |
| `call_connect.wav` | 接通确认音（约 190ms） | 通话接通瞬间 |
| `call_end.wav` | 下行结束音（约 220ms） | 通话挂断/结束 |
| `call_busy.wav` | 忙线/拒接短音序列（约 400ms） | 对方忙线或拒接 |
| `ui_click.wav` | 极轻按钮点击（约 26ms） | 可选：普通按钮点击 |
| `ui_success.wav` | 轻快确认（约 280ms） | 可选：保存成功/签到成功 |
| `ui_error.wav` | 低频拒绝“嗡”音（约 460ms） | 可选：操作失败/余额不足 |
| `game_join.wav` | 入场上行两音（约 250ms） | 进入游戏房间 |
| `game_ready.wav` | 轻“咔哒”+短音（约 110ms） | 点击准备/取消准备 |
| `game_start.wav` | 轻冲击+提示音（约 500ms） | 游戏开始 |
| `game_turn.wav` | 明确但不吵的提醒音（约 160ms） | 轮到自己行动 |
| `game_win.wav` | 胜利上行三音+轻噪点（约 650ms） | 游戏胜利 |
| `game_lose.wav` | 失败下行两音（约 500ms） | 游戏失败 |
| `game_chip.wav` | 筹码碰撞（约 120ms） | 扑克类下注/加注 |
| `game_card.wav` | 发牌/滑牌质感（约 60ms） | 扑克类发牌/出牌 |

## 图片（SVG）说明

路径： [qitafujian/images](file:///f:/C/qitafujian/images)

| 文件 | 预期效果（视觉） | 推荐触发点 |
| --- | --- | --- |
| `brand-logo.svg` | 品牌 Logo（从 `f.svg` 复制） | 登录页/顶部栏/关于页 |
| `default-avatar.svg` | 深色渐变圆形默认头像 | 用户头像缺失/加载失败 |
| `default-cover.svg` | 渐变+光晕的默认封面 | 个人主页/群组封面缺失 |
| `placeholder-post.svg` | 图片占位卡片（含“图片”图标感） | 帖子图片加载中/失败 |
| `empty-data.svg` | 空数据插画（含放大镜） | 列表为空、搜索无结果 |
| `empty-chat.svg` | 空消息插画（气泡） | 消息列表为空、无会话 |
| `empty-game.svg` | 空游戏插画（手柄） | 游戏房间为空/战绩为空 |
| `chip-icon.svg` | 金色筹码图标 | 积分/余额/筹码展示 |
| `card-back.svg` | 扑克牌背面纹理 | 扑克类游戏：牌背/牌堆 |
| `table-bg.svg` | 绿色桌布+网格纹理背景 | 游戏房间背景 |

## 接入建议

如果需要在前端作为静态资源直接引用，建议将 `qitafujian/audio` 与 `qitafujian/images` 复制到 `frontend/public/` 下的固定目录（例如 `frontend/public/assets/`），然后用 `/assets/...` 的 URL 引用。
