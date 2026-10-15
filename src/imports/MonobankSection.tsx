import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Landmark, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, problemMessage, toProblem } from '../api/errors';
import { check } from '../api/http';
import { invalidateLedger, queryKeys, useAccounts, useMonobankStatus } from '../api/queries';
import { formatDateTime } from '../lib/format';
import { formatMoney } from '../lib/money';
import type { Schedule } from './api';
import { ConnectModal } from './ConnectModal';
import { scheduleOf } from './schedule';
import { ScheduleFields } from './ScheduleFields';

export function MonobankSection({
  connectOpen,
  setConnectOpen,
}: {
  connectOpen: boolean;
  setConnectOpen: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const status = useMonobankStatus();
  const accounts = useAccounts();
  const [disconnecting, setDisconnecting] = useState(false);
  const connection = status.data;
  const [schedule, setSchedule] = useState<Required<Schedule> | null>(null);
  const shown = schedule ?? scheduleOf(connection);

  // Linking, unlinking and disconnecting change which transactions arrive and the balances.
  const refresh = () => invalidateLedger(queryClient);

  const saveSchedule = useMutation({
    mutationFn: (body: Required<Schedule>) => check(api.PUT('/api/v1/banks/monobank/schedule', { body })),
    onSuccess: async () => {
      setSchedule(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.monobank });
    },
    meta: { errorShown: true },
  });

  const relink = useMutation({
    mutationFn: ({ linkId, accountId }: { linkId: number; accountId: number | null }) =>
      check(
        api.PUT('/api/v1/banks/monobank/accounts/{linkId}', {
          params: { path: { linkId } },
          body: { accountId },
        }),
      ),
    onSettled: refresh,
  });

  const disconnect = useMutation({
    mutationFn: () => check(api.DELETE('/api/v1/banks/monobank')),
    onSuccess: async () => {
      setDisconnecting(false);
      await refresh();
    },
  });

  const dateTime = (value?: string | null) => formatDateTime(value) || '—';
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
                {connection.accounts.map((link) => {
                  const difference = link.difference ?? 0;
                  const options = (accounts.data ?? [])
                    .filter((account) => !account.archived && account.currency === link.currency)
                    .map((account) => ({ value: String(account.id), label: account.name }));
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
                              linkId: link.id,
                              accountId: value === 'none' || !value ? null : Number(value),
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td ta="right" className="num">
                        {link.balance != null ? formatMoney(link.balance, link.currency) : '—'}
                      </Table.Td>
                      <Table.Td ta="right" className="num">
                        {link.bankBalance != null ? formatMoney(link.bankBalance, link.currency) : '—'}
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
                              {formatMoney(difference, link.currency, { signed: true })}
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
