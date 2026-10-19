import { useCallback } from 'react';
import { useUrlParams } from '../../lib/useUrlParams';
import type { OperationType } from '../api';

/**
 * URL params of the operation drawer, on the investments page and the instrument page alike: `operation` (`new` or
 * an id), and for a new one `operationType`, `operationInstrumentId` and `operationAccountId`. They have their own
 * names so that they don't collide with the filters of the page (its `accountId`).
 */
export const OPERATION_KEYS = [
  'operation',
  'operationType',
  'operationInstrumentId',
  'operationAccountId',
] as const;
export const OPERATION_TYPES: OperationType[] = [
  'BUY',
  'SELL',
  'DIVIDEND',
  'COUPON',
  'FEE',
  'SPLIT',
  'DEPOSIT',
  'WITHDRAWAL',
  'EXCHANGE',
];

export interface OpenOperation {
  /** An operation to edit; without it a new one is recorded. */
  operationId?: number;
  type?: OperationType;
  instrumentId?: number;
  accountId?: number;
}

/** Opens the operation drawer of the page by setting its URL params. */
export function useOpenOperation() {
  const [, update] = useUrlParams();
  return useCallback(
    (open: OpenOperation = {}) =>
      update({
        operation: open.operationId ? String(open.operationId) : 'new',
        operationType: open.type ?? null,
        operationInstrumentId: open.instrumentId ? String(open.instrumentId) : null,
        operationAccountId: open.accountId ? String(open.accountId) : null,
      }),
    [update],
  );
}
