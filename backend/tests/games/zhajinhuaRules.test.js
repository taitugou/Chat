import { describe, it, expect } from 'vitest';
import { ZhajinhuaGame } from '../../services/games/poker/zhajinhua.js';

function card(value, suit) {
  return { value: Number(value), suit: String(suit), rank: String(value) };
}

describe('zhajinhua compareHands', () => {
  it('235 吃豹子（enable235=true）', () => {
    const p1 = 1;
    const p2 = 2;
    const g = new ZhajinhuaGame([p1, p2], { enable235: true });
    g.hands[p1] = [card(14, '♠'), card(14, '♥'), card(14, '♦')];
    g.hands[p2] = [card(5, '♠'), card(3, '♥'), card(2, '♦')];
    expect(g.compareHands(p1, p2)).toBe(p2);
  });

  it('A23 顺子在 a23Rule=low 时小于 234', () => {
    const p1 = 1;
    const p2 = 2;
    const g = new ZhajinhuaGame([p1, p2], { a23Rule: 'low' });
    g.hands[p1] = [card(14, '♠'), card(3, '♥'), card(2, '♦')];
    g.hands[p2] = [card(4, '♠'), card(3, '♣'), card(2, '♥')];
    expect(g.compareHands(p1, p2)).toBe(p2);
  });

  it('A23 顺子在 a23Rule=second 时大于 KQJ', () => {
    const p1 = 1;
    const p2 = 2;
    const g = new ZhajinhuaGame([p1, p2], { a23Rule: 'second' });
    g.hands[p1] = [card(14, '♠'), card(3, '♥'), card(2, '♦')];
    g.hands[p2] = [card(13, '♠'), card(12, '♣'), card(11, '♥')];
    expect(g.compareHands(p1, p2)).toBe(p1);
  });
});

