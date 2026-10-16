import dayjs from 'dayjs';
import { capitalize, formatDay, formatDayShort, formatMonthTitle } from './format';
import { kyivToday } from './periods';
import { formatMoney, formatMoneyCompact, formatQuantity } from './money';
import { plain } from '../test/render';

it('capitalizes only the first letter of a month title', () => {
  expect(plain(formatMonthTitle(dayjs('2026-10-01')))).toBe('Жовтень 2026 р.');
  expect(capitalize('жовт. 26')).toBe('Жовт. 26');
});

it('shows the year of a day only when it is not the current one', () => {
  const thisYear = kyivToday().year();
  expect(plain(formatDayShort(`${thisYear}-10-20`))).toBe('20 жовт.');
  expect(plain(formatDayShort(`${thisYear + 1}-08-17`))).toBe(`17 серп. ${thisYear + 1} р.`);
  expect(plain(formatDay(`${thisYear}-10-26`))).toBe(`26 жовт. ${thisYear} р.`);
});

it('never shows a minus before zero and formats compact amounts and quantities', () => {
  expect(plain(formatMoney(-0, 'UAH'))).toBe('0,00 ₴');
  expect(plain(formatMoney(-0.001, 'UAH'))).toBe('0,00 ₴');
  expect(plain(formatMoney(4200000.4, 'UAH', { decimals: 0 }))).toBe('4 200 000 ₴');
  expect(plain(formatMoneyCompact(150000, 'UAH'))).toBe('150 тис. ₴');
  expect(plain(formatQuantity(12.5))).toBe('12,5');
});
