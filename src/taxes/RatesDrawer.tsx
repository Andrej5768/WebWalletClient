import {
  Anchor,
  Center,
  Divider,
  Drawer,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategories } from '../api/queries';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { categorySelectData } from '../lib/categories';
import { formatMoney } from '../lib/money';
import {
  invalidateTaxes,
  saveIncomeCategories,
  saveTaxSettings,
  useTaxSettings,
  type TaxRates,
  type TaxSettings,
  type TaxSettingsRequest,
} from './api';
import { esvMonthly } from './model';

type FopGroup = '1' | '2' | '3' | '3vat';
type NumberField =
  | 'singleTaxRate'
  | 'fopMilitaryRate'
  | 'singleTaxMonthly'
  | 'fopMilitaryMonthly'
  | 'esvRate'
  | 'minWage'
  | 'pdfoRate'
  | 'investmentMilitaryRate';

/** The tax rates of a year and the income categories of the sole proprietor; see the backend for the defaults. */
export function RatesDrawer({ year, onClose }: { year: number; onClose(): void }) {
  const { t } = useTranslation();
  const settings = useTaxSettings(year);
  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size={560}
      title={
        <Stack gap={0}>
          <Text fw={600}>{t('taxes.rates.title', { year })}</Text>
          <Text size="xs" c="dimmed">
            {t('taxes.rates.subtitle')}
          </Text>
        </Stack>
      }
    >
      {settings.data ? (
        <RatesForm year={year} settings={settings.data} onClose={onClose} />
      ) : (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}
    </Drawer>
  );
}

function RatesForm({ year, settings, onClose }: { year: number; settings: TaxSettings; onClose(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const initial = settings.values;
  const defaults = settings.defaults;
  const [values, setValues] = useState<TaxRates>(initial);
  const [incomeCategories, setIncomeCategories] = useState(settings.incomeCategoryIds.map(String));
  const group: FopGroup =
    values.fopGroup === 3 ? (values.fopVat ? '3vat' : '3') : (String(values.fopGroup) as FopGroup);

  const set = <K extends keyof TaxRates>(key: K, value: TaxRates[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      // A value left as the default stays the default, so that a newer default of the year applies
      const own = (key: NumberField) =>
        values[key] === initial[key] && initial[key] === defaults[key] ? undefined : values[key];
      const body: TaxSettingsRequest = {
        fopGroup: values.fopGroup === 3 ? undefined : values.fopGroup,
        fopVat: values.fopVat || undefined,
        singleTaxRate: own('singleTaxRate'),
        fopMilitaryRate: own('fopMilitaryRate'),
        singleTaxMonthly: own('singleTaxMonthly'),
        fopMilitaryMonthly: own('fopMilitaryMonthly'),
        esvEnabled: values.esvEnabled === defaults.esvEnabled ? undefined : values.esvEnabled,
        esvRate: own('esvRate'),
        minWage: own('minWage'),
        pdfoRate: own('pdfoRate'),
        investmentMilitaryRate: own('investmentMilitaryRate'),
        foreignDocumentDefault: values.foreignDocumentDefault || undefined,
      };
      await saveTaxSettings(year, body);
      const chosen = incomeCategories.map(Number);
      const before = settings.incomeCategoryIds;
      if (chosen.length !== before.length || chosen.some((id) => !before.includes(id))) {
        await saveIncomeCategories(chosen);
      }
    },
    onSuccess: async () => {
      await invalidateTaxes(queryClient);
      onClose();
    },
    meta: { errorShown: true },
  });

  const field = (key: NumberField, label: string, unit: '%' | '₴', source: string) => {
    const changed = values[key] !== defaults[key];
    return (
      <NumberInput
        label={label}
        description={
          <span>
            {t('taxes.rates.default', {
              value:
                unit === '%'
                  ? `${String(defaults[key]).replace('.', ',')} %`
                  : formatMoney(defaults[key], 'UAH'),
            })}
            {changed && (
              <>
                {' · '}
                <Anchor component="button" type="button" size="xs" onClick={() => set(key, defaults[key])}>
                  {t('taxes.rates.reset')}
                </Anchor>
              </>
            )}
            {' · '}
            <Anchor href={source} target="_blank" rel="noreferrer" size="xs">
              {t('taxes.rates.source')}
            </Anchor>
          </span>
        }
        inputWrapperOrder={['label', 'input', 'description', 'error']}
        rightSection={
          <Text size="xs" c="dimmed">
            {unit}
          </Text>
        }
        min={0}
        max={unit === '%' ? 100 : undefined}
        decimalScale={unit === '%' ? 3 : 2}
        thousandSeparator=" "
        decimalSeparator=","
        value={values[key]}
        onChange={(value) => set(key, typeof value === 'number' ? value : Number(value) || 0)}
        styles={changed ? { input: { borderColor: 'var(--mantine-color-yellow-6)' } } : undefined}
      />
    );
  };
  const sources = settings.sources;
  const taxCode = sources.taxCode ?? 'https://tax.gov.ua/';
  const esvLaw = sources.esv ?? taxCode;
  const taxService = sources.taxService ?? taxCode;

  return (
    <Stack gap="md">
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        {t('taxes.rates.fop')}
      </Text>
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {t('taxes.rates.group')}
        </Text>
        <SegmentedControl
          aria-label={t('taxes.rates.group')}
          value={group}
          onChange={(value) => {
            const next = value as FopGroup;
            setValues((current) => ({
              ...current,
              fopGroup: next === '1' ? 1 : next === '2' ? 2 : 3,
              fopVat: next === '3vat',
              singleTaxRate: next === '3vat' ? 3 : next === '3' ? 5 : current.singleTaxRate,
            }));
          }}
          data={[
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: t('taxes.rates.group3') },
            { value: '3vat', label: t('taxes.rates.group3vat') },
          ]}
        />
      </Stack>
      <SimpleGrid cols={2}>
        {values.fopGroup === 3
          ? field('singleTaxRate', t('taxes.rates.singleTaxRate'), '%', taxCode)
          : field('singleTaxMonthly', t('taxes.rates.singleTaxMonthly'), '₴', taxCode)}
        {values.fopGroup === 3
          ? field('fopMilitaryRate', t('taxes.rates.militaryRate'), '%', taxCode)
          : field('fopMilitaryMonthly', t('taxes.rates.militaryMonthly'), '₴', taxCode)}
      </SimpleGrid>
      <Switch
        label={t('taxes.rates.esvEnabled')}
        checked={values.esvEnabled}
        onChange={(event) => set('esvEnabled', event.currentTarget.checked)}
      />
      <SimpleGrid cols={2}>
        {field('esvRate', t('taxes.rates.esvRate'), '%', esvLaw)}
        {field('minWage', t('taxes.rates.minWage'), '₴', taxService)}
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        {t('taxes.rates.esvHint', { amount: formatMoney(esvMonthly(values), 'UAH') })}
      </Text>
      <MultiSelect
        label={t('taxes.rates.incomeCategories')}
        description={t('taxes.rates.incomeCategoriesHint')}
        inputWrapperOrder={['label', 'input', 'description', 'error']}
        placeholder={t('taxes.rates.incomeCategoriesPlaceholder')}
        searchable
        clearable
        data={categorySelectData(categories.data ?? [], 'INCOME')}
        value={incomeCategories}
        onChange={setIncomeCategories}
      />

      <Divider />
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        {t('taxes.rates.investments')}
      </Text>
      <SimpleGrid cols={2}>
        {field('pdfoRate', t('taxes.rates.pdfoRate'), '%', taxCode)}
        {field('investmentMilitaryRate', t('taxes.rates.militaryRate'), '%', taxCode)}
      </SimpleGrid>
      <Switch
        label={t('taxes.rates.documentDefault')}
        checked={values.foreignDocumentDefault}
        onChange={(event) => set('foreignDocumentDefault', event.currentTarget.checked)}
      />
      <Group gap={6}>
        <Text size="xs" c="dimmed">
          {t('taxes.rates.check')}
        </Text>
        <Anchor href={taxService} target="_blank" rel="noreferrer" size="xs">
          tax.gov.ua
        </Anchor>
      </Group>

      <ProblemAlert error={save.error} />
      <FormFooter onCancel={onClose} saving={save.isPending} onSubmit={() => save.mutate()} />
    </Stack>
  );
}
