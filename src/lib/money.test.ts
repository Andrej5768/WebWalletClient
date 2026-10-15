import { formatMoney } from './money';

// Intl separates groups with a narrow no-break space in Ukrainian; compare with plain spaces.
const plain = (text: string) =>
  text.replaceAll(String.fromCharCode(0xa0), ' ').replaceAll(String.fromCharCode(0x202f), ' ');

describe('formatMoney', () => {
  it('formats hryvnias in Ukrainian with the symbol after the amount', () => {
    expect(plain(formatMoney(18452.37, 'UAH', { language: 'uk' }))).toBe('18 452,37 ₴');
  });

  it('formats dollars in English', () => {
    expect(formatMoney(1240, 'USD', { language: 'en' })).toBe('$1,240.00');
  });

  it('shows the sign when asked', () => {
    expect(plain(formatMoney(52000, 'UAH', { language: 'uk', signed: true }))).toBe('+52 000,00 ₴');
    expect(plain(formatMoney(-95, 'UAH', { language: 'uk', signed: true }))).toBe('-95,00 ₴');
    expect(plain(formatMoney(0, 'UAH', { language: 'uk', signed: true }))).toBe('0,00 ₴');
  });
});
