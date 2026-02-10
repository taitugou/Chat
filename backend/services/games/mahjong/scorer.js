export class MahjongScorer {
  constructor(rules = 'standard') {
    this.rules = rules;
  }

  /**
   * 计算手牌分数/番数
   * @param {Array} hand 手牌
   * @param {Array} melds 已吃碰杠的牌组
   * @param {Object} winningTile 胡的那张牌
   * @param {boolean} isSelfDraw 是否自摸
   * @param {Object} context 额外上下文 (圈风、门风、花牌等)
   */
  calculate(hand, melds, winningTile, isSelfDraw, context = {}) {
    const result = {
      score: 0,
      fan: 0,
      details: []
    };

    const fullHand = [...hand];
    if (winningTile) {
      // 确保 winningTile 不在 hand 中才 push，避免重复（取决于调用方逻辑，通常胡牌时手牌已包含或未包含）
      // 这里假设 hand 是除去胡的那张牌后的手牌，或者如果是自摸则已包含
      // 简单起见，调用方应传入完整的手牌(包含胡的那张)
    }
    
    // 基础番型
    this.checkBasicPatterns(fullHand, melds, result);

    if (this.rules.includes('sichuan')) {
      this.checkSichuanPatterns(fullHand, melds, result);
    } else if (this.rules.includes('guobiao')) {
      this.checkGuobiaoPatterns(fullHand, melds, result);
    }

    // 汇总
    result.fan = result.details.reduce((sum, item) => sum + item.fan, 0);
    // 简单计分公式
    result.score = Math.pow(2, Math.max(0, result.fan));
    
    return result;
  }

  getSuits(hand, melds) {
    const suits = new Set();
    [...hand, ...melds.flatMap(m => m.tiles)].forEach(t => suits.add(t.suit));
    return suits;
  }

  isQingYiSe(hand, melds) {
    const suits = this.getSuits(hand, melds);
    return suits.size === 1 && !suits.has('z');
  }

  isZiYiSe(hand, melds) {
    const suits = this.getSuits(hand, melds);
    return suits.size === 1 && suits.has('z');
  }

  isHunYiSe(hand, melds) {
    const suits = this.getSuits(hand, melds);
    return suits.size === 2 && suits.has('z');
  }

  isPengPengHu(hand, melds) {
    // 简易判断：手里全是刻子/对子
    // 这通常需要在胡牌拆解算法中判断，这里做简化假设：
    // 如果没有顺子(chi)且符合胡牌，即为碰碰胡
    const hasChi = melds.some(m => m.type === 'chi');
    if (hasChi) return false;
    // 还需要检查手牌中是否只包含刻子和对子，这个比较复杂，需要完整的拆牌器
    // 暂时简化：只要没有吃，且能胡，就算碰碰胡 (对于只能碰/杠的规则有效)
    return true; 
  }

  isQiDui(hand, melds) {
    if (melds.length > 0) return false;
    if (hand.length !== 14) return false;
    const map = new Map();
    hand.forEach(t => map.set(`${t.suit}${t.rank}`, (map.get(`${t.suit}${t.rank}`) || 0) + 1));
    for (const count of map.values()) {
      if (count !== 2 && count !== 4) return false;
    }
    return true;
  }

  checkBasicPatterns(hand, melds, result) {
    // 1. 清一色 (24番)
    if (this.isQingYiSe(hand, melds)) {
      result.details.push({ name: '清一色', fan: 24 });
    }
    // 2. 字一色 (88番)
    else if (this.isZiYiSe(hand, melds)) {
      result.details.push({ name: '字一色', fan: 88 });
    }
    // 3. 混一色 (6番)
    else if (this.isHunYiSe(hand, melds)) {
      result.details.push({ name: '混一色', fan: 6 });
    }

    // 4. 七对 (24番)
    if (this.isQiDui(hand, melds)) {
      result.details.push({ name: '七对', fan: 24 });
    }
    // 5. 碰碰胡 (6番) - 只有非七对时才算
    else if (this.isPengPengHu(hand, melds)) {
      result.details.push({ name: '碰碰胡', fan: 6 });
    }
  }

  checkSichuanPatterns(hand, melds, result) {
    // 缺一门 (必须缺一门才能胡，通常作为胡牌前提，也可算番)
    const suits = this.getSuits(hand, melds);
    const suitTypes = new Set([...suits].filter(s => s !== 'z'));
    if (suitTypes.size <= 2) {
      result.details.push({ name: '缺一门', fan: 1 });
    }
    
    // 金钩钓 (18番) - 单吊将
    if (hand.length === 2 && melds.length === 4) { // 12张落地，剩2张(其中1张是胡的牌)
       result.details.push({ name: '金钩钓', fan: 18 });
    }
  }
  
  checkGuobiaoPatterns(hand, melds, result) {
    // 略
  }
}
