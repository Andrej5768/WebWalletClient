import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../app/router';
import { theme } from '../theme/theme';

type Handler = (request: Request) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/**
 * Stubs fetch with handlers keyed by "METHOD /path". Unhandled requests fail the test loudly.
 * Returns the list of requests that were made.
 */
export function mockApi(handlers: Record<string, Handler>): Request[] {
  const requests: Request[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request ? input : new Request(new URL(String(input), location.origin), init);
    requests.push(request);
    const key = `${request.method} ${new URL(request.url).pathname}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request ${key}`);
    return handler(request);
  });
  return requests;
}

export const user = {
  id: 1,
  email: 'olena@example.com',
  firstName: 'Олена',
  lastName: 'Коваль',
  emailVerified: true,
  baseCurrency: 'UAH',
  locale: 'uk',
  role: 'USER',
};

/** Handlers for a signed-in session with empty data. */
export const signedInApi: Record<string, Handler> = {
  'POST /api/v1/auth/refresh': () => json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 }),
  'GET /api/v1/me': () => json(user),
  'GET /api/v1/accounts': () => json([]),
  'GET /api/v1/accounts/summary': () =>
    json({ currency: 'UAH', netWorth: 0, available: 0, availableWithCredit: 0, readyToAssign: 0 }),
};

export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
  return router;
}
