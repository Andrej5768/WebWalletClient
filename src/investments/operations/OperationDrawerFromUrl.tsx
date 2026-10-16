import { intParam, useUrlParams } from '../../lib/useUrlParams';
import type { OperationType } from '../api';
import { OperationDrawer } from './OperationDrawer';
import { OPERATION_KEYS, OPERATION_TYPES } from './useOpenOperation';

/**
 * The operation drawer when the URL asks for it. A malformed `operation` is ignored. Closing clears every param of
 * the drawer, so the next one starts fresh.
 *
 * @param defaultAccountId the account a new operation starts on when the URL names none
 */
export function OperationDrawerFromUrl({ defaultAccountId }: { defaultAccountId?: number }) {
  const [params, update] = useUrlParams();
  const operation = params.get('operation');
  const operationId = intParam(params, 'operation');
  if (operation !== 'new' && operationId === undefined) return null;
  const type = params.get('operationType') as OperationType | null;
  return (
    <OperationDrawer
      operationId={operationId ?? null}
      accountId={intParam(params, 'operationAccountId') ?? defaultAccountId}
      instrumentId={intParam(params, 'operationInstrumentId')}
      type={type && OPERATION_TYPES.includes(type) ? type : undefined}
      onClose={() => update(Object.fromEntries(OPERATION_KEYS.map((key) => [key, null])))}
    />
  );
}
