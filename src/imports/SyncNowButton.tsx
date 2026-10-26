import { Button, type ButtonProps } from '@mantine/core';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Connection } from './api';
import { useSyncNow } from './sync';

/** Asks Monobank for the operations now; counts down the minute the bank wants between requests. */
export function SyncNowButton({ connection, ...props }: ButtonProps & { connection?: Connection | null }) {
  const { t } = useTranslation();
  const { sync, pending, inProgress, waitSeconds } = useSyncNow(connection);
  return (
    <Button
      variant="default"
      size="xs"
      leftSection={<RefreshCw size={14} />}
      loading={pending || inProgress}
      disabled={waitSeconds > 0}
      onClick={sync}
      {...props}
    >
      {inProgress
        ? t('imports.monobank.syncing')
        : waitSeconds > 0
          ? t('imports.monobank.syncIn', { seconds: waitSeconds })
          : t('imports.monobank.syncNow')}
    </Button>
  );
}
