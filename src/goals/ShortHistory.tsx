import { Alert } from '@mantine/core';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FEW_MONTHS } from './useAverages';

/** Says that the averages rest on a few months only, so the estimates are rough. */
export function ShortHistory({ months }: { months: number }) {
  const { t } = useTranslation();
  if (months <= 0 || months >= FEW_MONTHS) return null;
  return (
    <Alert color="yellow" variant="light" p="xs" icon={<Info size={16} />}>
      {t('goals.shortHistory', { count: months })}
    </Alert>
  );
}
