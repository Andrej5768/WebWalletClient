import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { api } from '../api/client';
import { check } from '../api/http';
import { queryKeys } from '../api/queries';
import type { Connection } from './api';

// One clock for every countdown on the page, ticking while a component listens
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  ticker ??= setInterval(() => listeners.forEach((tick) => tick()), 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && ticker) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Seconds until the moment, counted down every second; 0 when it has passed or there is none. */
export function useCountdown(moment?: string | null): number {
  const now = useSyncExternalStore(subscribe, nowSeconds, nowSeconds);
  return moment ? Math.max(0, Math.ceil(new Date(moment).getTime() / 1000 - now)) : 0;
}

/**
 * The state of a synchronization on request: the bank allows one request a minute, so the button waits for
 * `nextRequestAt`; while the due moment is in the past the accounts are being requested, and the status is refreshed
 * until it is done.
 */
export function useSyncNow(connection?: Connection | null) {
  const queryClient = useQueryClient();
  const waitSeconds = useCountdown(connection?.nextRequestAt);
  const untilDue = useCountdown(connection?.nextSyncAt);
  const inProgress = connection?.nextSyncAt != null && untilDue === 0;
  const sync = useMutation({
    mutationFn: () => check(api.POST('/api/v1/banks/monobank/sync')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.monobank }),
  });
  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(
      () => void queryClient.invalidateQueries({ queryKey: queryKeys.monobank }),
      5000,
    );
    return () => clearInterval(timer);
  }, [inProgress, queryClient]);
  return {
    sync: () => sync.mutate(),
    pending: sync.isPending,
    inProgress,
    waitSeconds: inProgress ? 0 : waitSeconds,
  };
}
