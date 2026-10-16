import type { ApiProblem } from '../../api/errors';
import { isoDate, kyivToday } from '../../lib/periods';
import type { Operation, OperationRequest, OperationType, PositionDetail } from '../api';

export interface OperationValues {
  type: OperationType;
  accountId: string | null;
  instrumentId: string | null;
  date: string | null;
  quantity: number | string;
  price: number | string;
  fee: number | string;
  /**
   * A trade: empty means quantity × price; an edited trade keeps its recorded amount (e.g. rounded by the broker)
   * until its quantity or price changes. A dividend, coupon or fee: the amount.
   */
  amount: number | string;
  tax: number | string;
  currency: string | null;
  splitFrom: number | string;
  splitTo: number | string;
  comment: string;
}

export const TRADES: OperationType[] = ['BUY', 'SELL'];
export const INCOMES: OperationType[] = ['DIVIDEND', 'COUPON'];

export const toNumber = (value: number | string): number => (value === '' ? 0 : Number(value));
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export function initialOperationValues(
  operation: Operation | null,
  defaults: { accountId?: number; instrumentId?: number; type?: OperationType } = {},
): OperationValues {
  return {
    type: operation?.type ?? defaults.type ?? 'BUY',
    accountId: operation
      ? String(operation.accountId)
      : defaults.accountId
        ? String(defaults.accountId)
        : null,
    instrumentId: operation?.instrumentId
      ? String(operation.instrumentId)
      : defaults.instrumentId
        ? String(defaults.instrumentId)
        : null,
    date: operation?.date ?? isoDate(kyivToday()),
    quantity: operation?.quantity ?? '',
    price: operation?.price ?? '',
    fee: operation && operation.fee ? operation.fee : '',
    amount: operation?.amount ?? '',
    tax: operation && operation.tax ? operation.tax : '',
    currency: operation?.currency ?? null,
    splitFrom: operation?.splitFrom ?? 1,
    splitTo: operation?.splitTo ?? '',
    comment: operation?.comment ?? '',
  };
}

/** The amount of a trade: the recorded one of an edited trade, else quantity × price rounded to 4 decimals. */
export function tradeAmount(values: OperationValues): number {
  if (values.amount !== '') return toNumber(values.amount);
  return round(toNumber(values.quantity) * toNumber(values.price), 4);
}

/** How the operation changes the free cash of the account, in its currency. */
export function cashChange(values: OperationValues): number {
  const fee = toNumber(values.fee);
  switch (values.type) {
    case 'BUY':
      return -(tradeAmount(values) + fee);
    case 'SELL':
      return tradeAmount(values) - fee;
    case 'DIVIDEND':
    case 'COUPON':
      return toNumber(values.amount) - toNumber(values.tax);
    case 'FEE':
      return -toNumber(values.amount);
    default:
      return 0;
  }
}

export function toOperationBody(values: OperationValues): OperationRequest {
  const trade = TRADES.includes(values.type);
  const income = INCOMES.includes(values.type);
  return {
    type: values.type,
    accountId: Number(values.accountId),
    instrumentId: values.instrumentId ? Number(values.instrumentId) : undefined,
    date: values.date!,
    quantity: trade ? toNumber(values.quantity) : undefined,
    price: trade ? toNumber(values.price) : undefined,
    fee: trade ? toNumber(values.fee) : undefined,
    amount: trade ? tradeAmount(values) : values.type === 'SPLIT' ? undefined : toNumber(values.amount),
    tax: income ? toNumber(values.tax) : undefined,
    currency: values.currency ?? undefined,
    splitFrom: values.type === 'SPLIT' ? toNumber(values.splitFrom) : undefined,
    splitTo: values.type === 'SPLIT' ? toNumber(values.splitTo) : undefined,
    comment: values.comment.trim() || undefined,
  };
}

export interface FifoPart {
  operationId: number;
  date: string;
  quantity: number;
  unitCost: number;
}

export interface FifoPreview {
  parts: FifoPart[];
  /** Units the open lots do not cover. */
  missing: number;
  proceeds: number;
  cost: number;
  realized: number;
  /** The profit if the cost were the average price of the position, for comparison. */
  realizedByAverage: number | null;
}

/**
 * Which open lots a sale takes, oldest first (FIFO), and what it earns. When an existing sale is edited, the lots it
 * took (`editedSale`) are open again for the preview, as the backend replays the sale with its new values.
 */
export function fifoPreview(
  position: Pick<PositionDetail, 'lots' | 'averagePrice'>,
  quantity: number,
  price: number,
  fee: number,
  editedSale?: Pick<PositionDetail['sales'][number], 'parts'>,
): FifoPreview {
  const returned = new Map<number, number>();
  for (const part of editedSale?.parts ?? []) {
    returned.set(part.lotOperationId, (returned.get(part.lotOperationId) ?? 0) + part.quantity);
  }
  const open = position.lots
    .map((lot) => ({ ...lot, remaining: lot.remaining + (returned.get(lot.operationId) ?? 0) }))
    .filter((lot) => lot.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.operationId - b.operationId);
  let left = quantity;
  const parts: FifoPart[] = [];
  let cost = 0;
  for (const lot of open) {
    if (left <= 0) break;
    const taken = Math.min(left, lot.remaining);
    parts.push({ operationId: lot.operationId, date: lot.date, quantity: taken, unitCost: lot.unitCost });
    cost += taken * lot.unitCost;
    left = round(left - taken, 8);
  }
  const proceeds = quantity * price - fee;
  return {
    parts,
    missing: Math.max(0, left),
    proceeds: round(proceeds),
    cost: round(cost),
    realized: round(proceeds - cost),
    realizedByAverage:
      position.averagePrice != null ? round(proceeds - quantity * position.averagePrice) : null,
  };
}

/** Form errors from the backend's field errors. */
export function formErrors(problem: ApiProblem): Record<string, string> {
  return Object.fromEntries((problem.errors ?? []).map(({ field, message }) => [field, message]));
}
