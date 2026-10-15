import { api, refreshAccessToken } from './client';
import { getAccessToken, setAccessToken } from './session';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setAccessToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const urlOf = (input: Parameters<typeof fetch>[0]) =>
  new URL(input instanceof Request ? input.url : String(input), window.location.origin).pathname;

describe('refreshAccessToken', () => {
  it('stores the new access token', async () => {
    fetchMock.mockResolvedValueOnce(json({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 }));

    await expect(refreshAccessToken()).resolves.toBe('new');
    expect(getAccessToken()).toBe('new');
  });

  it('sends one request for parallel callers', async () => {
    fetchMock.mockResolvedValueOnce(json({ accessToken: 'shared', tokenType: 'Bearer', expiresIn: 900 }));

    const tokens = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(tokens).toEqual(['shared', 'shared']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('signs out when the cookie is rejected', async () => {
    setAccessToken('old');
    fetchMock.mockResolvedValueOnce(json({ code: 'INVALID_REFRESH_TOKEN' }, 401));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe('api client', () => {
  it('sends the access token', async () => {
    setAccessToken('token-1');
    fetchMock.mockResolvedValueOnce(json([]));

    await api.GET('/api/v1/accounts');

    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(request.headers.get('Authorization')).toBe('Bearer token-1');
  });

  it('refreshes an expired access token and repeats the request', async () => {
    setAccessToken('expired');
    fetchMock
      .mockResolvedValueOnce(json({ code: 'UNAUTHORIZED' }, 401))
      .mockResolvedValueOnce(json({ accessToken: 'fresh', tokenType: 'Bearer', expiresIn: 900 }))
      .mockResolvedValueOnce(json([{ id: 1 }]));

    const { data } = await api.GET('/api/v1/accounts');

    expect(data).toEqual([{ id: 1 }]);
    expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).toEqual([
      '/api/v1/accounts',
      '/api/v1/auth/refresh',
      '/api/v1/accounts',
    ]);
    const replay = fetchMock.mock.calls[2]![0] as Request;
    expect(replay.headers.get('Authorization')).toBe('Bearer fresh');
  });

  it('does not send the access token to sign-in endpoints', async () => {
    setAccessToken('expired');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await api.POST('/api/v1/auth/logout');

    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(request.headers.get('Authorization')).toBeNull();
  });

  it('does not refresh after a failed sign-in', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: 'BAD_CREDENTIALS' }, 401));

    const { error } = await api.POST('/api/v1/auth/login', { body: { email: 'a@b.c', password: 'wrong' } });

    expect(error).toEqual({ code: 'BAD_CREDENTIALS' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
