<template>
  <div class="h-screen w-screen bg-black text-white overflow-hidden">
    <div v-if="shouldEnforceFullscreen" class="absolute inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div class="w-[80vw] max-w-[60vh] rounded-[2vh] border border-white/10 bg-white/5 p-[4vh]">
        <div class="text-[4.2vh] font-black">进入对局需要横屏全屏</div>
        <div class="mt-[1.5vh] text-[2.6vh] text-white/50 leading-relaxed">
          请先将设备旋转为横屏，然后点击下方按钮进入全屏。
        </div>
        <div class="mt-[4vh] grid grid-cols-1 gap-[2vh]">
          <button class="glass-btn-primary py-[2vh] rounded-[1.5vh] font-bold text-[2.8vh] active:scale-95 transition-all" @click="enterFullscreenAndLandscape">
            进入全屏横屏
          </button>
          <button class="glass-btn py-[2vh] rounded-[1.5vh] font-bold text-[2.8vh] active:scale-95 transition-all" @click="reloadPage">
            刷新页面
          </button>
        </div>
      </div>
    </div>

    <div class="h-full flex flex-col">
      <div class="h-[9vh] flex items-center justify-between px-[2vw] border-b border-white/10 bg-white/5">
        <div class="min-w-0">
          <div class="text-[3.2vh] font-black truncate">{{ gameTitle }} · 房间 {{ roomId }}</div>
          <div class="text-[2.2vh] text-white/40 uppercase tracking-widest truncate">{{ gameType }}</div>
        </div>
        <div class="flex items-center gap-[1vw]">
          <button class="glass-btn px-[1.5vw] py-[1vh] rounded-[1vh] text-[2.3vh] font-bold active:scale-95 transition-all" @click="toggleFullscreen">
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </button>
          <button class="glass-btn px-[1.5vw] py-[1vh] rounded-[1vh] text-[2.3vh] font-bold active:scale-95 transition-all" @click="exitToLobby">
            退出
          </button>
        </div>
      </div>

      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <div class="flex flex-col items-center gap-[2vh]">
          <div class="w-[7vh] h-[7vh] border-[0.6vh] border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div class="text-white/40 text-[2.6vh] font-medium">正在加载对局数据...</div>
        </div>
      </div>

      <div v-else class="flex-1 flex overflow-hidden">
        <!-- 功能区 (向左折叠) -->
        <div :class="[
          'border-r border-white/10 bg-white/5 overflow-hidden flex flex-col transition-all duration-300 ease-in-out',
          collapsed.leftColumn ? uiProfile.compactPanelWidth : uiProfile.leftPanelWidth
        ]">
          <div class="h-[8vh] px-[1vw] border-b border-white/10 flex items-center" :class="collapsed.leftColumn ? 'justify-center' : 'justify-between px-[1.5vw]'">
            <div v-show="!collapsed.leftColumn" class="text-[2.6vh] font-black whitespace-nowrap">功能区</div>
            <button type="button" class="glass-btn p-[1vh] rounded-[1vh] text-[2.1vh] font-bold active:scale-95 transition-all flex items-center justify-center" 
                    :title="collapsed.leftColumn ? '展开功能区' : '折叠功能区'"
                    @click="collapsed.leftColumn = !collapsed.leftColumn">
              <svg class="w-[2.5vh] h-[2.5vh] transition-transform duration-300" :class="collapsed.leftColumn ? 'rotate-180' : 'rotate-0'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div v-show="!collapsed.leftColumn" class="flex-1 overflow-y-auto p-[1.5vh] space-y-[1.5vh]">
            <div v-if="!isWuziqiGame" class="rounded-[1.5vh] border border-white/10 bg-black/40 overflow-hidden">
              <button type="button" class="w-full px-[1.5vw] py-[2vh] flex items-center justify-between" @click="collapsed.leftInfo = !collapsed.leftInfo">
                <div class="text-[2.2vh] text-white/40">牌局信息</div>
                <svg class="w-[2.5vh] h-[2.5vh] text-white/40 transition-transform duration-200" :class="collapsed.leftInfo ? '-rotate-90' : 'rotate-0'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div v-show="!collapsed.leftInfo" class="px-[1.5vw] pb-[2vh]">
                <div class="grid grid-cols-2 gap-[1vw] text-[2.3vh]">
                  <div class="rounded-[1vh] bg-white/5 p-[1.5vh]">
                    <div class="text-[1.8vh] text-white/40">底池</div>
                    <div class="mt-[0.5vh] font-black">{{ pot }}</div>
                  </div>
                  <div class="rounded-[1vh] bg-white/5 p-[1.5vh]">
                    <div class="text-[1.8vh] text-white/40">当前下注</div>
                    <div class="mt-[0.5vh] font-black">{{ currentBet }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-[1.5vh] border border-white/10 bg-black/40 overflow-hidden">
              <button type="button" class="w-full px-[1.5vw] py-[2vh] flex items-center justify-between" @click="collapsed.leftActions = !collapsed.leftActions">
                <div class="flex items-center gap-[1vw]">
                  <div class="text-[2.2vh] text-white/40">{{ isWeiqiGame || isBoardMoveGame || isWuziqiGame ? '棋局操作' : '下注操作' }}</div>
                  <div class="text-[1.8vh] px-[1vw] py-[0.5vh] rounded-full border"
                       :class="isMyTurn ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-white/10 bg-white/5 text-white/40'">
                    {{ isMyTurn ? '你的回合' : '等待中' }}
                  </div>
                </div>
                <svg class="w-[2.5vh] h-[2.5vh] text-white/40 transition-transform duration-200" :class="collapsed.leftActions ? '-rotate-90' : 'rotate-0'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div v-show="!collapsed.leftActions" class="px-[1.5vw] pb-[2vh]">
                <PokerControls 
                  v-if="['zhajinhua', 'texas_holdem', 'blackjack', 'niuniu', 'shengji', 'doudizhu', 'paodekuai'].includes(effectiveGameType)"
                  :game-type="effectiveGameType"
                  :game-state="stateSnapshot"
                  :my-user-id="currentUserId"
                  :is-my-turn="isMyTurn"
                  :is-finished="isFinished"
                  :can-act="canAct"
                  :my-seen="mySeen"
                  :my-unit-bet="myUnitBet"
                  :allow-compare="allowCompare"
                  v-model:bet-amount="betAmount"
                  :selected-card-ids="selectedCardIds"
                  @action="emitAction"
                  @openCompare="openCompare"
                />

                <MahjongControls
                  v-else-if="isMahjongGame"
                  :game-state="stateSnapshot"
                  :my-user-id="currentUserId"
                  :is-finished="isFinished"
                  :can-act="canAct"
                  :selected-tile-ids="selectedTileIds"
                  :hand="handInfo"
                  :players="roomPlayers"
                  @action="emitAction"
                  @clearSelection="selectedTileIds = []"
                />

                <ChessControls
                  v-else-if="isWeiqiGame || isBoardMoveGame || effectiveGameType === 'wuziqi'"
                  :game-type="effectiveGameType"
                  :game-state="stateSnapshot"
                  :my-user-id="currentUserId"
                  :is-finished="isFinished"
                  :can-act="canAct"
                  v-model:selected-from="selectedFrom"
                  v-model:junqi-auto-setup-seed="junqiAutoSetupSeed"
                  @action="emitAction"
                />

                <div v-else-if="isDiceBaoGame" class="grid grid-cols-1 gap-[1.2vh]">
                  <div class="grid grid-cols-3 gap-[0.8vh]">
                    <button class="glass-btn py-[1.2vh] rounded-[1vh] text-[2.1vh] font-black active:scale-95 transition-all"
                            :class="diceBaoSelection === 'small' ? 'border-primary/40 bg-primary/10' : ''"
                            :disabled="isFinished"
                            @click="diceBaoSelection = 'small'">
                      小
                    </button>
                    <button class="glass-btn py-[1.2vh] rounded-[1vh] text-[2.1vh] font-black active:scale-95 transition-all"
                            :class="diceBaoSelection === 'big' ? 'border-primary/40 bg-primary/10' : ''"
                            :disabled="isFinished"
                            @click="diceBaoSelection = 'big'">
                      大
                    </button>
                    <button class="glass-btn py-[1.2vh] rounded-[1vh] text-[2.1vh] font-black active:scale-95 transition-all"
                            :class="diceBaoSelection === 'triple' ? 'border-primary/40 bg-primary/10' : ''"
                            :disabled="isFinished"
                            @click="diceBaoSelection = 'triple'">
                      豹子
                    </button>
                  </div>
                  <input v-model.number="diceBaoBetAmount" type="number" min="1" class="glass-input w-full text-[2.3vh] py-[1.2vh]" placeholder="下注金额" />
                  <button class="glass-btn-primary w-full py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
                          :disabled="!canAct || !diceBaoSelection || !diceBaoBetAmount"
                          @click="emitAction('place_bet', { selection: diceBaoSelection, amount: diceBaoBetAmount })">
                    下注
                  </button>
                  <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
                          :disabled="isFinished || String(diceBaoRollerId) !== String(currentUserId)"
                          @click="emitAction('roll')">
                    开奖
                  </button>
                </div>

                <div v-else-if="isErbabanGame" class="grid grid-cols-1 gap-[1.5vh]">
                  <button class="glass-btn-primary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
                          :disabled="isFinished || !canAct"
                          @click="emitAction('roll')">
                    掷骰
                  </button>
                  <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
                          :disabled="isFinished"
                          @click="emitAction('surrender')">
                    认输
                  </button>
                </div>

                <div v-else class="grid grid-cols-1 gap-[1.5vh]">
                    <div class="text-[1.8vh] text-white/40 text-center py-[2vh]">通用对局模式</div>
                    <button class="glass-btn-primary py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] active:scale-95 transition-all disabled:opacity-40"
                          :disabled="!canAct"
                          @click="emitAction('win')">
                      声明获胜
                    </button>
                    <button class="glass-btn py-[1.8vh] rounded-[1.2vh] font-black text-[2.3vh] text-red-300 active:scale-95 transition-all disabled:opacity-40"
                          :disabled="!canAct"
                          @click="emitAction('surrender')">
                      认输/弃牌
                    </button>
                </div>
              </div>
            </div>

            <div v-if="actionLog.length" class="rounded-[1.5vh] border border-white/10 bg-black/40 overflow-hidden">
              <button type="button" class="w-full px-[1.5vw] py-[2vh] flex items-center justify-between" @click="collapsed.leftLog = !collapsed.leftLog">
                <div class="text-[2.2vh] text-white/40">动作记录</div>
                <svg class="w-[2.5vh] h-[2.5vh] text-white/40 transition-transform duration-200" :class="collapsed.leftLog ? '-rotate-90' : 'rotate-0'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div v-show="!collapsed.leftLog" class="px-[1.5vw] pb-[2vh]">
                <div class="space-y-[0.8vh]">
                  <div v-for="a in actionLog.slice(0, 12)" :key="a.id" class="text-[2.1vh] text-white/70">
                    {{ a.text }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 中间游戏区域 (优先展示) -->
        <div class="flex-1 bg-gradient-to-b from-black to-black/80 overflow-hidden">
          <div class="h-full p-[2vh] flex flex-col gap-[2vh]">
            <div v-if="!isWuziqiGame" class="rounded-[2vh] border border-white/10 bg-white/5 p-[2vh]">
              <div class="grid grid-cols-3 items-center gap-[1.5vw]">
                <div class="min-w-0">
                  <div class="text-[2.1vh] text-white/40 uppercase tracking-wider">上一个玩家</div>
                  <div class="mt-[1vh] flex items-center gap-[0.8vw]">
                    <img v-if="prevPlayerId" :src="getPlayerAvatar(prevPlayerId)" class="w-[4vh] h-[4vh] rounded-full object-cover border border-white/10" />
                    <div class="text-[2.3vh] font-bold truncate text-white/60">
                      {{ prevPlayerName }}
                    </div>
                  </div>
                </div>
                <div class="min-w-0 text-center flex flex-col items-center">
                  <div class="text-[2.1vh] text-white/40 uppercase tracking-wider">当前回合</div>
                  <div class="mt-[1vh] flex items-center gap-[0.8vw]">
                    <img v-if="currentPlayerId" :src="getPlayerAvatar(currentPlayerId)" class="w-[6vh] h-[6vh] rounded-full object-cover border-2" :class="isMyTurn ? 'border-green-500/50' : 'border-white/20'" />
                    <div class="text-[2.8vh] font-black truncate" :class="isMyTurn ? 'text-green-300' : 'text-white'">
                      {{ currentPlayerName }}
                    </div>
                  </div>
                </div>
                <div class="min-w-0 text-right">
                  <div class="text-[2.1vh] text-white/40 uppercase tracking-wider">下一个玩家</div>
                  <div class="mt-[1vh] flex items-center justify-end gap-[0.8vw]">
                    <div class="text-[2.3vh] font-bold truncate text-white/60">
                      {{ nextPlayerName }}
                    </div>
                    <img v-if="nextPlayerId" :src="getPlayerAvatar(nextPlayerId)" class="w-[4vh] h-[4vh] rounded-full object-cover border border-white/10" />
                  </div>
                </div>
              </div>
              <div v-if="lastActionText" class="mt-[1.5vh] text-[2.2vh] text-center text-white/50 bg-white/5 py-[0.8vh] rounded-[1vh] border border-white/5">
                {{ lastActionText }}
              </div>
              <div v-if="compareMode" class="mt-[1.5vh] text-[2.2vh] text-center text-yellow-300/80 animate-pulse">
                请在右侧玩家列表选择比牌对象
              </div>
            </div>

            <div class="flex-1 rounded-[2vh] border border-white/10 bg-white/5 flex flex-col" :class="isWuziqiGame ? 'p-[1vh] overflow-hidden' : 'p-[2vh] overflow-auto'">
              <PokerBoard
                v-if="['zhajinhua', 'texas_holdem', 'blackjack', 'niuniu', 'shengji', 'doudizhu', 'paodekuai'].includes(effectiveGameType)"
                :game-type="effectiveGameType"
                :game-state="stateSnapshot"
                :my-user-id="currentUserId"
                :is-finished="isFinished"
                :pot="pot"
                :my-unit-bet="myUnitBet"
                :display-hand="displayHand"
                :should-hide-my-hand="shouldHideMyHand"
                :players="roomPlayers"
                v-model:selected-card-ids="selectedCardIds"
              />

              <MahjongBoard
                v-else-if="isMahjongGame"
                :game-state="stateSnapshot"
                :my-user-id="currentUserId"
                :display-hand="displayHand"
                :selected-tile-ids="selectedTileIds"
                :players="roomPlayers"
                @update:selectedTileIds="val => selectedTileIds = val"
              />

              <ChessBoard
                v-else-if="isWeiqiGame || isBoardMoveGame || effectiveGameType === 'wuziqi'"
                :game-type="effectiveGameType"
                :game-state="stateSnapshot"
                :my-user-id="currentUserId"
                :is-finished="isFinished"
                :can-act="canAct"
                v-model:selected-from="selectedFrom"
                @action="emitAction"
              />

              <DiceBoard
                v-else-if="isDiceBaoGame || isErbabanGame"
                :game-type="effectiveGameType"
                :game-state="stateSnapshot"
                :my-user-id="currentUserId"
                :players="roomPlayers"
              />

              <div v-else class="flex-1 flex flex-col overflow-auto">
                <div class="flex items-center justify-between">
                  <div class="text-[2.2vh] text-white/40">通用对局模式</div>
                  <div class="text-[3.8vh] font-black text-yellow-400 flex items-center gap-[0.5vw]">
                    <span class="text-[2.6vh]">💰</span> {{ pot }}
                  </div>
                </div>
                <div class="mt-[2vh] flex-1 flex flex-col items-center justify-center gap-[4vh]">
                   <div class="text-center text-white/30">
                      <div class="text-[8vh]">🎲</div>
                      <div class="mt-[1vh] text-[2.2vh]">等待游戏数据...</div>
                   </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- 房间工具 (向右折叠) -->
        <div :class="[
          'border-l border-white/10 bg-white/5 overflow-hidden flex flex-col transition-all duration-300 ease-in-out',
          collapsed.rightColumn ? uiProfile.compactPanelWidth : uiProfile.rightPanelWidth
        ]">
          <div class="h-[8vh] px-[1vw] border-b border-white/10 flex items-center" :class="collapsed.rightColumn ? 'justify-center' : 'justify-between px-[1.5vw]'">
            <div v-show="!collapsed.rightColumn" class="flex items-center gap-[0.5vw] overflow-hidden">
              <div class="text-[2.6vh] font-black whitespace-nowrap">房间工具</div>
            </div>
            <div class="flex items-center gap-[1vw]">
              <button v-if="!collapsed.rightColumn && isOwner" class="glass-btn px-[1vw] py-[0.8vh] rounded-[1vh] text-[1.8vh] font-bold active:scale-95 transition-all whitespace-nowrap" @click="toggleKickMode">
                {{ kickMode ? '完成' : '踢人' }}
              </button>
              <button type="button" class="glass-btn p-[1vh] rounded-[1vh] text-[2.1vh] font-bold active:scale-95 transition-all flex items-center justify-center"
                      :title="collapsed.rightColumn ? '展开房间工具' : '折叠房间工具'"
                      @click="collapsed.rightColumn = !collapsed.rightColumn">
                <svg class="w-[2.5vh] h-[2.5vh] transition-transform duration-300" :class="collapsed.rightColumn ? 'rotate-180' : 'rotate-0'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div v-show="!collapsed.rightColumn" class="flex-1 overflow-y-auto p-[1.5vh] space-y-[1.5vh]">
            <div class="rounded-[1.5vh] border border-white/10 bg-black/40 overflow-hidden">
              <button type="button" class="w-full px-[1.5vw] py-[2vh] flex items-center justify-between" @click="collapsed.rightPlayers = !collapsed.rightPlayers">
                <div class="text-[2.2vh] text-white/40">玩家列表</div>
                <svg class="w-[2.5vh] h-[2.5vh] text-white/40 transition-transform duration-200" :class="collapsed.rightPlayers ? '-rotate-90' : 'rotate-0'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div v-show="!collapsed.rightPlayers" class="px-[1.5vw] pb-[2vh] space-y-[1vh]">
                <div v-for="p in sortedPlayers" :key="p.user_id" class="flex items-center justify-between gap-[1vw] rounded-[1vh] bg-white/5 px-[1.2vw] py-[1vh]">
                  <div class="flex items-center gap-[1vw] min-w-0">
                    <img :src="getImageUrl(p.avatar)" class="w-[4.5vh] h-[4.5vh] rounded-full object-cover border border-white/10 flex-shrink-0" />
                    <div class="min-w-0">
                      <div class="text-[2.3vh] font-bold truncate">
                        {{ p.nickname || p.username || ('用户' + p.user_id) }}
                        <span v-if="String(p.user_id) === String(room?.creator_id)" class="ml-[0.5vw] text-[1.8vh] text-yellow-300">房主</span>
                        <span v-if="String(p.user_id) === String(currentUserId)" class="ml-[0.5vw] text-[1.8vh] text-green-300">你</span>
                      </div>
                      <div class="text-[1.8vh] text-white/40 truncate">
                        <span class="text-yellow-400/80">💰 {{ p.total_chips || 0 }}</span> · 下注 {{ getPlayerBet(p.user_id) }} · {{ getPlayerStatusText(p.user_id) }} · {{ getPlayerSeenText(p.user_id) }}
                        <span v-if="p.is_ready && isFinished" class="ml-[0.3vw] text-green-400 font-bold">已准备</span>
                        <span v-if="sessionProfits[String(p.user_id)] !== undefined" 
                              class="ml-[0.3vw] px-[0.4vw] py-[0.2vh] rounded-md bg-white/5 font-mono"
                              :class="sessionProfits[String(p.user_id)] >= 0 ? 'text-green-400' : 'text-red-400'">
                          {{ sessionProfits[String(p.user_id)] >= 0 ? '+' : '' }}{{ sessionProfits[String(p.user_id)] }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-[0.5vw]">
                    <button v-if="kickMode && canKick(p.user_id)" class="glass-btn px-[0.8vw] py-[0.5vh] rounded-[0.8vh] text-[1.8vh] font-bold text-red-300 active:scale-95 transition-all"
                            @click="kick(p.user_id)">
                      踢出
                    </button>
                    <button v-else-if="compareMode && canCompareTarget(p.user_id)" class="glass-btn px-[0.8vw] py-[0.5vh] rounded-[0.8vh] text-[1.8vh] font-bold active:scale-95 transition-all"
                            @click="compareWith(p.user_id)">
                      比牌
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-[1.5vh] border border-white/10 bg-black/40 overflow-hidden">
              <button type="button" class="w-full px-[1.5vw] py-[2vh] flex items-center justify-between" @click="collapsed.rightChat = !collapsed.rightChat">
                <div class="text-[2.2vh] text-white/40">房间聊天</div>
                <svg class="w-[2.5vh] h-[2.5vh] text-white/40 transition-transform duration-200" :class="collapsed.rightChat ? '-rotate-90' : 'rotate-0'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div v-show="!collapsed.rightChat" class="px-[1.5vw] pb-[2vh]">
                <div ref="chatListEl" class="h-[25vh] overflow-y-auto space-y-[0.8vh] pr-[0.3vw]">
                  <div v-for="m in chatMessages" :key="m.id" class="text-[2.1vh] leading-relaxed">
                    <span class="text-white/40">{{ m.senderName }}：</span>
                    <span class="text-white/80">{{ m.message }}</span>
                  </div>
                </div>
                <div class="mt-[1.5vh] flex gap-[0.5vw]">
                  <input v-model="chatInput" class="glass-input flex-1 py-[0.8vh] text-[2.1vh]" placeholder="输入消息..." @keydown.enter="sendChat" />
                  <button class="glass-btn-primary px-[1vw] rounded-[1vh] font-black text-[2.1vh] active:scale-95 transition-all" @click="sendChat">发送</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 游戏结束弹窗 -->
    <div v-if="showResultModal" class="fixed inset-0 z-[100] flex items-center justify-center p-[2vh] bg-black/80 backdrop-blur-md">
      <div class="w-full max-w-[50vh] glass-panel overflow-hidden animate-in fade-in zoom-in duration-300 rounded-[2vh]">
        <div class="p-[3vh] text-center">
          <div class="mb-[2vh] inline-flex h-[12vh] w-[12vh] items-center justify-center rounded-full"
               :class="isWinner ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 text-white/40'">
            <span class="text-[8vh]">{{ isWinner ? '🏆' : '🃏' }}</span>
          </div>
          <h2 class="text-[4vh] font-black" :class="isWinner ? 'text-yellow-300' : 'text-white'">
            {{ isWinner ? '恭喜获胜！' : '下次努力' }}
          </h2>
          <div v-if="winnerInfo" class="mt-[1.5vh] flex flex-col items-center gap-[0.5vh]">
            <div class="text-[2.2vh] text-white/80">
              <span class="text-white/40">赢家：</span>
              <span class="font-bold">{{ getPlayerNickname(winnerInfo.userId) }}</span>
              <span v-if="winnerInfo.handType" class="ml-[1vw] px-[0.8vw] py-[0.2vh] bg-white/10 rounded text-[1.8vh] font-bold text-yellow-300">
                {{ winnerInfo.handType }}
              </span>
            </div>
            <p class="text-[1.8vh] text-white/50">
              {{ isWinner ? `你赢得了 ${gameResult?.totalPot || 0} 筹码` : `本局总底池为 ${gameResult?.totalPot || 0}` }}
            </p>
          </div>
          <p v-else class="mt-[1.5vh] text-[2.2vh] text-white/60">
            {{ isWinner ? `你赢得了 ${gameResult?.totalPot || 0} 筹码` : '本局已结束' }}
          </p>
          
          <div class="mt-[4vh] space-y-[1.5vh]">
            <button class="w-full glass-btn-primary py-[2vh] rounded-[1.5vh] font-black text-[2.8vh] active:scale-95 transition-all disabled:opacity-50"
                    :disabled="isReady && (!isOwner || !isEveryoneReady)"
                    @click="startNextGame">
              {{ getNextGameButtonText }}
              <span v-if="startCountdown !== null" class="ml-[0.5vw] text-[2vh] opacity-60">({{ startCountdown }}s)</span>
            </button>
            <button class="w-full glass-btn py-[2vh] rounded-[1.5vh] font-black text-[2.8vh] text-white/60 active:scale-95 transition-all"
                    @click="exitToLobby">
              退出 ({{ resultCountdown }}s)
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toast.show" class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div :class="[
        'px-6 py-3 rounded-2xl shadow-xl backdrop-blur-md border font-bold text-sm',
        toast.type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'
      ]">
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import { getSocket, initSocket } from '@/utils/socket';
import { getImageUrl } from '@/utils/imageUrl';
import { audioManager } from '@/utils/audio';
import { getGameUiProfile } from '@/games/uiProfile';
import PokerCard from '@/components/PokerCard.vue';
import GomokuBoard from '@/components/GomokuBoard.vue';
import BoardGrid from '@/components/BoardGrid.vue';
import MahjongTile from '@/components/MahjongTile.vue';

const DiceBoard = defineAsyncComponent(() => import('@/components/games/boards/DiceBoard.vue'));
const PokerControls = defineAsyncComponent(() => import('@/components/games/controls/PokerControls.vue'));
const PokerBoard = defineAsyncComponent(() => import('@/components/games/boards/PokerBoard.vue'));
const MahjongControls = defineAsyncComponent(() => import('@/components/games/controls/MahjongControls.vue'));
const MahjongBoard = defineAsyncComponent(() => import('@/components/games/boards/MahjongBoard.vue'));
const ChessControls = defineAsyncComponent(() => import('@/components/games/controls/ChessControls.vue'));
const ChessBoard = defineAsyncComponent(() => import('@/components/games/boards/ChessBoard.vue'));

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error',
});

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
}

const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
let inactivityTimer: any = null;

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    exitToLobby();
  }, INACTIVITY_TIMEOUT);
}

function setupInactivityListeners() {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => window.addEventListener(event, resetInactivityTimer));
}

function removeInactivityListeners() {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
  if (inactivityTimer) clearTimeout(inactivityTimer);
}

const roomId = computed(() => String(route.params.roomId || ''));
const gameType = computed(() => String(route.params.gameType || 'zhajinhua'));

const room = ref<any>(null);
const roomPlayers = ref<any[]>([]);

const stateSnapshot = ref<any>({});
const handInfo = ref<any>([]);
const isFinished = ref(false);
const showResultModal = ref(false);
const gameResult = ref<any>(null);
const resultCountdown = ref(10);
const startCountdown = ref<number | null>(null);
const isReady = ref(false);
let resultTimer: any = null;
let startTimer: any = null;
const loading = ref(true);
const refreshTimer = ref<any>(null);

const chatMessages = ref<{ id: string; senderName: string; message: string }[]>([]);
const chatInput = ref('');
const chatListEl = ref<HTMLElement | null>(null);

const actionLog = ref<{ id: string; text: string }[]>([]);
const lastAction = ref<any>(null);

// 追踪本场对局的总盈亏 (用户ID -> 数值)
const sessionProfits = ref<Record<string, number>>({});
const sessionProfitsStorageKey = computed(() => `ttg:game:sessionProfits:${roomId.value}`);
const sessionProfitsLoadedSignature = ref<string | null>(null);

function getRoomSignature() {
  const createdAt = (room.value && (room.value.created_at || room.value.createdAt)) || '';
  return `${roomId.value}:${String(createdAt)}`;
}

function loadSessionProfitsFromStorage() {
  const signature = getRoomSignature();
  if (!signature || sessionProfitsLoadedSignature.value === signature) return;

  sessionProfitsLoadedSignature.value = signature;

  try {
    const raw = localStorage.getItem(sessionProfitsStorageKey.value);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.signature && parsed.signature !== signature) {
      localStorage.removeItem(sessionProfitsStorageKey.value);
      return;
    }
    const profits = parsed.profits;
    if (!profits || typeof profits !== 'object') return;
    sessionProfits.value = { ...profits };
  } catch {}
}

function saveSessionProfitsToStorage() {
  const signature = getRoomSignature();
  if (!signature) return;
  try {
    localStorage.setItem(
      sessionProfitsStorageKey.value,
      JSON.stringify({ signature, profits: sessionProfits.value })
    );
  } catch {}
}

const kickMode = ref(false);
const compareMode = ref(false);

const betAmount = ref<number>(10);
const diceBaoBetAmount = ref<number>(10);
const diceBaoSelection = ref<'big' | 'small' | 'triple' | ''>('');

const selectedCardIds = ref<string[]>([]);
const selectedTileIds = ref<string[]>([]);
const selectedFrom = ref<{ x: number; y: number } | null>(null);
const junqiAutoSetupSeed = ref<number>(1);

const currentUserId = computed(() => authStore.user?.id);
const isOwner = computed(() => !!room.value && String(room.value.creator_id) === String(currentUserId.value));

const viewportWidth = ref<number>(window.innerWidth);
const viewportHeight = ref<number>(window.innerHeight);

const collapsed = ref({
  leftColumn: false,
  leftInfo: false,
  leftActions: false,
  leftLog: false,
  rightColumn: false,
  rightPlayers: false,
  rightChat: false,
});

const isMyTurn = computed(() => String(stateSnapshot.value?.currentPlayer || '') === String(currentUserId.value || ''));
const canAct = computed(() => !!currentUserId.value && isMyTurn.value && !isFinished.value);
const mySeen = computed(() => {
  const seen = stateSnapshot.value?.playerSeen || {};
  return !!(seen[currentUserId.value] ?? seen[String(currentUserId.value)]);
});

const effectiveGameType = computed(() => room.value?.game_code || gameType.value);
const uiProfile = computed(() => getGameUiProfile(effectiveGameType.value));
const isCompactScreen = computed(() => viewportWidth.value < uiProfile.value.autoCollapsePanelsBelowPx);
const lastAutoCompact = ref<boolean | null>(null);

const isMahjongGame = computed(() => ['sichuan_mahjong', 'guangdong_mahjong', 'guobiao_mahjong', 'ren_mahjong'].includes(effectiveGameType.value));
const isWeiqiGame = computed(() => effectiveGameType.value === 'weiqi');
const isXiangqiGame = computed(() => effectiveGameType.value === 'xiangqi');
const isInternationalChessGame = computed(() => effectiveGameType.value === 'international_chess');
const isJunqiGame = computed(() => effectiveGameType.value === 'junqi');
const isWuziqiGame = computed(() => effectiveGameType.value === 'wuziqi');
const isBoardMoveGame = computed(() => isXiangqiGame.value || isInternationalChessGame.value || isJunqiGame.value);
const isCardSelectPlayGame = computed(() => ['doudizhu', 'paodekuai'].includes(effectiveGameType.value));
const isShengjiGame = computed(() => effectiveGameType.value === 'shengji');
const isBlackjackGame = computed(() => effectiveGameType.value === 'blackjack');
const isNiuniuGame = computed(() => effectiveGameType.value === 'niuniu');
const isErbabanGame = computed(() => effectiveGameType.value === 'erbaban');
const isDiceBaoGame = computed(() => effectiveGameType.value === 'touzi_bao');

const shouldHideMyHand = computed(() => {
  if (isFinished.value) return false;
  if (effectiveGameType.value !== 'zhajinhua') return false;
  return !mySeen.value;
});

const displayHand = computed(() => {
  const hand = Array.isArray(handInfo.value) ? handInfo.value : [];
  if (effectiveGameType.value === 'zhajinhua') {
    const result = [...hand.slice(0, 3)];
    // 如果还没发牌或者是结算阶段，补齐3张展示
    while (result.length < 3) result.push({});
    return result;
  }
  return hand;
});

const boardCols = computed(() => Number(stateSnapshot.value?.boardW || (isXiangqiGame.value ? 9 : isJunqiGame.value ? 5 : 8)));
const boardRows = computed(() => Number(stateSnapshot.value?.boardH || (isXiangqiGame.value ? 10 : isJunqiGame.value ? 12 : 8)));

const boardCellSize = computed(() => {
  if (isXiangqiGame.value) return '4.9vh';
  if (isInternationalChessGame.value) return '5.4vh';
  if (isJunqiGame.value) return '4.4vh';
  return '5.2vh';
});

const boardDisplay = computed(() => {
  const b = stateSnapshot.value?.board;
  if (!Array.isArray(b)) return [];
  if (!isJunqiGame.value) return b;
  const me = String(currentUserId.value || '');
  const myColor = String(stateSnapshot.value?.redId) === me ? 'red' : String(stateSnapshot.value?.blackId) === me ? 'black' : null;
  return b.map((row: any[]) =>
    (row || []).map((cell: any) => {
      if (!cell) return null;
      if (!myColor) return cell;
      const s = String(cell);
      const isRed = s === s.toUpperCase() || s.startsWith('R');
      const isMine = myColor === 'red' ? isRed : !isRed;
      if (!isMine) return '?';
      return cell;
    })
  );
});

function toggleCardSelection(cardId: any) {
  const id = String(cardId || '');
  if (!id) return;
  if (isShengjiGame.value) {
    selectedCardIds.value = selectedCardIds.value[0] === id ? [] : [id];
    return;
  }
  if (!isCardSelectPlayGame.value) return;
  if (selectedCardIds.value.includes(id)) selectedCardIds.value = selectedCardIds.value.filter((x) => x !== id);
  else selectedCardIds.value = [...selectedCardIds.value, id];
}

function toggleTileSelection(tileId: any) {
  const id = String(tileId || '');
  if (!id) return;
  if (!isMahjongGame.value) return;
  if (selectedTileIds.value.includes(id)) selectedTileIds.value = selectedTileIds.value.filter((x) => x !== id);
  else selectedTileIds.value = [...selectedTileIds.value, id];
}

function boardCellLabel(value: any) {
  if (!value) return '';
  if (value === '?') return '?';
  if (isXiangqiGame.value) {
    const p = String(value);
    const isRed = p === p.toUpperCase();
    const lower = p.toLowerCase();
    const mapRed: Record<string, string> = { r: '车', n: '马', b: '相', a: '仕', k: '帅', c: '炮', p: '兵' };
    const mapBlack: Record<string, string> = { r: '车', n: '马', b: '象', a: '士', k: '将', c: '炮', p: '卒' };
    return isRed ? (mapRed[lower] || p) : (mapBlack[lower] || p);
  }
  if (isInternationalChessGame.value) {
    const p = String(value);
    const isWhite = p === p.toUpperCase();
    const lower = p.toLowerCase();
    const w: Record<string, string> = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
    const b: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    return isWhite ? (w[lower] || p) : (b[lower] || p);
  }
  if (isJunqiGame.value) {
    const p = String(value);
    const lower = p.toLowerCase();
    if (lower === 'f') return '旗';
    if (lower === 'm') return '雷';
    if (lower === 'b') return '炸';
    if (lower === 'e') return '工';
    if (lower.length === 2 && lower[0] === 'r' && /^[2-9]$/.test(lower[1])) return lower[1];
    return p;
  }
  return String(value);
}

function boardCellClass(value: any) {
  if (!value) return 'text-white/20';
  if (value === '?') return 'text-white/50';
  const s = String(value);
  if (isXiangqiGame.value) return s === s.toUpperCase() ? 'text-red-300' : 'text-white/90';
  if (isInternationalChessGame.value) return s === s.toUpperCase() ? 'text-white' : 'text-white/90';
  if (isJunqiGame.value) {
    const isRed = s === s.toUpperCase() || s.startsWith('R');
    return isRed ? 'text-red-300' : 'text-white/90';
  }
  return 'text-white';
}

function handleBoardCellClick(payload: { x: number; y: number }) {
  if (isFinished.value) return;
  if (!canAct.value) return;
  if (!selectedFrom.value) {
    selectedFrom.value = { x: payload.x, y: payload.y };
    return;
  }
  const from = selectedFrom.value;
  const to = { x: payload.x, y: payload.y };
  selectedFrom.value = null;
  emitAction('move', { from, to });
}

function handleWeiqiCellClick(payload: { x: number; y: number }) {
  if (isFinished.value) return;
  if (!canAct.value) return;
  emitAction('place', { x: payload.x, y: payload.y });
}

function mahjongTileText(tile: any) {
  if (!tile) return '';
  const suit = String(tile.suit);
  const rank = Number(tile.rank);
  if (suit === 'm') return `${rank}万`;
  if (suit === 'p') return `${rank}筒`;
  if (suit === 's') return `${rank}条`;
  if (suit === 'z') {
    const map: Record<number, string> = { 1: '东', 2: '南', 3: '西', 4: '北', 5: '中', 6: '发', 7: '白' };
    return map[rank] || `字${rank}`;
  }
  return `${suit}${tile.rank}`;
}

const mahjongLastDiscardTile = computed(() => stateSnapshot.value?.lastDiscard?.tile || null);
const mahjongLastDiscardFrom = computed(() => stateSnapshot.value?.lastDiscard?.playerId || null);
const mahjongSameTileIds = computed(() => {
  const d = mahjongLastDiscardTile.value;
  if (!d) return [];
  if (String(mahjongLastDiscardFrom.value) === String(currentUserId.value)) return [];
  const hand = Array.isArray(handInfo.value) ? handInfo.value : [];
  return hand.filter((t: any) => String(t.suit) === String(d.suit) && Number(t.rank) === Number(d.rank)).map((t: any) => String(t.id));
});

const mahjongAutoPengIds = computed(() => mahjongSameTileIds.value.slice(0, 2));
const mahjongAutoGangIds = computed(() => mahjongSameTileIds.value.slice(0, 3));
const canMahjongPeng = computed(() => mahjongAutoPengIds.value.length === 2);
const canMahjongGang = computed(() => mahjongAutoGangIds.value.length === 3);

const mahjongAutoChiIds = computed(() => {
  const d = mahjongLastDiscardTile.value;
  if (!d) return [];
  if (String(d.suit) === 'z') return [];
  if (!canAct.value) return [];
  if (String(mahjongLastDiscardFrom.value) === String(currentUserId.value)) return [];
  const hand = Array.isArray(handInfo.value) ? handInfo.value : [];
  const rank = Number(d.rank);
  const suit = String(d.suit);
  const pickId = (r: number) => String(hand.find((t: any) => String(t.suit) === suit && Number(t.rank) === r)?.id || '');

  const candidates: Array<[number, number]> = [
    [rank - 2, rank - 1],
    [rank - 1, rank + 1],
    [rank + 1, rank + 2]
  ];
  for (const [a, b] of candidates) {
    if (a < 1 || b > 9) continue;
    const id1 = pickId(a);
    const id2 = pickId(b);
    if (id1 && id2) return [id1, id2];
  }
  return [];
});

const canMahjongChi = computed(() => mahjongAutoChiIds.value.length === 2);

const junqiMyReady = computed(() => {
  if (!isJunqiGame.value) return true;
  const r = stateSnapshot.value?.ready || {};
  const me = String(currentUserId.value || '');
  if (String(stateSnapshot.value?.redId) === me) return !!r.red;
  if (String(stateSnapshot.value?.blackId) === me) return !!r.black;
  return true;
});

function junqiAutoSetup() {
  const me = String(currentUserId.value || '');
  const isRed = String(stateSnapshot.value?.redId) === me;
  const isBlack = String(stateSnapshot.value?.blackId) === me;
  if (!isRed && !isBlack) return;
  const pieces = ['F', 'B', 'B', 'M', 'M', 'M', 'E', '9', '8', '7', '6', '5', '4', '3', '2'];
  const w = 5;
  const h = 12;
  const yMin = isRed ? 6 : 0;
  const yMax = isRed ? 11 : 5;
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = yMin; y <= yMax; y++) for (let x = 0; x < w; x++) cells.push({ x, y });

  let seed = Math.max(1, Number(junqiAutoSetupSeed.value || 1));
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const placements = pieces.map((p, i) => ({ x: cells[i].x, y: cells[i].y, piece: p }));
  emitAction('setup', { placements });
}

const myUnitBet = computed(() => {
  const base = Number(stateSnapshot.value?.currentBet || 0);
  return mySeen.value ? base * 2 : base;
});

const allowCompare = computed(() => {
  if (typeof stateSnapshot.value?.allowCompare === 'boolean') return stateSnapshot.value.allowCompare;
  const n = Number(stateSnapshot.value?.activePlayers || 0);
  return n >= 2;
});

const isWinner = computed(() => {
  if (!gameResult.value) return false;
  return String(gameResult.value.winnerId) === String(currentUserId.value);
});

const winnerInfo = computed(() => {
  if (!gameResult.value || !gameResult.value.results) return null;
  return gameResult.value.results.find((r: any) => String(r.userId) === String(gameResult.value.winnerId));
});

const isEveryoneReady = computed(() => {
  const list = roomPlayers.value || [];
  if (list.length < (room.value?.min_players || 2)) return false;
  return list.every(p => {
    // 房主不需要准备状态也可以开始，但其他人必须准备
    if (String(p.user_id || p.id) === String(room.value?.creator_id)) return true;
    return !!p.is_ready;
  });
});

const getNextGameButtonText = computed(() => {
  if (isReady.value) {
    if (isOwner.value && isEveryoneReady.value) return '开始下一局';
    return '等待其他玩家...';
  }
  return '下一局';
});

const isFullscreen = ref(false);
const isLandscape = ref(true);
const isMobile = computed(() => window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const shouldEnforceFullscreen = computed(() => isMobile.value && uiProfile.value.prefersLandscape && (!isFullscreen.value || !isLandscape.value));

const gameTitle = computed(() => {
  const t = effectiveGameType.value;
  const map: Record<string, string> = {
    texas_holdem: '德州扑克',
    zhajinhua: '炸金花',
    doudizhu: '斗地主',
    shengji: '升级',
    paodekuai: '跑得快',
    blackjack: '21点',
    sichuan_mahjong: '四川麻将',
    guangdong_mahjong: '广东麻将',
    guobiao_mahjong: '国标麻将',
    ren_mahjong: '二人麻将',
    xiangqi: '中国象棋',
    weiqi: '围棋',
    wuziqi: '五子棋',
    international_chess: '国际象棋',
    junqi: '军棋',
    niuniu: '牛牛',
    erbaban: '二八杠',
    touzi_bao: '骰宝'
  };
  return map[t] || '对局';
});

function syncViewportState() {
  isFullscreen.value = !!document.fullscreenElement;
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
  isLandscape.value = viewportWidth.value >= viewportHeight.value;
}

watch([isCompactScreen, effectiveGameType], ([compact]) => {
  if (lastAutoCompact.value === compact) return;
  lastAutoCompact.value = compact;
  collapsed.value.leftColumn = compact;
  collapsed.value.rightColumn = compact;
}, { immediate: true });

async function fetchRoom() {
  const res = await api.get(`/rooms/${roomId.value}`);
  room.value = res.data.room;
  roomPlayers.value = res.data.players || res.data.room?.players || [];
  loadSessionProfitsFromStorage();

  // 自动重新加入逻辑
  const isMeInRoom = roomPlayers.value.some(p => String(p.user_id || p.id) === String(authStore.user?.id));
  if (!isMeInRoom && room.value?.room_code) {
    console.log('检测到用户不在游戏中，尝试自动重新加入...');
    try {
      const joinRes = await api.post('/rooms/join', { roomCode: room.value.room_code });
      if (joinRes.data.success) {
        console.log('自动重新加入成功');
        const refreshRes = await api.get(`/rooms/${roomId.value}`);
        if (refreshRes.data.room) {
          room.value = refreshRes.data.room;
          roomPlayers.value = refreshRes.data.room.players || [];
        }
      }
    } catch (joinErr) {
      console.error('自动重新加入失败:', joinErr);
    }
  }
}

const sortedPlayers = computed(() => {
  const list = [...(roomPlayers.value || [])];
  list.sort((a, b) => (a.seat_number || 0) - (b.seat_number || 0));
  return list;
});

const diceBaoRollerId = computed(() => {
  const first = sortedPlayers.value[0];
  return first?.user_id || first?.id || null;
});

function getPlayerNickname(userId: number | string) {
  if (!userId) return '未知';
  const p = roomPlayers.value.find(p => String(p.user_id || p.id) === String(userId));
  if (p) return p.nickname || p.username || `用户${userId}`;
  return `用户${userId}`;
}

function getPlayerAvatar(userId: number | string) {
  const p = roomPlayers.value.find(p => String(p.user_id || p.id) === String(userId));
  return getImageUrl(p?.avatar);
}

function getPlayerObject(userId: number | string) {
  return roomPlayers.value.find(p => String(p.user_id || p.id) === String(userId));
}

// 监听状态更新，如果发现有未知玩家，尝试重新拉取房间信息
watch(() => stateSnapshot.value, (newVal) => {
  if (newVal?.currentPlayer || newVal?.playerStatus) {
    const ids = [newVal.currentPlayer, ...Object.keys(newVal.playerStatus || {})].filter(Boolean);
    const hasUnknown = ids.some(id => !roomPlayers.value.find(p => String(p.user_id || p.id) === String(id)));
    if (hasUnknown) fetchRoomSafe();
  }
  
  // 同步下注金额：默认设置为当前最低跟注额
  if (myUnitBet.value && (!betAmount.value || betAmount.value < myUnitBet.value)) {
    betAmount.value = myUnitBet.value;
  }

  const hand = Array.isArray(handInfo.value) ? handInfo.value : [];
  const idSet = new Set(hand.map((c: any) => String(c?.id || '')).filter(Boolean));
  if (selectedCardIds.value.length) selectedCardIds.value = selectedCardIds.value.filter((id) => idSet.has(String(id)));
  if (selectedTileIds.value.length) selectedTileIds.value = selectedTileIds.value.filter((id) => idSet.has(String(id)));
}, { deep: true });

function getPlayerBet(userId: number | string) {
  const bets = stateSnapshot.value?.playerBets || {};
  const v = bets[userId] ?? bets[String(userId)];
  return Number(v || 0);
}

function getPlayerStatus(userId: number | string | undefined) {
  if (!userId) return 'unknown';
  const statusMap = stateSnapshot.value?.playerStatus || {};
  return statusMap[userId] ?? statusMap[String(userId)] ?? 'active';
}

function getPlayerStatusText(userId: number | string) {
  const s = getPlayerStatus(userId);
  if (s === 'active') return '行动中';
  if (s === 'folded') return '弃牌';
  if (s === 'lost') return '出局';
  return '未知';
}

function getPlayerSeenText(userId: number | string) {
  const seenMap = stateSnapshot.value?.playerSeen || {};
  const s = seenMap[userId] ?? seenMap[String(userId)];
  return s ? '明' : '闷';
}

const onlineCount = computed(() => (roomPlayers.value || []).filter(p => !!p.is_online).length);
const activeCount = computed(() => {
  const statusMap = stateSnapshot.value?.playerStatus || {};
  return (roomPlayers.value || []).filter(p => {
    const s = statusMap[p.user_id] ?? statusMap[String(p.user_id)];
    return !s || s === 'active';
  }).length;
});

const pot = computed(() => Number(stateSnapshot.value?.pot || 0));
const currentBet = computed(() => Number(stateSnapshot.value?.currentBet || 0));
const myBet = computed(() => getPlayerBet(currentUserId.value || '0'));

const currentPlayerId = computed(() => stateSnapshot.value?.currentPlayer);
const currentPlayerName = computed(() => {
  const id = currentPlayerId.value;
  if (!id) return '等待中...';
  return getPlayerNickname(id);
});

const prevPlayerId = computed(() => {
  const cur = String(stateSnapshot.value?.currentPlayer || '');
  const statusMap = stateSnapshot.value?.playerStatus || {};
  const list = sortedPlayers.value.map(p => String(p.user_id));
  const idx = list.indexOf(cur);
  if (idx < 0) return null;
  
  for (let step = 1; step < list.length; step++) {
    const prevIdx = (idx - step + list.length) % list.length;
    const prevId = list[prevIdx];
    const s = statusMap[prevId] ?? statusMap[String(prevId)];
    if (!s || s === 'active') return prevId;
  }
  return null;
});

const prevPlayerName = computed(() => {
  const id = prevPlayerId.value;
  return id ? getPlayerNickname(id) : '无';
});

const nextPlayerId = computed(() => {
  const cur = String(stateSnapshot.value?.currentPlayer || '');
  const statusMap = stateSnapshot.value?.playerStatus || {};
  const list = sortedPlayers.value.map(p => String(p.user_id));
  const idx = list.indexOf(cur);
  if (idx < 0) return null;
  
  for (let step = 1; step < list.length; step++) {
    const nextIdx = (idx + step) % list.length;
    const nextId = list[nextIdx];
    const s = statusMap[nextId] ?? statusMap[String(nextId)];
    if (!s || s === 'active') return nextId;
  }
  return null;
});

const nextPlayerName = computed(() => {
  const id = nextPlayerId.value;
  return id ? getPlayerNickname(id) : '无';
});

const lastActionText = computed(() => {
  const a = lastAction.value;
  if (!a) return '';
  const name = getPlayerNickname(a.userId);
  const action = a.action;
  const amount = a.payload?.amount ?? a.amount;
  if (action === 'call') return `${name} 跟注 ${Number(amount || 0)}`;
  if (action === 'raise') return `${name} 加注 ${Number(amount || 0)}`;
  if (action === 'fold') return `${name} 弃牌`;
  if (action === 'compare') return `${name} 发起比牌`;
  if (action === 'check') return `${name} 过牌`;
  return `${name} 执行 ${action}`;
});

function ensureSocket() {
  let s = getSocket();
  if (!s) {
    const token = localStorage.getItem('token') || '';
    s = initSocket(token);
  }
  return s;
}

let socketConnectHandler: (() => void) | null = null;

function addLog(text: string) {
  actionLog.value.unshift({ id: `${Date.now()}-${Math.random()}`, text });
}

function bindSocketEvents() {
  const s = ensureSocket();
  if (!s) return;

  const joinSocketRoom = () => {
    s.emit('game:join_room', { roomId: roomId.value });
  };

  socketConnectHandler = () => joinSocketRoom();
  s.on('connect', socketConnectHandler);

  joinSocketRoom();

  s.on('game:player_joined', (payload: any) => {
    audioManager.play('game_join');
    fetchRoomSafe();
  });
  s.on('game:player_left', fetchRoomSafe);

  s.on('game:player_ready', (data: any) => {
    if (String(data.userId) !== String(currentUserId.value)) {
      audioManager.play('game_ready');
    }
    if (String(data.userId) === String(currentUserId.value)) {
      isReady.value = !!data.isReady;
    }
    // 更新本地玩家列表中的准备状态
    const p = roomPlayers.value.find(p => String(p.user_id || p.id) === String(data.userId));
    if (p) p.is_ready = data.isReady;
  });

  s.on('game:started', (payload: any) => {
    console.log('新对局已开始:', payload);
    audioManager.play('game_start');
    if (resultTimer) clearInterval(resultTimer);
    if (startTimer) clearInterval(startTimer);
    startCountdown.value = null;
    isFinished.value = false;
    showResultModal.value = false;
    isReady.value = false;
    gameResult.value = null;
    handInfo.value = [];
    selectedCardIds.value = [];
    selectedTileIds.value = [];
    selectedFrom.value = null;
    actionLog.value = [];
    if (payload.gameState) {
      stateSnapshot.value = payload.gameState;
    } else {
      stateSnapshot.value = payload;
    }
    addLog('新对局已开始，祝你好运！');
  });

  s.on('game:player_bet', (data: any) => {
    audioManager.play('game_chip');
    const p = roomPlayers.value.find(p => String(p.user_id || p.id) === String(data.userId));
    if (p && data.chipsDeducted) {
      p.total_chips = Math.max(0, (p.total_chips || 0) - data.chipsDeducted);
    }
  });

  s.on('game:countdown', (data: any) => {
    if (data.seconds <= 5) {
      audioManager.play('game_timer');
    }
    startCountdown.value = data.seconds;
    if (startTimer) clearInterval(startTimer);
    startTimer = setInterval(() => {
      if (startCountdown.value !== null && startCountdown.value > 0) {
        startCountdown.value--;
      } else {
        clearInterval(startTimer);
        startCountdown.value = null;
      }
    }, 1000);
  });

  s.on('game:state_update', (data: any) => {
    stateSnapshot.value = data.gameState || data;
  });

  s.on('game:hand', (data: any) => {
    handInfo.value = data.hand || data;
  });

  s.on('game:player_action', (payload: any) => {
    lastAction.value = payload;
    const name = getPlayerNickname(payload.userId);
    const action = payload.action;
    const amount = payload.payload?.amount ?? payload.amount;
    let text = `${name} 执行 ${action}`;
    if (action === 'call') text = `${name} 跟注 ${Number(amount || 0)}`;
    if (action === 'raise') text = `${name} 加注 ${Number(amount || 0)}`;
    if (action === 'fold') {
      text = `${name} 弃牌`;
      audioManager.play('game_fold');
    }
    if (action === 'compare') text = `${name} 发起比牌`;
    if (action === 'see') text = `${name} 看牌`;
    if (action === 'bid') text = `${name} 叫分 ${Number(payload.payload?.points ?? 0)}`;
    if (action === 'play') {
      const n = Array.isArray(payload.payload?.cardIds) ? payload.payload.cardIds.length : (payload.payload?.cardId ? 1 : 0);
      text = `${name} 出牌 ${n ? `(${n})` : ''}`.trim();
    }
    if (action === 'pass') text = `${name} 过牌`;
    if (action === 'surrender') text = `${name} 认输`;
    if (action === 'move') text = `${name} 移动`;
    if (action === 'place') text = `${name} 落子`;
    if (action === 'discard') text = `${name} 弃牌`;
    if (action === 'hu') {
      text = `${name} 自摸胡`;
      audioManager.play('game_win');
    }
    if (action === 'ron') {
      text = `${name} 点炮胡`;
      audioManager.play('game_win');
    }
    if (action === 'peng') text = `${name} 碰`;
    if (action === 'chi') text = `${name} 吃`;
    if (action === 'gang') text = `${name} 杠`;
    if (action === 'hit') text = `${name} 要牌`;
    if (action === 'stand') text = `${name} 停牌`;
    if (action === 'double') text = `${name} 加倍`;
    if (action === 'reveal') text = `${name} 亮牌`;
    if (action === 'settle') text = `${name} 结算`;
    if (action === 'roll') text = `${name} 掷骰`;
    if (action === 'place_bet') {
      text = `${name} 下注 ${payload.payload?.selection || ''} ${Number(payload.payload?.amount || 0)}`.trim();
      audioManager.play('game_bet');
    }
    if (action === 'setup') text = `${name} 布阵`;
    actionLog.value.unshift({ id: `${Date.now()}-${Math.random()}`, text });
  });

  s.on('game:chat_message', (m: any) => {
    audioManager.play('notify_msg');
    const id = String(m.id || `${Date.now()}-${Math.random()}`);
    const senderName = m.nickname || m.username || `用户${m.userId}`;
    chatMessages.value.push({ id, senderName, message: String(m.message || '') });
    if (chatMessages.value.length > 200) chatMessages.value.splice(0, chatMessages.value.length - 200);
    nextTick(() => {
      if (chatListEl.value) chatListEl.value.scrollTop = chatListEl.value.scrollHeight;
    });
  });

  s.on('game:kicked', exitToLobby);

  s.on('game:finished', (result: any) => {
    isFinished.value = true;
    gameResult.value = result;
    showResultModal.value = true;
    resultCountdown.value = 10;
    
    if (String(result.winnerId) === String(currentUserId.value)) {
      audioManager.play('game_win');
    } else {
      audioManager.play('game_lose');
    }
    
    // 更新本场盈亏记录
    if (result && Array.isArray(result.results)) {
      result.results.forEach((r: any) => {
        const uid = String(r.userId);
        const change = Number(r.chipsChange || 0);
        sessionProfits.value[uid] = (sessionProfits.value[uid] || 0) + change;
      });
    }

    // 结算时保存当前的 playerSeen 状态，防止被覆盖
    const lastSeen = stateSnapshot.value?.playerSeen || {};
    stateSnapshot.value = { 
      finished: true, 
      result,
      playerSeen: lastSeen // 保持结算前的看牌状态显示
    };
    
    // 自动更新手牌为结算时的完整手牌
    if (result && Array.isArray(result.results)) {
      const myRes = result.results.find((r: any) => String(r.userId) === String(currentUserId.value));
      if (myRes && myRes.hand) {
        handInfo.value = myRes.hand;
      }
    }

    // 开启倒计时
    if (resultTimer) clearInterval(resultTimer);
    resultTimer = setInterval(() => {
      resultCountdown.value--;
      if (resultCountdown.value <= 0) {
        clearInterval(resultTimer);
        exitToLobby();
      }
    }, 1000);

    // 游戏结束拉取最新筹码
    fetchRoomSafe();
  });

  s.on('game:error', (e: any) => {
    audioManager.play('ui_error');
    const msg = String(e?.error || '操作失败');
    addLog(`错误：${msg}`);
    showToast(msg, 'error');
  });
}

function unbindSocketEvents() {
  const s = getSocket();
  if (!s) return;
  if (socketConnectHandler) {
    s.off('connect', socketConnectHandler);
    socketConnectHandler = null;
  }
  s.off('game:started');
  s.off('game:state_update');
  s.off('game:hand');
  s.off('game:finished');
  s.off('game:player_action');
  s.off('game:chat_message');
  s.off('game:player_joined');
  s.off('game:player_left');
  s.off('game:player_ready');
  s.off('game:player_bet');
  s.off('game:countdown');
  s.off('game:kicked');
  s.off('game:error');
}

async function fetchRoomSafe() {
  try {
    await fetchRoom();
  } catch {}
}

function emitAction(action: string, payload: any = {}) {
  const s = ensureSocket();
  if (!s) return;
  s.emit('game:action', { roomId: roomId.value, action, payload });
}

function doCall() {
  emitAction('call');
}

function doBet() {
  if (!betAmount.value) return;
  
  if (betAmount.value === myUnitBet.value) {
    doCall();
  } else {
    const multiplier = mySeen.value ? 2 : 1;
    const baseAmount = Math.floor(betAmount.value / multiplier);
    emitAction('raise', { amount: baseAmount });
  }
}

function doFold() {
  emitAction('fold');
}

function doSurrender() {
  emitAction('surrender');
}

function handleMove(x: number, y: number) {
  emitAction('move', { x, y });
}

function doSee() {
  emitAction('see');
}

function openCompare() {
  if (!allowCompare.value) return;
  compareMode.value = true;
  kickMode.value = false;
}

function canCompareTarget(userId: number | string) {
  if (!allowCompare.value) return false;
  if (!canAct.value) return false;
  if (String(userId) === String(currentUserId.value)) return false;
  const statusMap = stateSnapshot.value?.playerStatus || {};
  const s = statusMap[userId] ?? statusMap[String(userId)];
  return !s || s === 'active';
}

function compareWith(userId: number | string) {
  if (!canCompareTarget(userId)) return;
  emitAction('compare', { targetId: Number(userId) });
  compareMode.value = false;
}

function toggleKickMode() {
  kickMode.value = !kickMode.value;
  compareMode.value = false;
}

function canKick(userId: number | string) {
  if (!isOwner.value) return false;
  if (String(userId) === String(currentUserId.value)) return false;
  return true;
}

async function kick(userId: number | string) {
  try {
    await api.post(`/rooms/${roomId.value}/kick`, { userId: Number(userId) });
  } catch (e: any) {
    addLog(`踢人失败：${e?.response?.data?.message || e?.message || '未知错误'}`);
  } finally {
    fetchRoomSafe();
  }
}

function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  const s = ensureSocket();
  if (!s) return;
  s.emit('game:chat', { roomId: roomId.value, message: msg, messageType: 'text' });
  chatInput.value = '';
}

function reloadPage() {
  window.location.reload();
}

async function enterFullscreenAndLandscape() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch {}

  try {
    const orientation = (screen as any)?.orientation;
    if (orientation?.lock) await orientation.lock('landscape');
  } catch {}

  syncViewportState();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch {}
  syncViewportState();
}

function startNextGame() {
  if (resultTimer) {
    clearInterval(resultTimer);
    resultTimer = null;
  }
  const s = ensureSocket();
  if (!s) return;
  
  // 如果还没准备，先发送准备
  if (!isReady.value) {
    s.emit('game:player_ready', { roomId: roomId.value, isReady: true });
  }
  
  // 如果是房主，且大家都准备好了，尝试开始
  if (isOwner.value && isEveryoneReady.value) {
    s.emit('game:start', { roomId: roomId.value });
  }
}

async function exitToLobby() {
  try {
    await api.post('/rooms/leave-all');
  } catch {}
  router.push('/game');
}

onMounted(async () => {
  syncViewportState();
  window.addEventListener('resize', syncViewportState);
  window.addEventListener('orientationchange', syncViewportState);
  document.addEventListener('fullscreenchange', syncViewportState);

  setupInactivityListeners();
  resetInactivityTimer();

  try {
    loading.value = true;
    await fetchRoom();
    loadSessionProfitsFromStorage();
    
    // 强制检查：只有状态为 playing 的房间才能进入对局页
    if (room.value && room.value.status !== 'playing') {
      console.warn('游戏尚未开始，正在返回房间等待页...');
      router.replace(`/game/room/${roomId.value}`);
      return;
    }
  } finally {
    loading.value = false;
  }
  bindSocketEvents();

  // 每秒自动无感刷新数据
  refreshTimer.value = setInterval(() => {
    fetchRoom();
  }, 1000);
});

onUnmounted(() => {
  saveSessionProfitsToStorage();
  unbindSocketEvents();
  removeInactivityListeners();
  if (resultTimer) clearInterval(resultTimer);
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
  window.removeEventListener('resize', syncViewportState);
  window.removeEventListener('orientationchange', syncViewportState);
  document.removeEventListener('fullscreenchange', syncViewportState);
});

watch(() => route.fullPath, () => {
  compareMode.value = false;
  kickMode.value = false;
});

watch(sessionProfits, () => {
  saveSessionProfitsToStorage();
}, { deep: true });
</script>
