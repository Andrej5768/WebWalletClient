import dayjs from 'dayjs';
import type { components } from '../api/schema';

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
  const x = (index: number) => round(plot.left + (index * (plot.right - plot.left)) / span);
  const y = (balance: number) => round(plot.top + ((hi - balance) / (hi - lo)) * (plot.bottom - plot.top));
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

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

const storageKey = 'ww-forecast-minimum';

/** The minimum balance the viewer wants to keep, or null when not set. */
export function loadMinimum(): number | null {
  try {
    const value = localStorage.getItem(storageKey);
    return value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  } catch {
    return null;
  }
}

export function saveMinimum(value: number | null) {
  try {
    if (value == null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, String(value));
  } catch {
    // Not critical: the line just will not survive a reload.
  }
}
