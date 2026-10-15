import createClient, { type Middleware } from 'openapi-fetch';
import i18n from '../i18n';
import type { components, paths } from './schema';
import { getAccessToken, setAccessToken, shareAccessToken } from './session';

export type Schemas = components['schemas'];

const AUTH_PREFIX = '/api/v1/auth/';
const REFRESH_PATH = `${AUTH_PREFIX}refresh`;

let refreshing: Promise<string | null> | null = null;

async function requestNewToken(): Promise<string | null> {
  try {
    const response = await fetch(REFRESH_PATH, { method: 'POST', credentials: 'include' });
    if (!response.ok) return null;
    const body = (await response.json()) as Schemas['TokenResponse'];
    return body.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Exchanges the refresh token cookie for a new access token. The backend rotates the refresh token and
 * treats a second use of the old one as theft, so only one refresh may run at a time: callers in this
 * tab share one request, and tabs take turns through a Web Lock. A tab that waited for the lock picks
 * up the token another tab has just announced instead of refreshing again.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    const before = getAccessToken();
    const run = async () => {
      const current = getAccessToken();
      if (current && current !== before) return current;
      const token = await requestNewToken();
      // A failed refresh signs out this tab only: another tab may still have a valid session
      // if the failure was the network.
      if (token) shareAccessToken(token);
      else setAccessToken(null);
      return token;
    };
    const locked = (async (): Promise<string | null> =>
      navigator.locks ? await navigator.locks.request('ww-refresh', run) : run())();
    const shared = locked.finally(() => {
      refreshing = null;
    });
    refreshing = shared;
    return shared;
  }
  return refreshing;
}

// Copies of outgoing requests, kept so a request can be replayed after a refresh (its body is consumed).
const replays = new WeakMap<Request, Request>();

const isAuthPath = (request: Request) => new URL(request.url).pathname.startsWith(AUTH_PREFIX);

const auth: Middleware = {
  onRequest({ request }) {
    const token = getAccessToken();
    // Sign-in endpoints do not take the access token; an expired one would only make them fail.
    if (token && !isAuthPath(request)) request.headers.set('Authorization', `Bearer ${token}`);
    // The backend translates error messages into this language.
    request.headers.set('Accept-Language', i18n.language);
    replays.set(request, request.clone());
    return request;
  },
  async onResponse({ request, response }) {
    // On sign-in endpoints a 401 means wrong credentials or an invalid link, not an expired token.
    if (response.status !== 401 || isAuthPath(request)) return response;

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
