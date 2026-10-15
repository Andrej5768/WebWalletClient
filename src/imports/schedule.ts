import type { Connection, SyncMode } from './api';

const DEFAULT_SCHEDULE = {
  syncMode: 'INTERVAL' as SyncMode,
  windowStart: '08:00',
  windowEnd: '23:00',
  dailyAt: '06:00',
};

const hhmm = (value?: string | null) => (value ? value.slice(0, 5) : undefined);

/** The schedule of a connection as form values, with defaults for a new one. */
export function scheduleOf(connection?: Connection | null) {
  return {
    syncMode: connection?.syncMode ?? DEFAULT_SCHEDULE.syncMode,
    windowStart: hhmm(connection?.windowStart) ?? DEFAULT_SCHEDULE.windowStart,
    windowEnd: hhmm(connection?.windowEnd) ?? DEFAULT_SCHEDULE.windowEnd,
    dailyAt: hhmm(connection?.dailyAt) ?? DEFAULT_SCHEDULE.dailyAt,
  };
}
