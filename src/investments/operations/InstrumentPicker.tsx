import { Anchor, Badge, Group, Loader, Paper, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useMutation } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { unwrap } from '../../api/http';
import { useInstrumentSearch, type Instrument, type SearchResult } from '../api';
import classes from './operations.module.css';

/**
 * Finds an instrument by ticker, name or ISIN. A market instrument found at the provider is added before it is
 * chosen; `onManual` opens the editor of one entered by hand.
 */
export function InstrumentPicker({
  held,
  error,
  onPick,
  onManual,
}: {
  /** Units held per instrument id, shown next to the results. */
  held: Map<number, number>;
  error?: string;
  onPick(instrument: { id: number; currency: string }): void;
  onManual(): void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debounced] = useDebouncedValue(query, 300);
  const search = useInstrumentSearch(debounced);
  const add = useMutation({
    mutationFn: (result: SearchResult) =>
      unwrap(
        api.POST('/api/v1/investments/instruments/market', {
          body: { symbol: result.symbol, micCode: result.micCode ?? undefined },
        }),
      ),
    onSuccess: (instrument: Instrument) => onPick({ id: instrument.id, currency: instrument.currency }),
  });

  const pick = (result: SearchResult) =>
    result.id != null ? onPick({ id: result.id, currency: result.currency }) : add.mutate(result);

  return (
    <Stack gap={6}>
      <TextInput
        label={t('invOperations.instrument')}
        placeholder={t('invOperations.searchPlaceholder')}
        leftSection={<Search size={16} />}
        rightSection={search.isFetching || add.isPending ? <Loader size="xs" /> : undefined}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        error={error ?? (add.error ? t('invOperations.addFailed') : undefined)}
      />
      {search.data && (
        <Paper withBorder radius="md" p={4}>
          {search.data.results.length === 0 && (
            <Text size="sm" c="dimmed" p="xs">
              {t('invOperations.nothingFound')}
            </Text>
          )}
          {search.data.results.map((result) => (
            <UnstyledButton
              key={`${result.symbol}-${result.micCode ?? ''}`}
              className={classes.result}
              onClick={() => pick(result)}
            >
              <span className={classes.ticker}>{result.symbol}</span>
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {result.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {[result.exchange, result.currency, t(`investments.types.${result.type}`)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </div>
              {result.id != null && held.get(result.id) ? (
                <Badge size="sm" variant="light" style={{ textTransform: 'none' }}>
                  {t('invOperations.held', { count: held.get(result.id) })}
                </Badge>
              ) : (
                <span />
              )}
            </UnstyledButton>
          ))}
          {!search.data.providerEnabled && (
            <Text size="xs" c="dimmed" p="xs">
              {t('invOperations.providerDisabled')}
            </Text>
          )}
        </Paper>
      )}
      <Group gap={6}>
        <Anchor component="button" type="button" size="sm" onClick={onManual}>
          {t('invOperations.addManual')}
        </Anchor>
      </Group>
    </Stack>
  );
}
