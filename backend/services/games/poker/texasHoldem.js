
// Re-export from the original file location to avoid breaking imports elsewhere initially
// But better to copy content to new location and make original file just re-export or move.
// Since user allowed modification, I will move the logic here.

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
    const straightHigh = this.getStraightHigh(uniqueRanks);
    const isStraight = straightHigh !== null;
    
    if (isStraight && isFlush) {
      return { rank: 9, name: '同花顺', highCard: sortedCards.find(c => c.value === straightHigh) || sortedCards[0] };
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
    
    if (isStraight) {
      return { rank: 5, name: '顺子', highCard: sortedCards.find(c => c.value === straightHigh) || sortedCards[0] };
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

  static getStraightHigh(ranks) {
    if (!ranks || ranks.length < 5) return null;

    const sortedRanks = [...new Set(ranks)].sort((a, b) => b - a);

    for (let i = 0; i <= sortedRanks.length - 5; i++) {
      const a = sortedRanks[i];
      const b = sortedRanks[i + 1];
      const c = sortedRanks[i + 2];
      const d = sortedRanks[i + 3];
      const e = sortedRanks[i + 4];
      if (a - b === 1 && b - c === 1 && c - d === 1 && d - e === 1) return a;
    }

    const hasWheel =
      sortedRanks.includes(14) &&
      sortedRanks.includes(5) &&
      sortedRanks.includes(4) &&
      sortedRanks.includes(3) &&
      sortedRanks.includes(2);
    if (hasWheel) return 5;

    return null;
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
    this.playerTotalSpent = {};
    this.gameOver = false;
    this.phaseActions = new Set();
    
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
    this.playerTotalSpent = {};
    this.gameOver = false;
    this.phaseActions = new Set();
    
    for (const playerId of this.playerIds) {
      this.hands[playerId] = this.deck.dealMultiple(2);
      this.playerBets[playerId] = 0;
      this.playerStatus[playerId] = 'active';
      this.playerTotalSpent[playerId] = 0;
    }
    
    this.postBlinds();

    // Pre-flop action starts with the player to the left of Big Blind (UTG)
    this.currentPlayerIndex = (this.dealerIndex + 3) % this.playerIds.length;
  }

  postBlinds() {
    const sbPlayer = this.playerIds[(this.dealerIndex + 1) % this.playerIds.length];
    const bbPlayer = this.playerIds[(this.dealerIndex + 2) % this.playerIds.length];
    
    this.playerBets[sbPlayer] = this.smallBlind;
    this.playerTotalSpent[sbPlayer] = this.smallBlind;
    
    this.playerBets[bbPlayer] = this.bigBlind;
    this.playerTotalSpent[bbPlayer] = this.bigBlind;

    this.pot = this.smallBlind + this.bigBlind;
  }

  getCurrentPlayerId() {
      return this.playerIds[this.currentPlayerIndex];
  }

  validateTurn(playerId) {
      if (this.gameOver) throw new Error('游戏已结束');
      if (String(playerId) !== String(this.getCurrentPlayerId())) {
          throw new Error(`不是你的回合 (当前: ${this.getCurrentPlayerId()}, 你: ${playerId})`);
      }
      if (this.playerStatus[playerId] !== 'active') throw new Error('玩家已出局');
  }

  bet(playerId, amount) {
    this.validateTurn(playerId);
    
    const currentContribution = this.playerBets[playerId] || 0;
    const totalAfterBet = currentContribution + amount;

    if (totalAfterBet < this.currentBet) {
        throw new Error('下注金额不足，请跟注或加注');
    }

    this.playerBets[playerId] = totalAfterBet;
    this.playerTotalSpent[playerId] = (this.playerTotalSpent[playerId] || 0) + amount;
    this.pot += amount;
    
    if (totalAfterBet > this.currentBet) {
      this.currentBet = totalAfterBet;
      this.phaseActions.clear();
    }
    
    this.registerAction(playerId);
    return this.nextTurn();
  }

  call(playerId) {
    const currentContribution = this.playerBets[playerId] || 0;
    const amountToCall = this.currentBet - currentContribution;
    return this.bet(playerId, amountToCall);
  }

  raise(playerId, raiseAmount) {
    const currentContribution = this.playerBets[playerId] || 0;
    const totalAmount = (this.currentBet - currentContribution) + raiseAmount;
    return this.bet(playerId, totalAmount);
  }

  fold(playerId) {
    this.validateTurn(playerId);
    this.playerStatus[playerId] = 'folded';
    
    const activePlayers = this.playerIds.filter(id => this.playerStatus[id] === 'active');
    if (activePlayers.length === 1) {
        return this.endGame();
    }
    
    return this.nextTurn();
  }

  check(playerId) {
    this.validateTurn(playerId);
    const currentContribution = this.playerBets[playerId] || 0;
    if (currentContribution < this.currentBet) {
      throw new Error('无法过牌，需要跟注');
    }
    this.registerAction(playerId);
    return this.nextTurn();
  }

  nextTurn() {
    const activePlayers = this.playerIds.filter(id => this.playerStatus[id] === 'active');
    
    if (this.shouldAdvancePhase()) {
        return this.advancePhase();
    }

    let nextIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
    while (this.playerStatus[this.playerIds[nextIndex]] !== 'active') {
        nextIndex = (nextIndex + 1) % this.playerIds.length;
    }
    this.currentPlayerIndex = nextIndex;
    
    return null;
  }
  
  shouldAdvancePhase() {
      const activePlayers = this.playerIds.filter(id => this.playerStatus[id] === 'active');
      const allMatched = activePlayers.every(id => (this.playerBets[id] || 0) === this.currentBet);
      const allActed = activePlayers.every(id => this.phaseActions.has(id));
      
      return allMatched && allActed;
  }

  registerAction(playerId) {
      this.phaseActions.add(playerId);
  }

  advancePhase() {
    this.phaseActions = new Set();
    
    this.currentBet = 0;
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
    
    // Phase starts with the first active player to the left of the dealer
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
        totalPot: this.pot,
        type: 'fold',
        winningHand: null,
        results: this.playerIds.map(pid => {
            const isWinner = pid === winnerId;
            return {
                userId: pid,
                chipsChange: isWinner ? this.pot : 0, // Amount to AWARD
                totalSpent: this.playerTotalSpent[pid] || 0,
                finalChips: 0,
                position: isWinner ? 1 : 2,
                hand: this.hands[pid],
                evaluation: { rank: -1, name: pid === winnerId ? '胜利' : '弃牌' }
            };
        })
      };
    }
    
    const evaluationResults = activePlayers.map(playerId => {
      const hand = this.hands[playerId];
      const evaluation = HandEvaluator.evaluate(hand, this.communityCards);
      return {
        userId: playerId,
        hand,
        evaluation
      };
    });
    
    evaluationResults.sort((a, b) => {
      if (b.evaluation.rank !== a.evaluation.rank) {
        return b.evaluation.rank - a.evaluation.rank;
      }
      return b.evaluation.highCard.value - a.evaluation.highCard.value;
    });
    
    const winnerId = evaluationResults[0].userId;
    
    const results = this.playerIds.map(pid => {
        const isWinner = pid === winnerId;
        const evalRes = evaluationResults.find(r => r.userId === pid);
        
        return {
            userId: pid,
            chipsChange: isWinner ? this.pot : 0, // Amount to AWARD
            totalSpent: this.playerTotalSpent[pid] || 0,
            position: isWinner ? 1 : 2,
            hand: this.hands[pid],
            evaluation: evalRes ? evalRes.evaluation : { rank: -1, name: '弃牌' }
        };
    });
        
    return {
      winnerId,
      totalPot: this.pot,
      pot: this.pot,
      type: 'showdown',
      winningHand: evaluationResults[0].evaluation,
      results
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
