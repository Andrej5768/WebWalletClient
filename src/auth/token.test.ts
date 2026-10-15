import { tokenFromHash, utf8Length } from './token';

describe('tokenFromHash', () => {
  it('reads the token from the URL fragment', () => {
    expect(tokenFromHash('#token=abc-123')).toBe('abc-123');
  });

  it('returns null without a token', () => {
    expect(tokenFromHash('')).toBeNull();
    expect(tokenFromHash('#token=')).toBeNull();
  });
});

describe('utf8Length', () => {
  it('counts a Cyrillic letter as two bytes', () => {
    expect(utf8Length('ab')).toBe(2);
    expect(utf8Length('їж')).toBe(4);
  });
});
