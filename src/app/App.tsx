import { localStorageColorSchemeManager, MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RouterProvider } from 'react-router';
import 'dayjs/locale/en-gb';
import 'dayjs/locale/uk';
import { cssVariablesResolver, theme } from '../theme/theme';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const colorSchemeManager = localStorageColorSchemeManager({ key: 'ww-color-scheme' });

export function App() {
  const { i18n } = useTranslation();
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme="auto"
    >
      <DatesProvider settings={{ locale: i18n.language === 'en' ? 'en-gb' : 'uk', firstDayOfWeek: 1 }}>
        <Notifications position="top-right" />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
