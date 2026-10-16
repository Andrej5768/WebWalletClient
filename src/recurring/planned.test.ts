import { occurrenceOf } from '../test/fixtures';
import { byDayDescending, plannedRows } from './planned';

it('shows a frequent series by its nearest date and keeps overdue dates and other series one by one', () => {
  const weekly = [7, 14, 21, 28].map((day) =>
    occurrenceOf({ recurringId: 2, name: 'Кишенькові', date: `2026-10-${String(day).padStart(2, '0')}` }),
  );
  const rent = occurrenceOf({ recurringId: 1, date: '2026-10-24' });
  const overdue = occurrenceOf({ recurringId: 3, date: '2026-10-05', overdue: true });

  const rows = plannedRows([overdue, ...weekly, rent]);

  expect(rows).toHaveLength(3);
  expect(rows.find((row) => row.occurrence.recurringId === 2)).toMatchObject({
    repeats: 4,
    until: '2026-10-28',
  });
  expect(byDayDescending(rows).map((day) => day.date)).toEqual(['2026-10-24', '2026-10-07', '2026-10-05']);
});
