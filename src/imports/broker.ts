import type { BrokerOperation, BrokerPreview, BrokerTicker, TickerChoice } from './api';

export const FILTERS = ['all', 'trades', 'income', 'fees', 'cash', 'skipped'] as const;
export type Filter = (typeof FILTERS)[number];

/** The filter of the preview a row belongs to; rows that are not imported are together. */
export function filterOf(operation: BrokerOperation): Exclude<Filter, 'all'> {
  if (operation.status !== 'NEW') return 'skipped';
  switch (operation.type) {
    case 'DIVIDEND':
    case 'COUPON':
      return 'income';
    case 'FEE':
      return 'fees';
    case 'DEPOSIT':
    case 'WITHDRAWAL':
      return 'cash';
    default:
      return 'trades';
  }
}

/** What a ticker becomes: the suggestion, one by hand, or another instrument picked by a search. */
export type Choice =
  { kind: 'suggested' } | { kind: 'manual' } | { kind: 'other'; instrument?: { id: number; label: string } };

/** Created by hand: chosen so, or suggested so when nothing else was chosen. */
export function isManual(ticker: BrokerTicker, choice: Choice | undefined): boolean {
  return (
    choice?.kind === 'manual' || ((choice?.kind ?? 'suggested') === 'suggested' && ticker.suggestion.manual)
  );
}

/** The instruments of the confirmation: only those that differ from the suggestion. */
export function choiceRequest(choices: Map<string, Choice>): TickerChoice[] {
  const request: TickerChoice[] = [];
  choices.forEach((choice, ticker) => {
    if (choice.kind === 'manual') request.push({ ticker, manual: true });
    else if (choice.kind === 'other' && choice.instrument)
      request.push({ ticker, instrumentId: choice.instrument.id });
  });
  return request;
}

/** Units of the ticker after the import without the excluded rows. */
export function quantityAfter(
  ticker: BrokerTicker,
  operations: BrokerOperation[],
  excluded: Set<string>,
): number {
  let quantity = ticker.quantityAfter;
  for (const operation of operations) {
    if (operation.ticker !== ticker.ticker || operation.status !== 'NEW' || !excluded.has(operation.key))
      continue;
    if (operation.type === 'BUY') quantity -= operation.quantity ?? 0;
    if (operation.type === 'SELL') quantity += operation.quantity ?? 0;
  }
  return round(quantity, 8);
}

/** Money per currency after the import without the excluded rows. */
export function cashAfter(
  cash: BrokerPreview['cash'],
  operations: BrokerOperation[],
  excluded: Set<string>,
): BrokerPreview['cash'] {
  const amounts = new Map(cash.map((item) => [item.currency, item.amount]));
  for (const operation of operations) {
    if (operation.status !== 'NEW' || !excluded.has(operation.key)) continue;
    amounts.set(operation.currency, (amounts.get(operation.currency) ?? 0) - operation.cash);
    if (operation.toCurrency && operation.toAmount != null) {
      amounts.set(operation.toCurrency, (amounts.get(operation.toCurrency) ?? 0) - operation.toAmount);
    }
  }
  return [...amounts].map(([currency, amount]) => ({ currency, amount: round(amount, 4) }));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
