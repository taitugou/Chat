import { describe, it, expect } from 'vitest';
import { evaluatePaodekuaiPlay } from '../../services/games/poker/paodekuai.js';

function c(value) {
  return { id: `t${value}`, value: Number(value), rank: String(value), suit: '♠' };
}

describe('paodekuai evaluatePaodekuaiPlay', () => {
  it('识别单张/对子/三条', () => {
    expect(evaluatePaodekuaiPlay([c(7)]).type).toBe('single');
    expect(evaluatePaodekuaiPlay([c(9), c(9)]).type).toBe('pair');
    expect(evaluatePaodekuaiPlay([c(11), c(11), c(11)]).type).toBe('triple');
  });

  it('识别顺子且不允许 2', () => {
    const ok = evaluatePaodekuaiPlay([c(3), c(4), c(5), c(6), c(7)]);
    expect(ok.type).toBe('straight');
    expect(() => evaluatePaodekuaiPlay([c(10), c(11), c(12), c(13), c(15)])).toThrow();
  });

  it('识别炸弹', () => {
    const res = evaluatePaodekuaiPlay([c(6), c(6), c(6), c(6)]);
    expect(res.type).toBe('bomb');
  });
});

