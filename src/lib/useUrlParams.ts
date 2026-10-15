import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

export type ParamChanges = Record<string, string | null | undefined>;

/**
 * URL search params as page state. `update` sets or removes keys in place (no history entry);
 * empty values remove the key.
 */
export function useUrlParams(): [URLSearchParams, (changes: ParamChanges) => void] {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (changes: ParamChanges) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) =>
            value ? next.set(key, value) : next.delete(key),
          );
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [params, update];
}

/** A positive integer param, or undefined when missing or malformed. */
export function intParam(params: URLSearchParams, key: string): number | undefined {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
