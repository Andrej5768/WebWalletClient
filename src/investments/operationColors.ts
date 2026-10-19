import type { OperationType } from './api';

/** The badge color of each operation type, the same in the operations list and the import preview. */
export const OPERATION_COLORS: Record<OperationType, string> = {
  BUY: 'blue',
  SELL: 'violet',
  DIVIDEND: 'green',
  COUPON: 'green',
  FEE: 'gray',
  SPLIT: 'gray',
  DEPOSIT: 'teal',
  WITHDRAWAL: 'teal',
  EXCHANGE: 'orange',
};
