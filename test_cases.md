# 房间对局模块测试用例（全玩法覆盖）
文档版本：v0.1.0  
关联应用版本：ttg-chat v1.0.0  
最后更新：2026-02-08  
范围：仅“房间对局模块”（房间、对局、筹码、语音、局内聊天、断线重连、多端并发）

关联文档：
- [gamerules.md](file:///f:/C/gamerules.md)
- [rules_research.md](file:///f:/C/rules_research.md)
- [test_baseline.md](file:///f:/C/test_baseline.md)
- [ui_spec_ios.md](file:///f:/C/ui_spec_ios.md)
- [assets_guide.md](file:///f:/C/assets_guide.md)

---

## 0. 用例结构说明
- 用例ID格式：`TC-<模块>-<序号>`
- 严重度：P0（阻断/资金/数据泄露）/ P1（核心功能失败）/ P2（体验/边界）/ P3（提示/样式）
- 覆盖层：API（REST）/ Socket / UI / 端到端（E2E）/ 纯逻辑（Game Logic）

---

## 1. 房间（Room）用例
### 1.1 创建房间
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-ROOM-001 | 正常创建房间（public，无密码） | 返回 room；房间状态 waiting；创建者为房主且座位1；current_players=1 | P1 | API/UI |
| TC-ROOM-002 | 创建房间：gameTypeId 不存在 | 400 + “无效的游戏类型” | P1 | API |
| TC-ROOM-003 | 创建房间：maxPlayers 超出该游戏 min/max | 400 + 人数限制提示正确 | P1 | API |
| TC-ROOM-004 | 创建房间：name 长度 <2 或 >20 | 400 + 文案正确 | P2 | API/UI |
| TC-ROOM-005 | 创建房间：minBet/maxBet 非数字 | 400 + 文案正确 | P2 | API |
| TC-ROOM-006 | 创建房间：minBet > maxBet（maxBet>0） | 400 + 文案正确 | P2 | API |
| TC-ROOM-007 | 创建房间：permission=approval | 创建成功；后续 join 应被拒绝（占位规则） | P2 | API/UI |
| TC-ROOM-008 | 创建房间：带密码 | 创建成功；join 必须校验密码 | P1 | API/UI |

### 1.2 加入/离开/重连
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-ROOM-101 | 正常加入 waiting 房间 | join 成功；seat_number 分配正确；current_players 同步 | P1 | API/UI |
| TC-ROOM-102 | 加入：房间不存在 | 400/404 + “房间不存在” | P1 | API |
| TC-ROOM-103 | 加入：房间已满 | 400 + “房间已满” | P1 | API/UI |
| TC-ROOM-104 | 加入：密码错误 | 400 + “房间密码错误” | P1 | API/UI |
| TC-ROOM-105 | 加入：permission=approval | 失败并提示需要房主同意（当前实现为直接拒绝） | P2 | API/UI |
| TC-ROOM-106 | 离开房间（非对局中） | 玩家记录删除；广播 player_left；房主离开则 owner_changed | P1 | API/Socket/UI |
| TC-ROOM-107 | 房间空房：最后一人离开 | room empty_at 设置；current_players=0；status=waiting | P1 | API/DB |
| TC-ROOM-108 | 重连：已在房间中再次 join | is_online=true；empty_at 清除；playing 时补发 state_update + 私有 hand（如适用） | P0 | Socket/UI |
| TC-ROOM-109 | playing 中途加入（新用户） | join 成功；但不得拿到对局私密信息；玩法是否允许中途加入按当前实现验证 | P0 | Socket/UI |
| TC-ROOM-110 | playing 中离开（扑克） | 自动 fold；若导致仅剩1人应立刻结算 finished | P0 | Socket/Logic |
| TC-ROOM-111 | playing 中离开（五子棋） | 自动 surrender；应立刻结算 finished | P0 | Socket/Logic |

### 1.3 准备与开始
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-ROOM-201 | 非房主准备/取消准备 | 广播 player_ready；UI 状态一致 | P1 | Socket/UI |
| TC-ROOM-202 | 房主点击开始：人数不足 | game:error（仅房主）+ 文案“人数不足” | P1 | Socket/UI |
| TC-ROOM-203 | 房主点击开始：有人未准备 | game:error（仅房主）+ 文案“还有玩家未准备” | P1 | Socket/UI |
| TC-ROOM-204 | 房主点击开始：满足条件 | 广播 game:started；room.status=playing；每人收到 state_update；扑克类本人收到 hand | P0 | Socket/UI |
| TC-ROOM-205 | 非房主尝试开始 | game:error（仅触发者）+ “只有房主可以开始游戏” | P1 | Socket/UI |
| TC-ROOM-206 | playing 状态再次 start | 不重复开局（应无副作用） | P1 | Socket |

### 1.4 踢人/销毁
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-ROOM-301 | 房主踢人（waiting） | 被踢者收到 game:kicked 且离开 socket room；其他人收到 player_left | P1 | API/Socket/UI |
| TC-ROOM-302 | 非房主踢人 | 403 “无权踢出玩家” | P1 | API |
| TC-ROOM-303 | 房主销毁房间 | 房间与玩家记录删除；广播 room_destroyed；前端正确退出 | P1 | API/Socket/UI |
| TC-ROOM-304 | 非房主销毁 | 403 “只有创建者可以销毁房间” | P1 | API |

---

## 2. 对局（Game）用例：通用
### 2.1 开局扣筹码与结算写账
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-GEN-001 | 开局扣底注/买入成功 | 扣款流水写入；余额减少；对局继续 | P0 | API/DB/Socket |
| TC-GEN-002 | 开局扣款失败（余额不足） | 对局不应进入 playing 或应回滚到一致状态；前端明确提示 | P0 | Socket/DB/UI |
| TC-GEN-003 | 对局中下注扣款失败 | 不应推进回合/阶段；前端提示“筹码不足”；状态不分叉 | P0 | Socket/DB/UI |
| TC-GEN-004 | 结算：赢家加筹码 | 赢家余额增加；写入 GAME_WIN 流水；game_records finished | P0 | DB/API |
| TC-GEN-005 | 结算：玩家净输赢记录 | game_player_records.chips_change = chipsChange - totalSpent；与流水一致 | P1 | DB |

### 2.2 私密信息与权限
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-SEC-001 | 对局中重连补发手牌 | 仅本人收到自己的 hand；其他人不可见 | P0 | Socket |
| TC-SEC-002 | 旁观/中途加入 playing | 不得收到他人手牌；不得能发起不属于自己的动作 | P0 | Socket |
| TC-SEC-003 | 非当前回合操作 | game:error；状态不变化 | P0 | Socket/Logic |

---

## 3. 德州扑克（texas_holdem）用例
### 3.1 阶段与行动
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-TX-001 | preflop 行动起始玩家（UTG） | 当前玩家索引正确（按钮+3） | P1 | Logic/Socket |
| TC-TX-002 | check：下注未匹配时不允许 | 报错或引导 call；状态不推进 | P0 | Socket/Logic |
| TC-TX-003 | call：补齐到 currentBet | playerBets 达到 currentBet；扣款正确 | P0 | Socket/DB |
| TC-TX-004 | raise：更新 currentBet 并清空本阶段已行动集合 | 其他玩家需重新行动；状态正确 | P1 | Logic |
| TC-TX-005 | 全员行动且下注匹配：推进 flop/turn/river | phase 顺序正确；公共牌数量分别为 3/4/5 | P1 | Logic |
| TC-TX-006 | fold 导致只剩1名 active：立即结算 | game:finished 广播；赢家正确 | P0 | Socket/Logic |

### 3.2 牌型与对照规则（来自 rules_research）
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-TX-101 | 非顺子误判防护 | 类似 A K Q J 9 不应被判顺子 | P0 | Logic |
| TC-TX-102 | A2345（wheel）高牌应为 5 | 顺子高张=5，比较正确 | P0 | Logic |
| TC-TX-103 | 平局（board plays） | 当前实现会选单一赢家；登记为规则缺口（非 bug 或需求） | P1 | Logic/产品 |
| TC-TX-104 | all-in/边池 | 当前实现不支持；应稳定报错且不分叉 | P0 | Socket/DB |

---

## 4. 炸金花（zhajinhua）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-ZJH-001 | 开局底注：每人 ante 入池 | pot=ante*人数；扣款一致 | P0 | Logic/DB |
| TC-ZJH-002 | see：非回合也可看牌 | playerSeen=true；不影响 currentPlayer | P2 | Logic |
| TC-ZJH-003 | 看牌后下注翻倍 | 闷牌=baseBet；看牌=baseBet*2 | P1 | Logic |
| TC-ZJH-004 | raise：newBaseBet≤baseBet*maxRaiseMultiplier | 超限报错；状态不变 | P1 | Logic |
| TC-ZJH-005 | compare：目标非法（自己/非active） | 报错；状态不变 | P1 | Logic |
| TC-ZJH-006 | compare 成本入池 | pot 增加 cost；扣款正确 | P0 | Logic/DB |
| TC-ZJH-007 | 235 吃豹子（enable235=true） | 杂色235胜豹子；否则不触发 | P1 | Logic |
| TC-ZJH-008 | enable235=false | 235 不再特殊；按普通散牌比较 | P1 | Logic |

---

## 5. 五子棋（wuziqi）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-GMK-001 | 坐标越界/非法坐标 | 报错；棋盘不变 | P1 | Logic |
| TC-GMK-002 | 重复落子 | 报错；棋盘不变 | P1 | Logic |
| TC-GMK-003 | 非自己回合落子 | 报错；棋盘不变 | P0 | Logic |
| TC-GMK-004 | 五连胜利 | 返回结果 winnerId；totalPot=200 | P0 | Logic |
| TC-GMK-005 | 六连胜利（当前自由规则） | 当前实现判胜；若产品要“恰好五连”则登记需求缺口 | P2 | 产品/Logic |
| TC-GMK-006 | surrender | 对手胜；立即结算 | P0 | Socket/Logic |

---

## 6. 21点（blackjack）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-BJ-001 | 开局发牌与暗牌 | 玩家各 2 张；庄家 1 明 1 暗（对局中不泄露暗牌） | P1 | Socket/Logic |
| TC-BJ-002 | hit 要牌 | 手牌+1；点数>21 爆牌并结束回合 | P0 | Socket/Logic |
| TC-BJ-003 | stand 停牌 | 轮到下一玩家；全员结束后庄家按 <17 规则补牌 | P1 | Socket/Logic |
| TC-BJ-004 | double 加倍 | 仅起手可用；追加下注并自动补 1 张后停牌/爆牌 | P0 | Socket/DB |
| TC-BJ-005 | 结算：win/push/lose | chipsChange 分别为 bet*2 / bet / 0；战绩净变化正确 | P0 | DB/Logic |

---

## 7. 牛牛（niuniu）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-NN-001 | 开局发 5 张 | 每位玩家 5 张；庄家固定为座位1 | P1 | Socket/Logic |
| TC-NN-002 | reveal 亮牌 | 不限制回合；所有人亮牌后自动结算 | P1 | Socket/Logic |
| TC-NN-003 | settle 强制结算 | 仅庄家可结算；结算后 game:finished | P1 | Socket/Logic |
| TC-NN-004 | 结算：对庄输赢 | 逐一对庄比较；win/push/lose 的 chipsChange 正确 | P0 | DB/Logic |

---

## 8. 骰宝（touzi_bao）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-DB-001 | place_bet 回合下注 | 仅当前玩家可下注；记录 selection 与 amount；扣款正确 | P0 | Socket/DB |
| TC-DB-002 | roll 开奖权限 | 仅座位1可 roll；否则 game:error | P1 | Socket |
| TC-DB-003 | 豹子通杀 | 三骰相同则全员判负 | P1 | Logic |
| TC-DB-004 | big/small 判定 | 11–17 big、4–10 small（非豹子）；押中 chipsChange=bet*2 | P0 | Logic/DB |

---

## 9. 斗地主（doudizhu）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-DDZ-001 | 叫分流程 | 3 人依次 bid；结束后进入 playing；landlordId 存在且拿到 3 张底牌 | P1 | Socket/Logic |
| TC-DDZ-002 | 出牌校验 | play 的 cardIds 必须在手牌中；牌型必须可识别（含三带/连对/飞机/四带） | P0 | Socket/Logic |
| TC-DDZ-003 | 过牌规则 | lastPlay 存在且不是自己时才能 pass；全员过牌后 lastPlay 清空 | P1 | Logic |
| TC-DDZ-004 | 结算 | 任一玩家手牌出完或 surrender 触发结束；winner 得 pot | P0 | DB/Logic |

---

## 10. 跑得快（paodekuai）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-PDK-001 | 2-4 人发牌 | 按人数均分/轮发；handsCount 合计=52 | P1 | Logic |
| TC-PDK-002 | 出牌/过牌 | play 校验归属与牌型（含三带/连对）；pass 仅在 lastPlay 存在时允许 | P1 | Socket/Logic |
| TC-PDK-003 | 结算 | 手牌出完或 surrender 结束；winner 得 pot | P0 | DB/Logic |

---

## 11. 升级（shengji）用例（可玩规则版）
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-SJ-001 | 4 人发牌 | 默认两副 52 牌均分；handsCount 合计=104；handSize 可配置缩短对局 | P1 | Logic |
| TC-SJ-002 | 跟牌规则 | 有 TRUMP 必须跟主；有首家花色必须跟花色 | P0 | Logic |
| TC-SJ-003 | 赢墩规则 | 本墩有 TRUMP 则 TRUMP 最大者赢；否则首家花色最大者赢 | P1 | Logic |
| TC-SJ-004 | 计分与结算 | 5/10/K 计分进入 teamPoints；胜方两人平分 pot | P0 | DB/Logic |

---

## 12. 麻将（sichuan/guangdong/guobiao/ren）用例（最小可测实现）
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-MJ-001 | 开局发牌 | 庄家 14 张，其余 13 张；wallCount 合理 | P1 | Logic |
| TC-MJ-002 | discard 流程 | 仅当前玩家可弃牌；lastDiscard 正确；下家自动摸 1 张 | P0 | Socket/Logic |
| TC-MJ-003 | hu 条件 | 仅当前玩家且满足 4 组面子+1 对时可自摸胡；否则报错 | P1 | Logic |
| TC-MJ-004 | ron 点炮胡 | 对 lastDiscard 可 ron；否则报错 | P1 | Socket/Logic |
| TC-MJ-005 | peng/chi/gang | peng/chi/gang 校验 useTileIds；吃牌仅下家；杠后补牌 | P0 | Socket/Logic |
| TC-MJ-006 | settle 强制结算 | 可触发强制结算（用于超时/测试）；winnerId 与 chipsChange 写入正确 | P1 | Socket/DB |
| TC-MJ-007 | surrender | 任意时刻 surrender 能结束并正确结算 | P1 | Socket/Logic |

---

## 13. 中国象棋/国际象棋/军棋/围棋用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-BOARD-001 | 象棋走子校验 | 马腿/象眼/炮架/过河兵/九宫/将帅照面均正确 | P0 | Logic |
| TC-BOARD-002 | 象棋将军/将死 | 不能送将；将死触发结束 | P1 | Logic |
| TC-BOARD-003 | 国际象棋特殊规则 | 易位/吃过路兵/兵升变（默认后）正确 | P0 | Logic |
| TC-BOARD-004 | 国际象棋将军/将死 | 不能送将；将死触发结束 | P1 | Logic |
| TC-BOARD-005 | 围棋提子/劫/禁入 | 落子可提子；禁入点报错；ko 复盘报错 | P0 | Logic |
| TC-BOARD-006 | 围棋 pass/结算 | 连续两次 pass 自动结算；胜负按 stones+captures+komi | P1 | Logic |
| TC-BOARD-007 | 军棋 setup/战斗 | setup 校验棋子集合与区域；炸弹同归；工兵挖雷；夺旗结束 | P1 | Logic |
| TC-BOARD-008 | surrender | 任意一方 surrender 结束并结算 | P1 | Socket/Logic |

---

## 14. 二八杠（erbaban）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-EBB-001 | roll 回合掷骰 | 仅当前玩家可 roll；每人仅一次 | P1 | Socket/Logic |
| TC-EBB-002 | 结算 | 全员 roll 后自动结算；winner 得 pot | P1 | DB/Logic |

---

## 15. 语音（Voice）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-VOICE-001 | 非房间成员加入语音 | 被拒绝并提示错误 | P1 | Socket |
| TC-VOICE-002 | 加入语音后 participants 列表正确 | 返回当前在线成员 userIds | P1 | Socket |
| TC-VOICE-003 | 多人信令转发 | toId 收到 voice:signal；其他人不收到 | P0 | Socket |
| TC-VOICE-004 | 断网重连后语音状态 | 需要重新 join；UI 显示一致 | P2 | UI/Socket |

---

## 16. 局内聊天（Game Chat）用例
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-CHAT-001 | 发送文本消息 | 广播 chat_message；落库字段一致 | P1 | Socket/DB |
| TC-CHAT-002 | 极长消息/特殊字符 | 不崩溃；有长度限制则提示 | P2 | UI/API |
| TC-CHAT-003 | 弱网下重复发送 | 不出现重复落库或可被识别去重（若未实现则登记缺陷/需求） | P2 | DB/UI |

---

## 17. 断线/弱网/并发（基线用例）
| 用例ID | 场景 | 预期 | 严重度 | 覆盖层 |
|---|---|---|---|---|
| TC-NET-001 | 断网 10s 恢复 | 自动重连或提示重连；恢复后 state_update 与 hand 补发 | P0 | UI/Socket |
| TC-NET-002 | 切网（Wi‑Fi⇄蜂窝） | 不丢状态；若断线也能恢复 | P0 | 真机 |
| TC-NET-003 | 后台挂起 60s | 回来后可继续；若断线则引导重连 | P0 | iOS 真机 |
| TC-CON-001 | 同一用户双端同时操作 | 服务端以回合/权限裁决；前端不分叉 | P0 | Socket |
| TC-CON-002 | 两用户同时 start | 只允许房主且仅一次开局成功 | P0 | Socket |
