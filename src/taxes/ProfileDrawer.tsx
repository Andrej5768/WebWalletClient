import { Anchor, Center, Drawer, Loader, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toProblem } from '../api/errors';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { formErrors } from '../transactions/form';
import { invalidateTaxes, saveTaxProfile, useTaxProfile, type TaxProfile } from './api';

/** The form keeps the tax office as one four-digit code; the server takes its region and district. */
interface ProfileValues {
  tin: string;
  name: string;
  office: string;
  taxOffice: string;
  region: string;
  district: string;
  city: string;
  street: string;
  building: string;
  corpus: string;
  apartment: string;
  zip: string;
  phone: string;
  email: string;
  kvedCode: string;
  kvedName: string;
}

function initialValues(profile: TaxProfile | null): ProfileValues {
  return {
    tin: profile?.tin ?? '',
    name: profile?.name ?? '',
    office: profile ? String(profile.regionCode * 100 + profile.districtCode).padStart(4, '0') : '',
    taxOffice: profile?.taxOffice ?? '',
    region: profile?.region ?? '',
    district: profile?.district ?? '',
    city: profile?.city ?? '',
    street: profile?.street ?? '',
    building: profile?.building ?? '',
    corpus: profile?.corpus ?? '',
    apartment: profile?.apartment ?? '',
    zip: profile?.zip ?? '',
    phone: profile?.phone ?? '',
    email: profile?.email ?? '',
    kvedCode: profile?.kvedCode ?? '',
    kvedName: profile?.kvedName ?? '',
  };
}

const optional = (value: string) => value.trim() || undefined;

function toProfile(values: ProfileValues): TaxProfile {
  const office = Number(values.office);
  return {
    tin: values.tin.trim(),
    name: values.name.trim(),
    regionCode: Math.floor(office / 100),
    districtCode: office % 100,
    taxOffice: values.taxOffice.trim(),
    region: optional(values.region),
    district: optional(values.district),
    city: values.city.trim(),
    street: values.street.trim(),
    building: optional(values.building),
    corpus: optional(values.corpus),
    apartment: optional(values.apartment),
    zip: optional(values.zip),
    phone: optional(values.phone),
    email: optional(values.email),
    kvedCode: optional(values.kvedCode),
    kvedName: optional(values.kvedName),
  } as TaxProfile;
}

/** The taxpayer details the declarations need; kept encrypted by the server. */
export function ProfileDrawer({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const profile = useTaxProfile();
  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size={560}
      title={
        <Stack gap={0}>
          <Text fw={600}>{t('taxes.profile.title')}</Text>
          <Text size="xs" c="dimmed">
            {t('taxes.profile.subtitle')}
          </Text>
        </Stack>
      }
    >
      {profile.isSuccess ? (
        <ProfileForm profile={profile.data} onClose={onClose} />
      ) : (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}
    </Drawer>
  );
}

function ProfileForm({ profile, onClose }: { profile: TaxProfile | null; onClose(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<ProfileValues>({
    initialValues: initialValues(profile),
    validate: {
      tin: (value) =>
        /^([0-9]{9,10}|[А-ЯІЄ]{2}[0-9]{6})$/.test(value.trim()) ? null : t('taxes.profile.tinInvalid'),
      name: (value) => (value.trim() ? null : t('validation.required')),
      office: (value) => (/^[1-9][0-9]{3}$/.test(value.trim()) ? null : t('taxes.profile.officeInvalid')),
      taxOffice: (value) => (value.trim() ? null : t('validation.required')),
      city: (value) => (value.trim() ? null : t('validation.required')),
      street: (value) => (value.trim() ? null : t('validation.required')),
      zip: (value) =>
        !value.trim() || /^[0-9]{5}$/.test(value.trim()) ? null : t('taxes.profile.zipInvalid'),
      kvedCode: (value) =>
        !value.trim() || /^[0-9]{2}\.([0-9]{1,2}|[0-9]{2}\.[0-9])$/.test(value.trim())
          ? null
          : t('taxes.profile.kvedInvalid'),
    },
  });
  const save = useMutation({
    mutationFn: (values: ProfileValues) => saveTaxProfile(toProfile(values)),
    onSuccess: async () => {
      await invalidateTaxes(queryClient);
      onClose();
    },
    onError: (error) => form.setErrors(formErrors(toProblem(error))),
  });
  const input = (key: keyof ProfileValues, required = false) => (
    <TextInput
      label={t(`taxes.profile.fields.${key}`)}
      withAsterisk={required}
      {...form.getInputProps(key)}
    />
  );

  return (
    <form onSubmit={form.onSubmit((values) => save.mutate(values))} noValidate>
      <Stack gap="md">
        <SimpleGrid cols={2}>
          {input('tin', true)}
          {input('name', true)}
        </SimpleGrid>
        <SimpleGrid cols={2}>
          <TextInput
            label={t('taxes.profile.fields.office')}
            withAsterisk
            description={t('taxes.profile.officeHint')}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            maxLength={4}
            {...form.getInputProps('office')}
          />
          {input('taxOffice', true)}
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          {t('taxes.profile.officeWhere')}{' '}
          <Anchor href="https://tax.gov.ua/" target="_blank" rel="noreferrer" size="xs">
            tax.gov.ua
          </Anchor>
        </Text>
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          {t('taxes.profile.address')}
        </Text>
        <SimpleGrid cols={2}>
          {input('region')}
          {input('district')}
          {input('city', true)}
          {input('street', true)}
        </SimpleGrid>
        <SimpleGrid cols={4}>
          {input('building')}
          {input('corpus')}
          {input('apartment')}
          {input('zip')}
        </SimpleGrid>
        <SimpleGrid cols={2}>
          {input('phone')}
          {input('email')}
        </SimpleGrid>
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          {t('taxes.profile.fop')}
        </Text>
        <SimpleGrid cols={2}>
          {input('kvedCode')}
          {input('kvedName')}
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          {t('taxes.profile.privacy')}
        </Text>
        <ProblemAlert error={save.error} fieldsShown={Object.keys(form.values)} />
        <FormFooter onCancel={onClose} saving={save.isPending} />
      </Stack>
    </form>
  );
}
