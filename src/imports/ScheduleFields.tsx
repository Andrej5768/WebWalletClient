import { Alert, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Schedule, SyncMode } from './api';

const MODES: SyncMode[] = ['INTERVAL', 'DAILY', 'WEBHOOK'];
/** Choice of how often Monobank is synchronized, with the matching time fields. */
export function ScheduleFields({
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
