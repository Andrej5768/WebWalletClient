import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, problemMessage, toProblem } from '../api/errors';
import { useAuth } from '../auth/context';
import { required } from '../lib/validation';
import { currencyOptions } from '../lib/currencies';

export function ProfileTab() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const form = useForm({
    initialValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      baseCurrency: user?.baseCurrency ?? 'UAH',
      locale: user?.locale === 'en' ? 'en' : 'uk',
    },
    validate: { firstName: required },
  });

  const save = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const { data, error } = await api.PUT('/api/v1/me', {
        body: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim() || undefined,
          baseCurrency: values.baseCurrency,
          locale: values.locale,
        },
      });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: async (data) => {
      const currencyChanged = data.baseCurrency !== user?.baseCurrency;
      setUser(data);
      // Every figure in the base currency is recalculated.
      if (currencyChanged) await queryClient.invalidateQueries();
      if (data.locale && data.locale !== i18n.language) void i18n.changeLanguage(data.locale);
      notifications.show({ message: t('settings.saved'), color: 'green' });
    },
    onError: (error) => form.setErrors(fieldErrors(toProblem(error))),
  });

  return (
    <Card withBorder radius="md" padding="lg" maw={640}>
      <form onSubmit={form.onSubmit((values) => save.mutate(values))} noValidate>
        <Stack gap="md">
          <SimpleGrid cols={2} spacing="md">
            <TextInput label={t('auth.firstName')} withAsterisk {...form.getInputProps('firstName')} />
            <TextInput label={t('auth.lastName')} {...form.getInputProps('lastName')} />
          </SimpleGrid>
          <TextInput
            label={t('auth.email')}
            value={user?.email ?? ''}
            readOnly
            rightSectionWidth={120}
            rightSection={
              user?.emailVerified ? (
                <Badge color="green" variant="light" size="sm">
                  {t('settings.profile.verified')}
                </Badge>
              ) : null
            }
          />
          <Select
            label={t('settings.profile.baseCurrency')}
            description={t('settings.profile.baseCurrencyHint')}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            searchable
            allowDeselect={false}
            data={currencyOptions(form.values.baseCurrency)}
            {...form.getInputProps('baseCurrency')}
          />
          <Group gap="xl" align="flex-end">
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                {t('settings.profile.language')}
              </Text>
              <SegmentedControl
                data={[
                  { value: 'uk', label: 'Українська' },
                  { value: 'en', label: 'English' },
                ]}
                {...form.getInputProps('locale')}
              />
            </Stack>
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                {t('theme.label')}
              </Text>
              <SegmentedControl
                value={colorScheme}
                onChange={(value) => setColorScheme(value as MantineColorScheme)}
                data={[
                  { value: 'auto', label: t('theme.auto') },
                  { value: 'light', label: t('theme.light') },
                  { value: 'dark', label: t('theme.dark') },
                ]}
              />
            </Stack>
          </Group>
          {save.error && !toProblem(save.error).errors?.length && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              {problemMessage(toProblem(save.error))}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
