import type { TransactionQuery } from '../api/queries';
import { isPreset, periodOf, type Period, type Preset } from '../lib/periods';
import { intParam, useUrlParams, type ParamChanges } from '../lib/useUrlParams';

export const PAGE_SIZE = 50;
const TYPES = ['EXPENSE', 'INCOME', 'TRANSFER'] as const;

export interface TransactionFilters {
  params: URLSearchParams;
  preset: Preset;
  period: Period;
  page: number;
  query: TransactionQuery;
  /** Changes filters; any change except paging goes back to the first page. */
  update(changes: ParamChanges): void;
  reset(): void;
}

/** The feed's filters, kept in the URL so links (from accounts, payees, the overview) can set them. */
export function useTransactionFilters(): TransactionFilters {
  const [params, setParams] = useUrlParams();
  const period = params.get('period');
  const preset: Preset = isPreset(period) ? period : 'month';
  const range = periodOf(preset, undefined, {
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });
  const page = intParam(params, 'page') ?? 1;
  const type = TYPES.find((value) => value === params.get('type'));

  const update = (changes: ParamChanges) =>
    setParams('page' in changes ? changes : { ...changes, page: null });

  return {
    params,
    preset,
    period: range,
    page,
    query: {
      from: range.from,
      to: range.to,
      accountId: intParam(params, 'accountId'),
      categoryId: intParam(params, 'categoryId'),
      payeeId: intParam(params, 'payeeId'),
      tagId: intParam(params, 'tagId'),
      type,
      q: params.get('q')?.trim() || undefined,
      page: page - 1,
      size: PAGE_SIZE,
    },
    update,
    reset: () =>
      setParams(
        Object.fromEntries(
          [...params.keys()].filter((key) => key !== 'edit' && key !== 'new').map((key) => [key, null]),
        ),
      ),
  };
}
