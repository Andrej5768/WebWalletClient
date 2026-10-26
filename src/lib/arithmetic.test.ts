import { evaluate, isExpression } from './arithmetic';

describe('evaluate', () => {
  it('computes the four operations with precedence and parentheses', () => {
    expect(evaluate('350+120')).toBe(470);
    expect(evaluate('1200*0.8')).toBe(960);
    expect(evaluate('1200*0,8')).toBe(960);
    expect(evaluate('10 - 2 * 3')).toBe(4);
    expect(evaluate('(10 - 2) * 3')).toBe(24);
    expect(evaluate('1 000 / 4')).toBe(250);
    expect(evaluate('-5+8')).toBe(3);
  });

  it('applies a percent to its neighbour', () => {
    expect(evaluate('1200*15%')).toBe(180);
    expect(evaluate('1200+15%')).toBe(1380);
    expect(evaluate('1200-15%')).toBe(1020);
    expect(evaluate('15%')).toBe(0.15);
    expect(evaluate('100/50%')).toBe(200);
  });

  it('rounds to the cents and rejects what is not a complete expression', () => {
    expect(evaluate('10/3')).toBe(3.33);
    expect(evaluate('')).toBeNull();
    expect(evaluate('12+')).toBeNull();
    expect(evaluate('abc')).toBeNull();
    expect(evaluate('(1+2')).toBeNull();
    expect(evaluate('1/0')).toBeNull();
  });
});

describe('isExpression', () => {
  it('tells arithmetic from a plain number', () => {
    expect(isExpression('1200')).toBe(false);
    expect(isExpression('-1200,50')).toBe(false);
    expect(isExpression('1200*0.8')).toBe(true);
    expect(isExpression('15%')).toBe(true);
  });
});
