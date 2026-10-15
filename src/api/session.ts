// The access token lives only in memory; the refresh token is an HttpOnly cookie the browser sends
// to /api/v1/auth on its own. A reload therefore starts with a refresh call.
// Tabs of the same browser share one session: a new token or a sign-out is announced to the others.

/** `remote` is true when the change was announced by another tab. */
type Listener = (token: string | null, remote: boolean) => void;
type Message = { type: 'token'; token: string } | { type: 'signedOut' };

let accessToken: string | null = null;
const listeners = new Set<Listener>();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ww-session');

export function getAccessToken(): string | null {
  return accessToken;
}

function update(token: string | null, remote: boolean) {
  accessToken = token;
  listeners.forEach((listener) => listener(token, remote));
}

/** Sets the token of this tab only. */
export function setAccessToken(token: string | null): void {
  update(token, false);
}

/** Sets the token and tells the other tabs, so they use it instead of refreshing on their own. */
export function shareAccessToken(token: string | null): void {
  setAccessToken(token);
  channel?.postMessage(
    token ? ({ type: 'token', token } satisfies Message) : ({ type: 'signedOut' } satisfies Message),
  );
}

channel?.addEventListener('message', (event: MessageEvent<Message>) => {
  update(event.data.type === 'token' ? event.data.token : null, true);
});

/** Subscribes to sign-in and sign-out; returns the unsubscribe function. */
export function onAccessTokenChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
