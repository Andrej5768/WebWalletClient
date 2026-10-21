import dayjs from 'dayjs';
import type { components } from '../api/schema';
import { roundTo } from '../lib/money';
import { loadStored, store } from '../lib/storage';

export type Forecast = components['schemas']['ForecastResponse'];
export type ForecastEvent = components['schemas']['ForecastEvent'];

/** Plot area of the chart in SVG units; the labels sit outside it. */
export const plot = { left: 48, right: 620, top: 16, bottom: 188, width: 640, height: 220 };

const STEP = 10_000;

export interface ForecastChart {
  x: (index: number) => number;
  y: (balance: number) => number;
  lo: number;
  hi: number;
  actual: string;
  forecast: string;
  todayIndex: number;
  /** Event markers on the day each is expected: an overdue one tomorrow. */
  markers: { x: number; y: number; income: boolean }[];
}

/** The day an event changes the forecast: overdue and today's ones are expected tomorrow. */
export function expectedDate(event: ForecastEvent, today: string): string {
  return event.date > today ? event.date : dayjs(today).add(1, 'day').format('YYYY-MM-DD');
}

/** Scales the days of the forecast (and the minimum, when set) into the plot area. */
export function forecastChart(forecast: Forecast, minimum: number | null): ForecastChart {
  const days = forecast.days;
  const balances = days.map((day) => day.balance).concat(minimum != null ? [minimum] : []);
  const lo = Math.floor((Math.min(...balances) - STEP / 2) / STEP) * STEP;
  const hi = Math.ceil((Math.max(...balances) + STEP / 2) / STEP) * STEP;
  const span = Math.max(1, days.length - 1);
  const x = (index: number) => roundTo(plot.left + (index * (plot.right - plot.left)) / span, 1);
  const y = (balance: number) =>
    roundTo(plot.top + ((hi - balance) / (hi - lo)) * (plot.bottom - plot.top), 1);
  const todayIndex = days.findIndex((day) => day.date === forecast.today);
  const points = (from: number, to: number) =>
    days
      .slice(from, to)
      .map((day, offset) => `${x(from + offset)},${y(day.balance)}`)
      .join(' ');
  const indexOf = new Map(days.map((day, index) => [day.date, index]));
  const markers = forecast.events.flatMap((event) => {
    const index = indexOf.get(expectedDate(event, forecast.today));
    const day = index === undefined ? undefined : days[index];
    return index === undefined || !day ? [] : [{ x: x(index), y: y(day.balance), income: event.amount > 0 }];
  });
  return {
    x,
    y,
    lo,
    hi,
    actual: points(0, todayIndex + 1),
    forecast: points(todayIndex, days.length),
    todayIndex,
    markers,
  };
}

const storageKey = 'ww-forecast-minimum';

/** The minimum balance the viewer wants to keep, or null when not set. */
export function loadMinimum(): number | null {
  const value = loadStored<unknown>(storageKey, null);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function saveMinimum(value: number | null) {
  store(storageKey, value);
}
