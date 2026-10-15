import { Alert, Button, Group, Text } from '@mantine/core';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { problemMessage, toProblem } from '../api/errors';

/** Shows why a query failed, with a retry; renders nothing while the query is fine. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <Alert color="red" variant="light" icon={<CircleAlert size={18} />} role="alert">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm">{problemMessage(toProblem(error))}</Text>
        {onRetry && (
          <Button size="xs" variant="default" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )}
      </Group>
    </Alert>
  );
}

/**
 * Shows the problem of a failed mutation. With `fieldsShown`, problems whose field errors the form
 * already displays are skipped; any other problem is shown.
 */
export function ProblemAlert({ error, fieldsShown = [] }: { error: unknown; fieldsShown?: string[] }) {
  if (!error) return null;
  const problem = toProblem(error);
  const fields = problem.errors ?? [];
  if (fields.length > 0 && fields.every((item) => fieldsShown.includes(baseField(item.field)))) return null;
  return (
    <Alert color="yellow" variant="light" p="xs" role="alert" icon={<TriangleAlert size={16} />}>
      <Text size="sm">
        {fields.length
          ? fields
              .filter((item) => !fieldsShown.includes(baseField(item.field)))
              .map((item) => item.message)
              .join(' ')
          : problemMessage(problem)}
      </Text>
    </Alert>
  );
}

/** "splits[1].amount" → "splits": the form decides by the top-level field it renders. */
function baseField(field: string): string {
  return field.split(/[.[]/)[0] ?? field;
}

/** Shows missing exchange rates of a report or the budget. */
export function UnconvertedAlert({ currencies }: { currencies?: string[] | null }) {
  const { t } = useTranslation();
  if (!currencies?.length) return null;
  return (
    <Alert color="yellow" variant="light" icon={<TriangleAlert size={18} />}>
      {t('budget.unconverted', { currencies: currencies.join(', ') })}
    </Alert>
  );
}
