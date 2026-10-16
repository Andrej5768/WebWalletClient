import { useBaseCurrency } from '../api/queries';
import { useUrlParams } from '../lib/useUrlParams';

/** The other currency the investment tabs can be shown in. */
export const ALTERNATIVE = 'USD';

/**
 * The currency the investment tabs are shown in: the base currency or US dollars, kept in the URL (`currency`), so
 * the choice stays when another tab opens.
 */
export function useDisplayCurrency(): {
  /** The chosen currency; the base one until another is chosen. */
  currency: string;
  /** What to ask the API for: undefined for the base currency. */
  requested: string | undefined;
  set(currency: string): void;
  /** Whether there is anything to choose: the base currency is not already the alternative. */
  choice: boolean;
} {
  const base = useBaseCurrency();
  const [params, update] = useUrlParams();
  const chosen = params.get('currency');
  const currency = chosen === ALTERNATIVE ? ALTERNATIVE : base;
  return {
    currency,
    requested: currency === base ? undefined : currency,
    set: (value) => update({ currency: value === base ? null : value }),
    choice: base !== ALTERNATIVE,
  };
}
