import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  PasswordInput,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { DateInput, TimeInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CircleCheck, Landmark, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, problemMessage, toProblem } from '../api/errors';
import { queryKeys, useAccounts, useMonobankStatus } from '../api/queries';
import { locale } from '../i18n';
import { formatMoney } from '../lib/money';
import type { Connection, Schedule, SyncMode } from './api';

const MODES: SyncMode[] = ['INTERVAL', 'DAILY', 'WEBHOOK'];
const DEFAULT_SCHEDULE = {
  syncMode: 'INTERVAL' as SyncMode,
  windowStart: '08:00',
  windowEnd: '23:00',
  dailyAt: '06:00',
};

const hhmm = (value?: string) => (value ? value.slice(0, 5) : undefined);

function scheduleOf(connection?: Connection | null) {
  return {
    syncMode: connection?.syncMode ?? DEFAULT_SCHEDULE.syncMode,
    windowStart: hhmm(connection?.windowStart) ?? DEFAULT_SCHEDULE.windowStart,
    windowEnd: hhmm(connection?.windowEnd) ?? DEFAULT_SCHEDULE.windowEnd,
    dailyAt: hhmm(connection?.dailyAt) ?? DEFAULT_SCHEDULE.dailyAt,
  };
}

/** Choice of how often Monobank is synchronized, with the matching time fields. */
function ScheduleFields({
  value,
  onChange,
  errors,
}: {
  value: Required<Schedule>;
  onChange: (value: Required<Schedule>) => void;
  errors?: Record<string, string>;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <SegmentedControl
        aria-label={t('imports.monobank.schedule')}
        value={value.syncMode}
        onChange={(syncMode) => onChange({ ...value, syncMode: syncMode as SyncMode })}
        data={MODES.map((mode) => ({ value: mode, label: t(`imports.monobank.modes.${mode}`) }))}
      />
      {value.syncMode === 'INTERVAL' && (
        <Group gap="sm" align="flex-start">
          <TimeInput
            label={t('imports.monobank.from')}
            w={120}
            value={value.windowStart}
            onChange={(event) => onChange({ ...value, windowStart: event.currentTarget.value })}
            error={errors?.windowStart}
          />
          <TimeInput
            label={t('imports.monobank.to')}
            w={120}
            value={value.windowEnd}
            onChange={(event) => onChange({ ...value, windowEnd: event.currentTarget.value })}
            error={errors?.windowEnd}
          />
          <Text size="xs" c="dimmed" mt={30} maw={260}>
            {t('imports.monobank.intervalHint')}
          </Text>
        </Group>
      )}
      {value.syncMode === 'DAILY' && (
        <TimeInput
          label={t('imports.monobank.dailyAt')}
          w={120}
          value={value.dailyAt}
          onChange={(event) => onChange({ ...value, dailyAt: event.currentTarget.value })}
          error={errors?.dailyAt}
        />
      )}
      {value.syncMode === 'WEBHOOK' && (
        <Alert color="yellow" variant="light" p="xs" icon={<TriangleAlert size={16} />}>
          <Text size="sm">{t('imports.monobank.webhookHint')}</Text>
        </Alert>
      )}
      {errors?.syncMode && (
        <Text size="xs" c="red">
          {errors.syncMode}
        </Text>
      )}
    </Stack>
  );
}

export function ConnectModal({ current, onClose }: { current?: Connection | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<Required<Schedule>>(scheduleOf(current));
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  const earliest = dayjs().subtract(3, 'year').add(1, 'day').format('YYYY-MM-DD');
  const form = useForm({
    initialValues: { token: '', since: dayjs().subtract(1, 'year').format('YYYY-MM-DD') as string | null },
    validate: { token: (value) => (value.trim() ? null : t('validation.required')) },
  });

  const connect = useMutation({
    // The token is read from the form, not passed as a variable, so it does not stay in the mutation cache.
    mutationFn: async () => {
      const { token, since } = form.values;
      const { error } = await api.POST('/api/v1/banks/monobank', {
        body: { token: token.trim(), since: since ?? undefined, ...schedule },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.monobank }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      form.reset();
      onClose();
    },
    onError: (error) => {
      const errors = fieldErrors(toProblem(error));
      form.setErrors(errors);
      setScheduleErrors(errors);
    },
  });

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      title={<Text fw={600}>{t('imports.monobank.connectTitle')}</Text>}
    >
      <form onSubmit={form.onSubmit(() => connect.mutate())} noValidate>
        <Stack gap="md">
          <PasswordInput
            label={t('imports.monobank.token')}
            autoComplete="off"
            data-autofocus
            description={
              <>
                {t('imports.monobank.tokenHint')}{' '}
                <Anchor href="https://api.monobank.ua/" target="_blank" rel="noreferrer" size="xs">
                  api.monobank.ua
                </Anchor>
              </>
            }
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            {...form.getInputProps('token')}
          />
          <DateInput
            label={t('imports.monobank.since')}
            description={t('imports.monobank.sinceHint')}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            valueFormat="DD.MM.YYYY"
            minDate={earliest}
            maxDate={dayjs().format('YYYY-MM-DD')}
            w={220}
            {...form.getInputProps('since')}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t('imports.monobank.schedule')}
            </Text>
            <ScheduleFields value={schedule} onChange={setSchedule} errors={scheduleErrors} />
          </Stack>
          <Alert color="blue" variant="light" p="xs">
            <Text size="sm">{t('imports.monobank.background')}</Text>
          </Alert>
          {connect.error && !Object.keys(fieldErrors(toProblem(connect.error))).length && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              {problemMessage(toProblem(connect.error))}
            </Alert>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={connect.isPending}>
              {t('imports.monobank.connect')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function MonobankSection({
  connectOpen,
  setConnectOpen,
}: {
  connectOpen: boolean;
  setConnectOpen: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const status = useMonobankStatus();
  const accounts = useAccounts();
  const [disconnecting, setDisconnecting] = useState(false);
  const connection = status.data;
  const [schedule, setSchedule] = useState<Required<Schedule> | null>(null);
  const shown = schedule ?? scheduleOf(connection);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.monobank }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
    ]);

  const saveSchedule = useMutation({
    mutationFn: async (body: Required<Schedule>) => {
      const { error } = await api.PUT('/api/v1/banks/monobank/schedule', { body });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSchedule(null);
      await refresh();
    },
  });

  const relink = useMutation({
    mutationFn: async ({ linkId, accountId }: { linkId: number; accountId: number | null }) => {
      const { error } = await api.PUT('/api/v1/banks/monobank/accounts/{linkId}', {
        params: { path: { linkId } },
        body: { accountId: accountId as number },
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/api/v1/banks/monobank');
      if (error) throw error;
    },
    onSuccess: async () => {
      setDisconnecting(false);
      await refresh();
    },
  });

  const dateTime = (value?: string) =>
    value
      ? new Date(value).toLocaleString(locale(i18n.language), {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
  const scheduleError = saveSchedule.error ? toProblem(saveSchedule.error) : null;

  return (
    <Card withBorder radius="md" padding="lg" id="monobank">
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon variant="light" color="gray" size={36} radius="md">
            <Landmark size={18} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={2} size="h4">
              Monobank
            </Title>
            {connection && (
              <Text size="xs" c="dimmed">
                {connection.clientName} ·{' '}
                {t('imports.monobank.connectedAt', { date: dateTime(connection.connectedAt) })}
              </Text>
            )}
          </Stack>
        </Group>
        {connection && (
          <Group gap="xs">
            <Button variant="default" size="xs" onClick={() => setConnectOpen(true)}>
              {t('imports.monobank.changeToken')}
            </Button>
            <Button variant="outline" color="red" size="xs" onClick={() => setDisconnecting(true)}>
              {t('imports.monobank.disconnect')}
            </Button>
          </Group>
        )}
      </Group>

      {status.isLoading ? (
        <Skeleton height={120} />
      ) : !connection ? (
        <Stack gap="sm" align="flex-start">
          <Text size="sm" c="dimmed">
            {t('imports.monobank.intro')}
          </Text>
          <Button onClick={() => setConnectOpen(true)}>{t('imports.monobank.connect')}</Button>
        </Stack>
      ) : (
        <Stack gap="md">
          {connection.lastError && (
            <Alert color="yellow" variant="light" icon={<TriangleAlert size={16} />} p="xs">
              <Text size="sm">{connection.lastError}</Text>
            </Alert>
          )}
          <Card withBorder radius="md" padding="md" bg="var(--ww-bg)">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  {t('imports.monobank.schedule')}
                </Text>
                <ScheduleFields
                  value={shown}
                  onChange={setSchedule}
                  errors={scheduleError ? fieldErrors(scheduleError) : undefined}
                />
              </Stack>
              <Stack gap={6} align="flex-end">
                <Badge variant="light" color="gray" leftSection={<RefreshCw size={12} />}>
                  {t('imports.monobank.nextSync', { date: dateTime(connection.nextSyncAt) })}
                </Badge>
                {schedule && (
                  <Group gap="xs">
                    <Button size="xs" variant="default" onClick={() => setSchedule(null)}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="xs"
                      loading={saveSchedule.isPending}
                      onClick={() => saveSchedule.mutate(shown)}
                    >
                      {t('imports.monobank.saveSchedule')}
                    </Button>
                  </Group>
                )}
              </Stack>
            </Group>
            {scheduleError && !scheduleError.errors?.length && (
              <Text size="xs" c="red" mt="xs">
                {problemMessage(scheduleError)}
              </Text>
            )}
          </Card>

          <div style={{ overflowX: 'auto' }}>
            <Table verticalSpacing="sm" miw={860}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('imports.monobank.columns.card')}</Table.Th>
                  <Table.Th>{t('imports.monobank.columns.account')}</Table.Th>
                  <Table.Th ta="right">{t('imports.monobank.columns.ours')}</Table.Th>
                  <Table.Th ta="right">{t('imports.monobank.columns.bank')}</Table.Th>
                  <Table.Th>{t('imports.monobank.columns.status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(connection.accounts ?? []).map((link) => {
                  const difference = link.difference ?? 0;
                  const options = (accounts.data ?? [])
                    .filter((account) => !account.archived && account.currency === link.currency)
                    .map((account) => ({ value: String(account.id), label: account.name ?? '' }));
                  return (
                    <Table.Tr key={link.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {link.title}
                        </Text>
                        <Badge variant="default" radius="sm" ff="monospace" size="sm">
                          {link.currency}
                        </Badge>
                      </Table.Td>
                      <Table.Td w={240}>
                        <Select
                          size="xs"
                          aria-label={t('imports.monobank.linkOf', { name: link.title })}
                          allowDeselect={false}
                          searchable
                          data={[{ value: 'none', label: t('imports.monobank.notSynced') }, ...options]}
                          value={link.accountId != null ? String(link.accountId) : 'none'}
                          onChange={(value) =>
                            relink.mutate({
                              linkId: link.id!,
                              accountId: value === 'none' || !value ? null : Number(value),
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td ta="right" className="num">
                        {link.balance != null ? formatMoney(link.balance, link.currency ?? 'UAH') : '—'}
                      </Table.Td>
                      <Table.Td ta="right" className="num">
                        {link.bankBalance != null
                          ? formatMoney(link.bankBalance, link.currency ?? 'UAH')
                          : '—'}
                      </Table.Td>
                      <Table.Td>
                        {link.accountId == null ? (
                          <Text size="sm" c="dimmed">
                            {t('imports.monobank.notSynced')}
                          </Text>
                        ) : difference !== 0 ? (
                          <Stack gap={2}>
                            <Badge
                              color="yellow"
                              variant="light"
                              className="num"
                              leftSection={<TriangleAlert size={12} />}
                            >
                              {formatMoney(difference, link.currency ?? 'UAH', { signed: true })}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {t(
                                difference > 0
                                  ? 'imports.monobank.missingIncome'
                                  : 'imports.monobank.missingExpenses',
                              )}
                            </Text>
                          </Stack>
                        ) : (
                          <Group gap={6} wrap="nowrap">
                            <CircleCheck size={14} color="var(--ww-income)" />
                            <Text size="sm" c="dimmed">
                              {link.syncedUntil
                                ? t('imports.monobank.syncedUntil', { date: dateTime(link.syncedUntil) })
                                : t('imports.monobank.loading')}
                            </Text>
                          </Group>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
        </Stack>
      )}

      {connectOpen && <ConnectModal current={connection} onClose={() => setConnectOpen(false)} />}
      <Modal
        opened={disconnecting}
        onClose={() => setDisconnecting(false)}
        title={<Text fw={600}>{t('imports.monobank.disconnectTitle')}</Text>}
      >
        <Stack gap="md">
          <Text size="sm">{t('imports.monobank.disconnectText')}</Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setDisconnecting(false)}>
              {t('common.cancel')}
            </Button>
            <Button color="red" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
              {t('imports.monobank.disconnect')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
