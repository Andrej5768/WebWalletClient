// Values kept per viewer in the browser. Storage may be unavailable (private mode), then they are just not kept.

/** Keys of the financial inputs kept in the browser; they are removed when the session ends. */
export const DATA_KEYS = ['ww-fire', 'ww-fym', 'ww-compound', 'ww-forecast-minimum'] as const;

const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The stored value, or the fallback; a stored object is laid over an object fallback, so new fields get defaults. */
export function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw) as T;
    return isObject(fallback) && isObject(value) ? { ...fallback, ...value } : value;
  } catch {
    return fallback;
  }
}

/** Keeps the value; null or undefined removes it. */
export function store(key: string, value: unknown): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not critical: the values just will not survive a reload.
  }
}

/** Removes the financial inputs, so the next person to sign in on this browser does not see them. */
export function clearDataKeys(): void {
  DATA_KEYS.forEach((key) => store(key, null));
}
