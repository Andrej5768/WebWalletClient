import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  Banknote,
  BriefcaseBusiness,
  CircleCheck,
  CreditCard,
  EllipsisVertical,
  FileText,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { api, type Schemas } from '../api/client';
import { check } from '../api/http';
import { invalidateLedger, useAccounts, useAccountsSummary, useMonobankStatus } from '../api/queries';
import { QueryError } from '../components/feedback';
import { Figure } from '../components/Figure';
import { formatDateTime } from '../lib/format';
import { accountColorName, sumInBase, type AccountType } from '../lib/accounts';
import { formatMoney } from '../lib/money';
import { AccountFormModal } from './AccountFormModal';
import { groupAccounts, type Account } from './groups';
import classes from './accounts.module.css';

const TYPE_ICONS: Record<AccountType, ReactNode> = {
  CARD: <CreditCard size={16} />,
  CREDIT_CARD: <CreditCard size={16} />,
  CASH: <Banknote size={16} />,
  SAVINGS: <PiggyBank size={16} />,
  DEPOSIT: <Landmark size={16} />,
  LOAN: <FileText size={16} />,
  DEBT: <Users size={16} />,
  INVESTMENT: <TrendingUp size={16} />,
  FOP: <BriefcaseBusiness size={16} />,
};

type Link = Schemas['LinkResponse'];

export function AccountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const summary = useAccountsSummary();
  const monobank = useMonobankStatus();
  const [showArchived, setShowArchived] = useLocalStorage({
    key: 'ww-accounts-archived',
    defaultValue: false,
  });
  const [editing, setEditing] = useState<Account | null | undefined>(undefined);

  // Omitted optional fields keep their values, so only the archive flag changes.
  const archive = useMutation({
    mutationFn: (account: Account) =>
      check(
        api.PUT('/api/v1/accounts/{id}', {
          params: { path: { id: account.id } },
          body: {
            name: account.name,
            type: account.type,
            currency: account.currency,
            archived: !account.archived,
          },
        }),
      ),
    onSettled: () => invalidateLedger(queryClient),
  });

  const links = new Map<number, Link>(
    (monobank.data?.accounts ?? [])
      .filter((link) => link.accountId != null)
      .map((link) => [link.accountId!, link]),
  );
  const groups = groupAccounts(accounts.data ?? [], showArchived);
  const count = (accounts.data ?? []).filter((account) => !account.archived).length;
  const currency = summary.data?.currency ?? 'UAH';
  const active = (accounts.data ?? []).filter((account) => !account.archived);
  const credits = active.filter((account) => account.type === 'CREDIT_CARD' || account.type === 'LOAN');
  const people = active.filter((account) => account.type === 'DEBT');
  // What the user owes: the negative balances; a positive debt account is money others owe the user
  const creditDebt = sumInBase(credits, (balance) => Math.min(balance, 0));
  const peopleDebt = sumInBase(people, (balance) => Math.min(balance, 0));
  const owedToUser = sumInBase(people, (balance) => Math.max(balance, 0)).total;

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={4}>
          <Title order={1} size="h2">
            {t('nav.accounts')}
          </Title>
          <Text c="dimmed">{t('accounts.subtitle', { count })}</Text>
        </Stack>
        <Group gap="sm">
          <Checkbox
            size="xs"
            label={t('accounts.showArchived')}
            checked={showArchived}
            onChange={(event) => setShowArchived(event.currentTarget.checked)}
          />
          <Button leftSection={<Plus size={16} />} onClick={() => setEditing(null)}>
            {t('accounts.add')}
          </Button>
        </Group>
      </Group>

      <QueryError error={accounts.error ?? summary.error} onRetry={() => void accounts.refetch()} />
      {monobank.data?.lastError && (
        <Alert
          color="yellow"
          variant="light"
          icon={<TriangleAlert size={18} />}
          title={t('accounts.monobankError')}
        >
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">{monobank.data.lastError}</Text>
            <Button size="xs" variant="default" onClick={() => void navigate('/imports')}>
              {t('accounts.openImports')}
            </Button>
          </Group>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
        <Figure
          label={t('balance.netWorth.label')}
          value={summary.data ? formatMoney(summary.data.netWorth, currency) : '—'}
        />
        <Figure
          label={t('accounts.available')}
          value={summary.data ? formatMoney(summary.data.available, currency) : '—'}
        />
        <Figure
          label={t('accounts.creditDebt')}
          value={formatMoney(-creditDebt.total, currency)}
          note={creditDebt.incomplete ? t('accounts.withoutRate') : undefined}
        />
        <Figure
          label={t('accounts.peopleDebt')}
          value={formatMoney(-peopleDebt.total, currency)}
          note={
            peopleDebt.incomplete
              ? t('accounts.withoutRate')
              : owedToUser > 0
                ? t('accounts.owedToYou', { amount: formatMoney(owedToUser, currency) })
                : undefined
          }
        />
      </SimpleGrid>

      <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 940 }}>
          <div className={`${classes.row} ${classes.head}`}>
            <span>{t('accounts.columns.account')}</span>
            <span>{t('accounts.columns.currency')}</span>
            <span className={classes.right}>{t('accounts.columns.balance')}</span>
            <span className={classes.right}>{t('accounts.columns.inBase', { currency })}</span>
            <span>{t('accounts.columns.status')}</span>
            <span />
          </div>
          {accounts.isLoading && <Skeleton height={160} m="md" />}
          {!accounts.isLoading && groups.length === 0 && (
            <Stack align="center" gap={6} py={48}>
              <Text fw={500}>{t('accounts.empty.title')}</Text>
              <Text size="sm" c="dimmed">
                {t('accounts.empty.text')}
              </Text>
            </Stack>
          )}
          {groups.map((group) => (
            <div key={group.key}>
              <div className={`${classes.row} ${classes.group}`}>
                <span>{t(`accounts.groups.${group.key}`)}</span>
                <span />
                <span />
                <span className={`num ${classes.right}`}>
                  {group.totalInBase != null && formatMoney(group.totalInBase, currency)}
                </span>
                <span />
                <span />
              </div>
              {group.accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  link={links.get(account.id!)}
                  baseCurrency={currency}
                  onEdit={() => setEditing(account)}
                  onArchive={() => archive.mutate(account)}
                  onTransactions={() => void navigate(`/transactions?accountId=${account.id}`)}
                  onNewTransaction={() => void navigate(`/transactions?new=1&accountId=${account.id}`)}
                  onPositions={
                    account.type === 'INVESTMENT'
                      ? () => void navigate(`/investments?tab=positions&accountId=${account.id}`)
                      : undefined
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </Card>

      {editing !== undefined && <AccountFormModal account={editing} onClose={() => setEditing(undefined)} />}
    </Stack>
  );
}

interface RowProps {
  account: Account;
  link?: Link;
  baseCurrency: string;
  onEdit(): void;
  onArchive(): void;
  onTransactions(): void;
  onNewTransaction(): void;
  /** A brokerage account opens its positions; its balance is mostly them. */
  onPositions?: () => void;
}

function AccountRow({
  account,
  link,
  baseCurrency,
  onEdit,
  onArchive,
  onTransactions,
  onNewTransaction,
  onPositions,
}: RowProps) {
  const { t } = useTranslation();
  const balance = account.balance ?? 0;
  const foreign = account.currency !== baseCurrency;
  const difference = link?.difference ?? 0;

  return (
    <div
      className={`${classes.row} ${classes.item}`}
      style={{ opacity: account.archived ? 0.6 : 1 }}
      onDoubleClick={onPositions ?? onEdit}
    >
      <Group gap={12} wrap="nowrap" py={8}>
        <ThemeIcon variant="light" color={accountColorName(account.type)} size={32} radius="md">
          {account.type && TYPE_ICONS[account.type]}
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text fw={500} truncate>
            {account.name}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {[link ? 'Monobank' : null, account.type && t(`accounts.types.${account.type}`)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </div>
      </Group>
      <span>
        <Badge variant="default" radius="sm" ff="monospace" fw={500}>
          {account.currency}
        </Badge>
      </span>
      <div className={classes.right}>
        <Text className={`num ${balance < 0 ? 'expense' : ''}`} fw={500}>
          {formatMoney(balance, account.currency ?? baseCurrency)}
        </Text>
        {account.type === 'CREDIT_CARD' && account.creditLimit ? (
          <Text size="xs" c="dimmed" className="num">
            {t('accounts.limit', {
              amount: formatMoney(account.creditLimit, account.currency ?? baseCurrency),
            })}
          </Text>
        ) : null}
      </div>
      <Text className={`num ${classes.right}`} c="dimmed">
        {foreign && account.balanceInBase != null ? formatMoney(account.balanceInBase, baseCurrency) : ''}
      </Text>
      <div>
        {link && difference !== 0 ? (
          <Stack gap={2} align="flex-start">
            <Badge color="yellow" variant="light" leftSection={<TriangleAlert size={12} />} className="num">
              {formatMoney(difference, link.currency ?? baseCurrency, { signed: true })}
            </Badge>
            <Text size="xs" c="dimmed">
              {t(difference > 0 ? 'accounts.missingIncome' : 'accounts.missingExpenses')}
            </Text>
          </Stack>
        ) : link ? (
          <Group gap={6} wrap="nowrap">
            <CircleCheck size={14} color="var(--ww-income)" />
            <Text size="sm" c="dimmed">
              {link.syncedUntil
                ? t('accounts.syncedUntil', {
                    date: formatDateTime(link.syncedUntil),
                  })
                : t('accounts.synced')}
            </Text>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            {account.archived ? t('accounts.archived') : t('accounts.manual')}
          </Text>
        )}
      </div>
      <Menu position="bottom-end" width={220} shadow="md">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label={t('accounts.actions')}>
            <EllipsisVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<Pencil size={14} />} onClick={onEdit}>
            {t('accounts.menu.edit')}
          </Menu.Item>
          {onPositions && (
            <Menu.Item leftSection={<TrendingUp size={14} />} onClick={onPositions}>
              {t('accounts.menu.positions')}
            </Menu.Item>
          )}
          <Menu.Item leftSection={<ArrowLeftRight size={14} />} onClick={onTransactions}>
            {t('accounts.menu.transactions')}
          </Menu.Item>
          <Menu.Item leftSection={<Plus size={14} />} onClick={onNewTransaction}>
            {t('accounts.menu.newTransaction')}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            leftSection={account.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            onClick={onArchive}
          >
            {t(account.archived ? 'accounts.menu.unarchive' : 'accounts.menu.archive')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
