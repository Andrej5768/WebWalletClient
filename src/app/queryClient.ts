import { notifications } from '@mantine/notifications';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { problemMessage, toProblem } from '../api/errors';

declare module '@tanstack/react-query' {
  interface Register {
    /** `errorShown`: the component renders the mutation's error itself, so no notification. */
    mutationMeta: { errorShown?: boolean };
  }
}

/**
 * The query client of the app (and of the tests, so they see the same caching). A mutation that
 * neither handles nor shows its error shows its problem as a notification instead of failing silently.
 */
export function createQueryClient(overrides: { retry?: boolean | number } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: overrides.retry ?? 1, refetchOnWindowFocus: false },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.options.onError || mutation.meta?.errorShown) return;
        notifications.show({ color: 'red', message: problemMessage(toProblem(error)) });
      },
    }),
  });
}
