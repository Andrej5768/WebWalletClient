import { Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import type { Schedule, SyncMode } from './api';

/** The modes offered; the bank's push mode is not among them any more. */
const MODES: SyncMode[] = ['INTERVAL', 'DAILY', 'MANUAL'];
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
      {value.syncMode === 'MANUAL' && (
        <Text size="xs" c="dimmed" maw={360}>
          {t('imports.monobank.manualHint')}
        </Text>
      )}
      {errors?.syncMode && (
        <Text size="xs" c="red">
          {errors.syncMode}
        </Text>
      )}
    </Stack>
  );
}
