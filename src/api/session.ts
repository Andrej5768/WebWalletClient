// The access token lives only in memory; the refresh token is an HttpOnly cookie the browser sends
// to /api/v1/auth on its own. A reload therefore starts with a refresh call.

type Listener = (token: string | null) => void;

let accessToken: string | null = null;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((listener) => listener(token));
}

/** Subscribes to sign-in and sign-out; returns the unsubscribe function. */
export function onAccessTokenChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
