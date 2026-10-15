import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';
import { getAccessToken, setAccessToken } from './session';

export type Schemas = components['schemas'];

const REFRESH_PATH = '/api/v1/auth/refresh';
// Endpoints where a 401 means wrong credentials or an invalid link, not an expired access token.
const NO_REFRESH = ['/api/v1/auth/'];

let refreshing: Promise<string | null> | null = null;

/**
 * Exchanges the refresh token cookie for a new access token. Concurrent callers share one request,
 * because the backend rotates the refresh token and a second parallel call would be rejected as reuse.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch(REFRESH_PATH, { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as Schemas['TokenResponse'];
        return body.accessToken ?? null;
      })
      .catch(() => null)
      .then((token) => {
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// Copies of outgoing requests, kept so a request can be replayed after a refresh (its body is consumed).
const replays = new WeakMap<Request, Request>();

const auth: Middleware = {
  onRequest({ request }) {
    const token = getAccessToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    replays.set(request, request.clone());
    return request;
  },
  async onResponse({ request, response }) {
    const path = new URL(request.url).pathname;
    if (response.status !== 401 || NO_REFRESH.some((prefix) => path.startsWith(prefix))) return response;

    const replay = replays.get(request);
    const token = await refreshAccessToken();
    if (!token || !replay) return response;

    replay.headers.set('Authorization', `Bearer ${token}`);
    return fetch(replay);
  },
};

export const api = createClient<paths>({
  baseUrl: window.location.origin,
  credentials: 'include',
  // Resolve fetch on every call so tests can stub it.
  fetch: (request) => globalThis.fetch(request),
});
api.use(auth);
