import { describe, it, expect } from 'vitest';
import { evaluateDoudizhuPlay } from '../../services/games/poker/doudizhu.js';

function c(value) {
  return { id: `t${value}`, value: Number(value) };
}

describe('doudizhu evaluateDoudizhuPlay', () => {
  it('识别王炸', () => {
    const res = evaluateDoudizhuPlay([c(16), c(17)]);
    expect(res.type).toBe('rocket');
    expect(res.main).toBe(17);
  });

  it('识别炸弹', () => {
    const res = evaluateDoudizhuPlay([c(9), c(9), c(9), c(9)]);
    expect(res.type).toBe('bomb');
    expect(res.main).toBe(9);
    expect(res.length).toBe(4);
  });

  it('拒绝包含 2/王的顺子', () => {
    expect(() => evaluateDoudizhuPlay([c(10), c(11), c(12), c(13), c(15)])).toThrow();
    expect(() => evaluateDoudizhuPlay([c(11), c(12), c(13), c(14), c(16)])).toThrow();
  });

  it('识别顺子', () => {
    const res = evaluateDoudizhuPlay([c(3), c(4), c(5), c(6), c(7)]);
    expect(res.type).toBe('straight');
    expect(res.main).toBe(7);
    expect(res.length).toBe(5);
  });
});

