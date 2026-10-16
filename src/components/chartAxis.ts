import { formatCompact } from '../lib/money';

/**
 * The Y axis of a chart of amounts: short ticks ("150 тис.") in a fixed width, so that six-figure amounts are not cut
 * off at the left edge. The tooltips keep the full amounts of `valueFormatter`.
 */
export const moneyAxis = { tickFormatter: (value: number) => formatCompact(value), width: 60 };
