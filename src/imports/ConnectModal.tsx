import {
  Alert,
  Anchor,
  Button,
  Group,
  Image,
  Loader,
  Modal,
  PasswordInput,
  Stack,
  Text,
} from '@mantine/core';
import { DayInput } from '../components/DayInput';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, toProblem } from '../api/errors';
import { check, unwrap } from '../api/http';
import { invalidateLedger } from '../api/queries';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { kyivToday } from '../lib/periods';
import type { Connection, ProviderAuth, Schedule } from './api';
import { scheduleOf } from './schedule';
import { ScheduleFields } from './ScheduleFields';

/** How often the app asks whether the access was approved in the bank app. */
const POLL_MS = 3000;

/**
 * Connects Monobank, or reconnects it, with the sync schedule: through the bank app when the server is a registered
 * service provider (the user approves the access there, by a QR code or a link), otherwise, or on request, with a
 * personal token.
 */
export function ConnectModal({ current, onClose }: { current?: Connection | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ['app', 'config'],
    queryFn: () => unwrap(api.GET('/api/v1/app/config')),
    staleTime: 5 * 60_000,
  });
  const providerAvailable = config.data?.features.monobankProvider ?? false;
  const [manual, setManual] = useState(false);
  const [auth, setAuth] = useState<ProviderAuth | null>(null);
  const [schedule, setSchedule] = useState<Required<Schedule>>(scheduleOf(current));
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  // Days as the bank counts them, in Kyiv, whatever the time zone of the browser
  const today = kyivToday();
  const earliest = today.subtract(3, 'year').add(1, 'day').format('YYYY-MM-DD');
  const viaApp = providerAvailable && !manual;
  const form = useForm({
    initialValues: { token: '', since: today.subtract(1, 'year').format('YYYY-MM-DD') as string | null },
    validate: { token: (value) => (viaApp || value.trim() ? null : t('validation.required')) },
  });

  const connected = async () => {
    // Connecting creates accounts and starts loading their history.
    await invalidateLedger(queryClient);
    form.reset();
    onClose();
  };
  const showErrors = (error: unknown) => {
    const errors = fieldErrors(toProblem(error));
    form.setErrors(errors);
    setScheduleErrors(errors);
  };

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
    onSuccess: connected,
    onError: showErrors,
  });

  const start = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/api/v1/banks/monobank/auth', {
          body: { since: form.values.since ?? undefined, ...schedule },
        }),
      ),
    onSuccess: setAuth,
    onError: showErrors,
  });

  const pending = viaApp ? start : connect;

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      title={<Text fw={600}>{t('imports.monobank.connectTitle')}</Text>}
    >
      {auth ? (
        <Approval auth={auth} onApproved={connected} onRetry={() => setAuth(null)} />
      ) : (
        <form onSubmit={form.onSubmit(() => pending.mutate())} noValidate>
          <Stack gap="md">
            {viaApp ? (
              <Text size="sm">{t('imports.monobank.provider.hint')}</Text>
            ) : (
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
            )}
            <DayInput
              label={t('imports.monobank.since')}
              description={t('imports.monobank.sinceHint')}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
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
              error={pending.error}
              fieldsShown={['token', 'since', 'syncMode', 'windowStart', 'windowEnd', 'dailyAt']}
            />
            {providerAvailable && (
              <Anchor component="button" type="button" size="sm" onClick={() => setManual(!manual)}>
                {manual ? t('imports.monobank.provider.useApp') : t('imports.monobank.provider.useToken')}
              </Anchor>
            )}
            <FormFooter
              onCancel={onClose}
              saving={pending.isPending}
              submitLabel={viaApp ? t('imports.monobank.provider.connect') : t('imports.monobank.connect')}
            />
          </Stack>
        </form>
      )}
    </Modal>
  );
}

/**
 * The QR code and the link that open the bank app to approve the access; asks the server every few seconds until
 * the access is approved or the request expires.
 */
function Approval({
  auth,
  onApproved,
  onRetry,
}: {
  auth: ProviderAuth;
  onApproved: () => Promise<void>;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const [qr, setQr] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ['banks', 'monobank', 'auth', auth.id],
    queryFn: () => unwrap(api.GET('/api/v1/banks/monobank/auth/{id}', { params: { path: { id: auth.id } } })),
    initialData: auth,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? POLL_MS : false),
    gcTime: 0,
  });
  const state = status.data.status;

  useEffect(() => {
    // SVG needs no canvas and fits the content security policy as a data: image
    void QRCode.toString(auth.acceptUrl, { type: 'svg', margin: 1 }).then((svg) =>
      setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`),
    );
  }, [auth.acceptUrl]);

  useEffect(() => {
    if (state === 'APPROVED') void onApproved();
    // Once: the callback changes with every render of the dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state === 'EXPIRED') {
    return (
      <Stack gap="md">
        <Alert color="orange" variant="light">
          {t('imports.monobank.provider.expired')}
        </Alert>
        <Group justify="flex-end">
          <Button onClick={onRetry}>{t('imports.monobank.provider.retry')}</Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="md" align="center">
      <Text size="sm" ta="center">
        {t('imports.monobank.provider.scan')}
      </Text>
      {qr && <Image src={qr} alt={t('imports.monobank.provider.qr')} w={220} h={220} visibleFrom="sm" />}
      <Button component="a" href={auth.acceptUrl} target="_blank" rel="noreferrer" variant="light">
        {t('imports.monobank.provider.openApp')}
      </Button>
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">
          {t('imports.monobank.provider.waiting')}
        </Text>
      </Group>
    </Stack>
  );
}
