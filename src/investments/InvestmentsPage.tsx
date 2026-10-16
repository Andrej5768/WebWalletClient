import { Button, Chip, Group, Skeleton, Stack, Tabs, Text, Title } from '@mantine/core';
import { Plus } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useAccounts } from '../api/queries';
import { intParam } from '../lib/useUrlParams';
import { isBrokerage } from './api';
import { OperationDrawer } from './operations/OperationDrawer';

// The tabs and their charts load when opened.
const OverviewTab = lazy(() => import('./overview/OverviewTab').then((m) => ({ default: m.OverviewTab })));
const PositionsTab = lazy(() =>
  import('./positions/PositionsTab').then((m) => ({ default: m.PositionsTab })),
);
const DividendsTab = lazy(() =>
  import('./dividends/DividendsTab').then((m) => ({ default: m.DividendsTab })),
);

const tabs = ['overview', 'positions', 'dividends'] as const;
type Tab = (typeof tabs)[number];

/**
 * The portfolio of the brokerage accounts. The URL keeps the tab (`tab`), the account (`accountId`, all by default)
 * and an open operation drawer (`operation=new` or an operation id, `instrumentId` to start a new one with).
 */
export function InvestmentsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const accounts = useAccounts();
  const tab = (tabs as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'overview';
  const accountId = intParam(params, 'accountId');
  const brokerage = (accounts.data ?? []).filter((account) => isBrokerage(account) && !account.archived);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };
  const operation = params.get('operation');

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Title order={1} size="h2">
          {t('investments.title')}
        </Title>
        <Button
          leftSection={<Plus size={16} />}
          disabled={brokerage.length === 0}
          onClick={() => update({ operation: 'new', instrumentId: null })}
        >
          {t('investments.addOperation')}
        </Button>
      </Group>

      {accounts.isSuccess && brokerage.length === 0 ? (
        <Text c="dimmed">{t('investments.noAccounts')}</Text>
      ) : (
        <>
          {brokerage.length > 1 && (
            <Chip.Group
              value={accountId ? String(accountId) : 'all'}
              onChange={(value) => update({ accountId: value === 'all' ? null : (value as string) })}
            >
              <Group gap="xs">
                <Chip value="all" size="sm">
                  {t('investments.allAccounts')}
                </Chip>
                {brokerage.map((account) => (
                  <Chip key={account.id} value={String(account.id)} size="sm">
                    {account.name}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          )}
          <Tabs value={tab} onChange={(value) => update({ tab: value === 'overview' ? null : value })}>
            <Tabs.List>
              {tabs.map((value) => (
                <Tabs.Tab key={value} value={value}>
                  {t(`investments.tabs.${value}`)}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          <Suspense fallback={<Skeleton height={320} radius="md" />}>
            {tab === 'overview' && <OverviewTab accountId={accountId} />}
            {tab === 'positions' && <PositionsTab accountId={accountId} />}
            {tab === 'dividends' && <DividendsTab accountId={accountId} />}
          </Suspense>
        </>
      )}

      {operation && (
        <OperationDrawer
          operationId={operation === 'new' ? null : Number(operation)}
          accountId={accountId ?? brokerage[0]?.id}
          instrumentId={intParam(params, 'instrumentId')}
          onClose={() => update({ operation: null, instrumentId: null })}
        />
      )}
    </Stack>
  );
}
