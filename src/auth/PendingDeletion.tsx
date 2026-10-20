import { Alert, Button, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import dayjs from 'dayjs';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { problemMessage, type ApiProblem } from '../api/errors';
import { formatDate } from '../lib/format';
import { useAuth } from './context';

/**
 * Signing in to an account that is to be deleted: the user can cancel the deletion, which also signs in, or leave.
 */
export function PendingDeletion({
  problem,
  onRestored,
  onBack,
}: {
  problem: ApiProblem;
  onRestored(): void;
  onBack(): void;
}) {
  const { t } = useTranslation();
  const { restoreAccount } = useAuth();
  const [failure, setFailure] = useState<ApiProblem | null>(null);
  const [working, setWorking] = useState(false);
  const date = formatDate(dayjs(problem.deletionScheduledAt).format('YYYY-MM-DD'));

  const restore = async () => {
    setWorking(true);
    const result = await restoreAccount(problem.restoreToken ?? '');
    setWorking(false);
    if (result) setFailure(result);
    else onRestored();
  };

  return (
    <Stack gap="lg">
      <ThemeIcon size={40} radius="md" variant="light" color="yellow" aria-hidden>
        <Trash2 size={20} />
      </ThemeIcon>
      <Stack gap="xs">
        <Title order={1} size="h2">
          {t('auth.deletion.title', { date })}
        </Title>
        <Text c="dimmed">{t('auth.deletion.text', { date })}</Text>
      </Stack>
      {failure && (
        <Alert role="alert" color="yellow" variant="light" p="xs">
          <Text size="sm">{problemMessage(failure)}</Text>
        </Alert>
      )}
      <Stack gap="xs">
        <Button size="md" loading={working} onClick={() => void restore()}>
          {t('auth.deletion.restore')}
        </Button>
        <Button size="md" variant="default" onClick={onBack}>
          {t('auth.deletion.leave')}
        </Button>
      </Stack>
    </Stack>
  );
}
