import { Alert, Anchor, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, toProblem } from '../api/errors';
import { check } from '../api/http';
import { invalidateLedger } from '../api/queries';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { kyivToday } from '../lib/periods';
import type { Connection, Schedule } from './api';
import { scheduleOf } from './schedule';
import { ScheduleFields } from './ScheduleFields';

/** Connects Monobank with a personal token, or replaces the token, with the sync schedule. */
export function ConnectModal({ current, onClose }: { current?: Connection | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<Required<Schedule>>(scheduleOf(current));
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  // Days as the bank counts them, in Kyiv, whatever the time zone of the browser
  const today = kyivToday();
  const earliest = today.subtract(3, 'year').add(1, 'day').format('YYYY-MM-DD');
  const form = useForm({
    initialValues: { token: '', since: today.subtract(1, 'year').format('YYYY-MM-DD') as string | null },
    validate: { token: (value) => (value.trim() ? null : t('validation.required')) },
  });

  const connect = useMutation({
    // The token is read from the form, not passed as a variable, so it does not stay in the mutation cache.
    mutationFn: () => {
      const { token, since } = form.values;
      return check(
        api.POST('/api/v1/banks/monobank', {
          body: { token: token.trim(), since: since ?? undefined, ...schedule },
        }),
      );
    },
    onSuccess: async () => {
      // Connecting creates accounts and starts loading their history.
      await invalidateLedger(queryClient);
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
            maxDate={today.format('YYYY-MM-DD')}
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
          <ProblemAlert
            error={connect.error}
            fieldsShown={['token', 'since', 'syncMode', 'windowStart', 'windowEnd', 'dailyAt']}
          />
          <FormFooter
            onCancel={onClose}
            saving={connect.isPending}
            submitLabel={t('imports.monobank.connect')}
          />
        </Stack>
      </form>
    </Modal>
  );
}
