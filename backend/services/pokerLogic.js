const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = RANKS.indexOf(rank) + 2;
  }

  toString() {
    return `${this.suit}${this.rank}`;
  }
}

export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(suit, rank));
      }
    }
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal() {
    return this.cards.pop();
  }

  dealMultiple(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      cards.push(this.deal());
    }
    return cards;
  }
}

export class HandEvaluator {
  static evaluate(hand, communityCards) {
    const allCards = [...hand, ...communityCards];
    // If not enough cards, just return high card of hand
    if (allCards.length < 5) {
        const sorted = [...allCards].sort((a,b) => b.value - a.value);
        return { rank: 1, name: '高牌', highCard: sorted[0] };
    }

    const combinations = this.getCombinations(allCards, 5);
    
    let bestHand = null;
    let bestRank = -1;
    
    for (const combo of combinations) {
      const result = this.evaluateFiveCards(combo);
      if (result.rank > bestRank) {
        bestRank = result.rank;
        bestHand = result;
      } else if (result.rank === bestRank) {
          if (result.highCard.value > bestHand.highCard.value) {
              bestHand = result;
          }
      }
    }
    
    return bestHand || { rank: 0, name: '高牌', highCard: allCards[0] };
  }

  static getCombinations(cards, k) {
    const result = [];
    
    function combine(start, combo) {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      
      for (let i = start; i < cards.length; i++) {
        combo.push(cards[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }
    
    combine(0, []);
    return result;
  }

  static evaluateFiveCards(cards) {
    const sortedCards = [...cards].sort((a, b) => b.value - a.value);
    const ranks = sortedCards.map(c => c.value);
    const suits = sortedCards.map(c => c.suit);
    
    const rankCounts = {};
    const suitCounts = {};
    
    for (const card of sortedCards) {
      rankCounts[card.value] = (rankCounts[card.value] || 0) + 1;
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }
    
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const isFlush = Object.values(suitCounts).some(count => count >= 5);
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
    
    if (this.isStraight(uniqueRanks) && isFlush) {
      return { rank: 9, name: '同花顺', highCard: sortedCards[0] };
    }
    
    if (counts[0] === 4) {
      const quadRank = Object.keys(rankCounts).find(key => rankCounts[key] === 4);
      return { rank: 8, name: '四条', highCard: sortedCards.find(c => c.value == quadRank) };
    }
    
    if (counts[0] === 3 && counts[1] === 2) {
      const tripRank = Object.keys(rankCounts).find(key => rankCounts[key] === 3);
      return { rank: 7, name: '葫芦', highCard: sortedCards.find(c => c.value == tripRank) };
    }
    
    if (isFlush) {
      return { rank: 6, name: '同花', highCard: sortedCards[0] };
    }
    
    if (this.isStraight(uniqueRanks)) {
      return { rank: 5, name: '顺子', highCard: sortedCards[0] };
    }
    
    if (counts[0] === 3) {
      const tripRank = Object.keys(rankCounts).find(key => rankCounts[key] === 3);
      return { rank: 4, name: '三条', highCard: sortedCards.find(c => c.value == tripRank) };
    }
    
    if (counts[0] === 2 && counts[1] === 2) {
      const pairRanks = Object.keys(rankCounts).filter(key => rankCounts[key] === 2);
      return { rank: 3, name: '两对', highCard: sortedCards.find(c => c.value == Math.max(...pairRanks)) };
    }
    
    if (counts[0] === 2) {
      const pairRank = Object.keys(rankCounts).find(key => rankCounts[key] === 2);
      return { rank: 2, name: '一对', highCard: sortedCards.find(c => c.value == pairRank) };
    }
    
    return { rank: 1, name: '高牌', highCard: sortedCards[0] };
  }

  static isStraight(ranks) {
    if (ranks.length < 5) return false;
    
    const sortedRanks = [...ranks].sort((a, b) => b - a);
    
    for (let i = 0; i < sortedRanks.length - 4; i++) {
      let consecutive = 1;
      for (let j = i; j < i + 4; j++) {
        if (sortedRanks[j] - sortedRanks[j + 1] === 1) {
          consecutive++;
        }
      }
      if (consecutive >= 4) return true;
    }
    
    if (sortedRanks.includes(14) && sortedRanks.includes(2) && sortedRanks.includes(3) && sortedRanks.includes(4) && sortedRanks.includes(5)) {
      return true;
    }
    
    return false;
  }
}

export class TexasHoldemGame {
  constructor(playerIds) {
    this.playerIds = playerIds;
    this.deck = new Deck();
    this.hands = {};
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.phase = 'preflop';
    this.playerBets = {};
    this.playerStatus = {};
    this.gameOver = false;
    
    this.initializeGame();
  }

  initializeGame() {
    this.deck.reset();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = this.bigBlind;
    this.phase = 'preflop';
    this.playerBets = {};
    this.playerStatus = {};
    this.gameOver = false;
    
    for (const playerId of this.playerIds) {
      this.hands[playerId] = this.deck.dealMultiple(2);
      this.playerBets[playerId] = 0;
      this.playerStatus[playerId] = 'active';
    }
    
    this.postBlinds();
    
    // Set current player to the one after Big Blind (UTG)
    this.currentPlayerIndex = (this.dealerIndex + 3) % this.playerIds.length;
  }

  postBlinds() {
    const sbPlayer = this.playerIds[(this.dealerIndex + 1) % this.playerIds.length];
    const bbPlayer = this.playerIds[(this.dealerIndex + 2) % this.playerIds.length];
    
    this.playerBets[sbPlayer] = this.smallBlind;
    this.playerBets[bbPlayer] = this.bigBlind;
    this.pot = this.smallBlind + this.bigBlind;
  }

  getCurrentPlayerId() {
      return this.playerIds[this.currentPlayerIndex];
  }

  validateTurn(playerId) {
      if (this.gameOver) throw new Error('游戏已结束');
      if (playerId != this.getCurrentPlayerId()) throw new Error('不是你的回合');
      if (this.playerStatus[playerId] !== 'active') throw new Error('玩家已出局');
  }

  // Returns result object if game ends, null otherwise
  bet(playerId, amount) {
    this.validateTurn(playerId);
    
    // Logic: amount is the *additional* amount added to the pot? 
    // Usually "raise to X" or "call". 
    // Let's assume input 'amount' is the TOTAL amount the player wants to have in front of them for this round?
    // No, usually frontend sends "call" (match currentBet) or "raise" (increase currentBet).
    // Let's standardise: 
    // If call: amount = currentBet - playerBets[playerId]
    // If raise: amount = (currentBet + raiseDiff) - playerBets[playerId]
    // So 'amount' here is the *chips put into the pot in this action*.
    
    const currentContribution = this.playerBets[playerId] || 0;
    const totalAfterBet = currentContribution + amount;

    if (totalAfterBet < this.currentBet) {
        // Allow all-in? For simplicity, enforce min call unless all-in (not handled yet)
        // throw new Error('下注金额不足');
    }

    this.playerBets[playerId] = totalAfterBet;
    this.pot += amount;
    
    if (totalAfterBet > this.currentBet) {
      this.currentBet = totalAfterBet;
      // If raise, reset 'allMatched' logic essentially by ensuring everyone else must act again.
      // But our simple nextPhase logic checks if everyone matched.
    }
    
    return this.nextTurn();
  }

  fold(playerId) {
    this.validateTurn(playerId);
    this.playerStatus[playerId] = 'folded';
    return this.nextTurn();
  }

  check(playerId) {
    this.validateTurn(playerId);
    if (this.playerBets[playerId] < this.currentBet) {
      throw new Error('无法过牌，需要跟注');
    }
    return this.nextTurn();
  }

  nextTurn() {
    // Check if only one player left
    const activePlayers = this.playerIds.filter(id => this.playerStatus[id] === 'active');
    if (activePlayers.length === 1) {
      return this.endGame();
    }

    // Check if phase is complete
    // Phase is complete if:
    // 1. Everyone active has acted at least once (we can track this via a separate set, or infer)
    // 2. Everyone active has matched the current bet.
    // Simplifying: If everyone active has bet == currentBet, proceed.
    // BUT: Big Blind in preflop has bet == currentBet initially but still needs a turn to Check/Raise.
    // We can handle this by checking if we cycled back to the aggressor?
    // For this simple implementation: let's just rotate. 
    // If we rotate to a player who has already matched the bet AND the betting round is "done", we advance.
    
    // Better approach for simple logic:
    // Rotate to next active player.
    let nextIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    while (this.playerStatus[this.playerIds[nextIndex]] !== 'active') {
        nextIndex = (nextIndex + 1) % this.playerIds.length;
    }
    this.currentPlayerIndex = nextIndex;

    // Check if we should advance phase
    const isPhaseComplete = this.playerIds
        .filter(id => this.playerStatus[id] === 'active')
        .every(id => this.playerBets[id] === this.currentBet);
    
    // Special case for Preflop: Big Blind needs to act even if bets match initially (if no one raised).
    // This is tricky without "hasActed" flags.
    // Let's add 'hasActed' map.
    
    // Wait, simpler:
    // Just allow actions. If everyone matched, we CAN advance. 
    // But we shouldn't auto-advance if someone hasn't had a chance to act.
    // Let's stick to explicit nextPhase check:
    
    if (isPhaseComplete && this.shouldAdvancePhase()) {
        return this.advancePhase();
    }
    
    return null;
  }
  
  // Helper to determine if we truly should advance (e.g. everyone acted)
  // For now, rely on `isPhaseComplete`. 
  // To fix the "BB option" issue: Initialize BB as "not acted" effectively?
  // Let's just use the simple `every` check. It might skip BB option in edge cases but it's playable.
  // Actually, in preflop, SB and BB posted blinds. They "acted" passively.
  // Real poker: action starts UTG. Ends when everyone matches.
  // If UTG calls, ... Button calls, SB calls, BB checks. 
  // When BB checks, bets match, phase ends. 
  // If BB raises, bets don't match, continues.
  // So `every` check is actually correct, provided we started `currentPlayerIndex` correctly (UTG).
  // In Preflop: currentBet = BB. Players have 0 bets (except blinds).
  // Loop continues until everyone matches BB.
  
  shouldAdvancePhase() {
      if (!this.phaseActions) this.phaseActions = new Set();
      const activePlayers = this.playerIds.filter(id => this.playerStatus[id] === 'active');
      
      const allMatched = activePlayers.every(id => this.playerBets[id] === this.currentBet);
      const allActed = activePlayers.every(id => this.phaseActions.has(id));
      
      return allMatched && allActed;
  }

  registerAction(playerId) {
      if (!this.phaseActions) this.phaseActions = new Set();
      this.phaseActions.add(playerId);
  }

  bet(playerId, amount) {
    this.validateTurn(playerId);
    
    const currentContribution = this.playerBets[playerId] || 0;
    const totalAfterBet = currentContribution + amount;
    
    this.playerBets[playerId] = totalAfterBet;
    this.pot += amount;
    
    if (totalAfterBet > this.currentBet) {
      this.currentBet = totalAfterBet;
      // Someone raised. Reset actions for others?
      // Actually, others who acted before now have bet < currentBet, so they MUST act again.
      // So we don't need to clear `phaseActions` necessarily, because `playerBets[id] === currentBet` check will fail for them.
    }
    
    this.registerAction(playerId);
    return this.nextTurn();
  }
  
  check(playerId) {
      this.validateTurn(playerId);
      if (this.playerBets[playerId] < this.currentBet) throw new Error('无法过牌');
      this.registerAction(playerId);
      return this.nextTurn();
  }
  
  fold(playerId) {
      this.validateTurn(playerId);
      this.playerStatus[playerId] = 'folded';
      // No need to register action, they are inactive.
      return this.nextTurn();
  }

  advancePhase() {
    this.playerBets = {};
    this.currentBet = 0;
    this.phaseActions = new Set();
    
    // Reset bets for next round (pot keeps growing)
    for (const pid of this.playerIds) {
        this.playerBets[pid] = 0;
    }

    switch (this.phase) {
      case 'preflop':
        this.communityCards = this.deck.dealMultiple(3);
        this.phase = 'flop';
        break;
      case 'flop':
        this.communityCards.push(this.deck.deal());
        this.phase = 'turn';
        break;
      case 'turn':
        this.communityCards.push(this.deck.deal());
        this.phase = 'river';
        break;
      case 'river':
        return this.endGame();
    }
    
    // Reset current player to left of dealer
    // Find first active player after dealer
    let nextIndex = (this.dealerIndex + 1) % this.playerIds.length;
    while (this.playerStatus[this.playerIds[nextIndex]] !== 'active') {
        nextIndex = (nextIndex + 1) % this.playerIds.length;
    }
    this.currentPlayerIndex = nextIndex;
    
    return null;
  }

  endGame() {
    this.gameOver = true;
    const activePlayers = this.playerIds.filter(id => this.playerStatus[id] !== 'folded');
    
    if (activePlayers.length === 1) {
      const winnerId = activePlayers[0];
      return {
        winnerId,
        pot: this.pot,
        type: 'fold',
        winningHand: null,
        results: [{
            userId: winnerId,
            chipsChange: this.pot,
            finalChips: 0, // Should be calculated outside
            position: 1
        }]
      };
    }
    
    const results = activePlayers.map(playerId => {
      const hand = this.hands[playerId];
      const evaluation = HandEvaluator.evaluate(hand, this.communityCards);
      return {
        userId: playerId,
        hand,
        evaluation,
        bet: this.playerBets[playerId]
      };
    });
    
    results.sort((a, b) => {
      if (b.evaluation.rank !== a.evaluation.rank) {
        return b.evaluation.rank - a.evaluation.rank;
      }
      return b.evaluation.highCard.value - a.evaluation.highCard.value;
    });
    
    // Simple winner takes all for now (split pot not implemented)
    const winner = results[0];
    
    // Assign chipsChange
    results.forEach(r => {
        r.chipsChange = (r.userId === winner.userId) ? this.pot : 0;
        r.position = (r.userId === winner.userId) ? 1 : 2;
    });
    
    // Add folded players to results for records
    const foldedPlayers = this.playerIds
        .filter(id => this.playerStatus[id] === 'folded')
        .map(id => ({
            userId: id,
            chipsChange: 0,
            hand: this.hands[id],
            evaluation: { rank: -1, name: '弃牌' },
            position: 3
        }));
        
    return {
      winnerId: winner.userId,
      totalPot: this.pot, // Consistent naming
      pot: this.pot,
      type: 'showdown',
      winningHand: winner.evaluation,
      results: [...results, ...foldedPlayers]
    };
  }

  getGameState() {
    return {
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      phase: this.phase,
      playerBets: this.playerBets,
      playerStatus: this.playerStatus,
      currentPlayer: this.playerIds[this.currentPlayerIndex],
      dealerIndex: this.dealerIndex,
      gameOver: this.gameOver
    };
  }
}
