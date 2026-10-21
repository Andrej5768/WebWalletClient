import { Button, Group, Modal, Radio, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { fieldErrors, toProblem } from '../../api/errors';
import { check, unwrap } from '../../api/http';
import { invalidateLedger } from '../../api/queries';
import { confirmDelete } from '../../components/confirm';
import { ProblemAlert } from '../../components/feedback';
import { MoneyInput } from '../../components/MoneyInput';
import { currencyOptions } from '../../lib/currencies';
import { formatDay } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import type { Instrument, InstrumentRequest } from '../api';

const TYPES: InstrumentRequest['type'][] = ['GOVERNMENT_BOND', 'BOND', 'STOCK', 'ETF', 'FUND', 'OTHER'];
const FREQUENCIES = [1, 2, 4, 12];
const FIELDS = [
  'symbol',
  'name',
  'type',
  'currency',
  'isin',
  'valuation',
  'nominal',
  'couponRate',
  'couponFrequency',
  'maturityDate',
  'manualPrice',
  'manualPriceDate',
];

interface Values {
  name: string;
  symbol: string;
  isin: string;
  type: InstrumentRequest['type'];
  currency: string | null;
  nominal: number | string;
  couponRate: number | string;
  couponFrequency: string;
  maturityDate: string | null;
  valuation: 'NOMINAL' | 'MANUAL';
  manualPrice: number | string;
  manualPriceDate: string | null;
}

const optional = (value: number | string) => (value === '' ? undefined : Number(value));

/**
 * An instrument entered by hand (a government bond, a deposit certificate, another asset), valued by the nominal
 * plus the accrued coupon or by a price entered by hand.
 */
export function InstrumentModal({
  instrument,
  onClose,
  onSaved,
}: {
  instrument: Instrument | null;
  onClose(): void;
  onSaved?(instrument: Instrument): void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    initialValues: {
      name: instrument?.name ?? '',
      symbol: instrument?.symbol ?? '',
      isin: instrument?.isin ?? '',
      type: instrument?.type ?? 'GOVERNMENT_BOND',
      currency: instrument?.currency ?? 'UAH',
      nominal: instrument?.nominal ?? 1000,
      couponRate: instrument?.couponRate ?? '',
      couponFrequency: String(instrument?.couponFrequency ?? 2),
      maturityDate: instrument?.maturityDate ?? null,
      valuation: instrument?.valuation === 'MANUAL' ? 'MANUAL' : 'NOMINAL',
      manualPrice: instrument?.valuation === 'MANUAL' ? (instrument.price ?? '') : '',
      manualPriceDate: instrument?.valuation === 'MANUAL' ? (instrument.priceDate ?? null) : null,
    },
    validate: {
      name: (value) => (value.trim() ? null : t('validation.required')),
      symbol: (value) => (value.trim() ? null : t('validation.required')),
      nominal: (value, values) =>
        values.valuation === 'NOMINAL' && !(Number(value) > 0) ? t('validation.required') : null,
      manualPrice: (value, values) =>
        values.valuation === 'MANUAL' && !(Number(value) > 0) ? t('validation.required') : null,
    },
  });
  const values = form.values;

  const save = useMutation({
    mutationFn: (input: Values) => {
      const body: InstrumentRequest = {
        name: input.name.trim(),
        symbol: input.symbol.trim(),
        isin: input.isin.trim() || undefined,
        type: input.type,
        currency: input.currency ?? 'UAH',
        valuation: input.valuation,
        nominal: optional(input.nominal),
        couponRate: optional(input.couponRate),
        couponFrequency: input.couponRate === '' ? undefined : Number(input.couponFrequency),
        maturityDate: input.maturityDate ?? undefined,
        manualPrice: input.valuation === 'MANUAL' ? optional(input.manualPrice) : undefined,
        manualPriceDate: input.valuation === 'MANUAL' ? (input.manualPriceDate ?? undefined) : undefined,
      };
      return unwrap(
        instrument
          ? api.PUT('/api/v1/investments/instruments/{id}', { params: { path: { id: instrument.id } }, body })
          : api.POST('/api/v1/investments/instruments', { body }),
      );
    },
    onSuccess: async (saved) => {
      // The price of an instrument values the investment accounts, so balances, reports and taxes change too
      await invalidateLedger(queryClient);
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => form.setErrors(fieldErrors(toProblem(error))),
  });
  const remove = useMutation({
    mutationFn: () =>
      check(api.DELETE('/api/v1/investments/instruments/{id}', { params: { path: { id: instrument!.id } } })),
    onSuccess: async () => {
      await invalidateLedger(queryClient);
      onClose();
    },
    meta: { errorShown: true },
  });

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      title={
        <Text fw={600}>
          {t(instrument ? 'invInstrument.manual.editTitle' : 'invInstrument.manual.newTitle')}
        </Text>
      }
    >
      <form onSubmit={form.onSubmit((input) => save.mutate(input))} noValidate>
        <Stack gap="md">
          <TextInput label={t('invInstrument.manual.name')} data-autofocus {...form.getInputProps('name')} />
          <SimpleGrid cols={2}>
            <TextInput label={t('invInstrument.manual.symbol')} {...form.getInputProps('symbol')} />
            <TextInput label="ISIN" placeholder="UA4000227045" {...form.getInputProps('isin')} />
            <Select
              label={t('invInstrument.manual.type')}
              allowDeselect={false}
              data={TYPES.map((type) => ({ value: type, label: t(`investments.types.${type}`) }))}
              {...form.getInputProps('type')}
            />
            <Select
              label={t('invInstrument.manual.currency')}
              searchable
              allowDeselect={false}
              data={currencyOptions(values.currency ?? undefined)}
              {...form.getInputProps('currency')}
            />
            <MoneyInput
              label={t('invInstrument.manual.nominal')}
              currency={values.currency ?? undefined}
              {...form.getInputProps('nominal')}
            />
            <MoneyInput
              label={t('invInstrument.manual.couponRate')}
              rightSection={<Text size="xs">%</Text>}
              {...form.getInputProps('couponRate')}
            />
            <Select
              label={t('invInstrument.manual.frequency')}
              allowDeselect={false}
              data={FREQUENCIES.map((value) => ({
                value: String(value),
                label: t(`invInstrument.manual.frequencies.${value}`),
              }))}
              {...form.getInputProps('couponFrequency')}
            />
            <DateInput
              label={t('invInstrument.manual.maturity')}
              valueFormat="DD.MM.YYYY"
              clearable
              {...form.getInputProps('maturityDate')}
            />
          </SimpleGrid>
          <Radio.Group
            label={t('invInstrument.manual.valuation')}
            value={values.valuation}
            onChange={(value) => form.setFieldValue('valuation', value as Values['valuation'])}
          >
            <Stack gap={6} mt={4}>
              <Radio value="NOMINAL" label={t('invInstrument.manual.byNominal')} />
              <Radio value="MANUAL" label={t('invInstrument.manual.byHand')} />
            </Stack>
          </Radio.Group>
          {values.valuation === 'NOMINAL' &&
            instrument?.valuation === 'NOMINAL' &&
            instrument.price != null && (
              <Text size="sm" c="dimmed">
                {t('invInstrument.manual.nominalPrice', {
                  price: formatMoney(instrument.price, instrument.currency),
                  date: formatDay(instrument.priceDate),
                })}
              </Text>
            )}
          {values.valuation === 'MANUAL' && (
            <SimpleGrid cols={2}>
              <MoneyInput
                label={t('invInstrument.manual.price')}
                description={t('invInstrument.manual.priceHint')}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                currency={values.currency ?? undefined}
                {...form.getInputProps('manualPrice')}
              />
              <DateInput
                label={t('invInstrument.manual.priceDate')}
                valueFormat="DD.MM.YYYY"
                {...form.getInputProps('manualPriceDate')}
              />
            </SimpleGrid>
          )}
          <ProblemAlert error={save.error ?? remove.error} fieldsShown={FIELDS} />
          <Group justify="space-between" pt="xs">
            {instrument ? (
              <Button
                variant="outline"
                color="red"
                loading={remove.isPending}
                onClick={() =>
                  confirmDelete({
                    title: t('invInstrument.manual.deleteTitle', { name: instrument.name }),
                    onConfirm: () => remove.mutate(),
                  })
                }
              >
                {t('common.delete')}
              </Button>
            ) : (
              <span />
            )}
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t('common.save')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
