import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { createQueryClient } from '../app/queryClient';
import { routes } from '../app/router';
import { kyivToday } from '../lib/periods';
import { theme } from '../theme/theme';

type Handler = (request: Request) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/** Requests no handler answered; `setup.ts` fails the test when any are left. */
export const unexpectedRequests: string[] = [];

/** Stubs fetch with handlers keyed by "METHOD /path" and returns the requests that were made. */
export function mockApi(handlers: Record<string, Handler>): Request[] {
  const requests: Request[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request ? input : new Request(new URL(String(input), location.origin), init);
    requests.push(request);
    const key = `${request.method} ${new URL(request.url).pathname}`;
    const handler = handlers[key];
    if (!handler) {
      unexpectedRequests.push(key);
      return json({ code: 'NOT_MOCKED', detail: key }, 501);
    }
    return handler(request);
  });
  return requests;
}

/** JSON body of the first request with this method and exact path. */
export async function bodyOf(requests: Request[], method: string, path: string): Promise<unknown> {
  const request = requests.find((item) => item.method === method && new URL(item.url).pathname === path);
  if (!request) throw new Error(`No ${method} ${path}`);
  return request.clone().json();
}

/** Text with no-break spaces turned into plain ones, for comparing formatted amounts. */
export const plain = (text: string | null | undefined) => (text ?? '').replace(/\s/g, ' ');

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

export const currentMonth = kyivToday().format('YYYY-MM');
const empty = { currency: 'UAH', months: [], categories: [], payees: [] };
const emptyBudget = {
  ...empty,
  month: currentMonth,
  readyToAssign: 0,
  assigned: 0,
  activity: 0,
  available: 0,
  unconvertedCurrencies: [],
};

/** Handlers for a signed-in session with empty data. */
export const signedInApi: Record<string, Handler> = {
  'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
  'GET /api/v1/categories': () => json([]),
  'GET /api/v1/payees': () => json([]),
  'GET /api/v1/tags': () => json([]),
  'GET /api/v1/categorization-rules': () => json([]),
  'GET /api/v1/transactions': () => json({ items: [], page: 0, size: 6, totalItems: 0, totalPages: 0 }),
  'GET /api/v1/reports/income-expense': () => json(empty),
  'GET /api/v1/reports/spending': () => json(empty),
  [`GET /api/v1/budget/${currentMonth}`]: () => json(emptyBudget),
  'POST /api/v1/auth/refresh': () => json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 }),
  'GET /api/v1/me': () => json(user),
  'GET /api/v1/accounts': () => json([]),
  'GET /api/v1/accounts/summary': () =>
    json({ currency: 'UAH', netWorth: 0, available: 0, availableWithCredit: 0, readyToAssign: 0 }),
};

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <QueryClientProvider client={createQueryClient({ retry: false })}>
        <ModalsProvider>{children}</ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}

/** Renders the whole app (routes, session) at a path. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

/** Renders one component with the app providers and a router. */
export function renderWithProviders(ui: ReactNode, path = '/') {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </Providers>,
  );
}
