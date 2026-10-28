import { Alert, Button, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, problemMessage, toProblem, type ApiProblem } from '../api/errors';
import { locale } from '../i18n';
import { newPassword, required, requiredEmail } from '../lib/validation';
import { useAuth } from './context';

/**
 * Over the pages of a demo sandbox: when the data disappears and the way to keep it. Claiming asks for an email,
 * a password and a name; the sandbox becomes an ordinary account and the verification email goes out.
 */
export function DemoBanner() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [opened, setOpened] = useState(false);
  if (!user?.demo) return null;

  const expires = user.demoExpiresAt
    ? new Intl.DateTimeFormat(locale(), {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(user.demoExpiresAt))
    : null;

  return (
    <>
      <Alert
        color="yellow"
        variant="light"
        radius={0}
        py={6}
        icon={<FlaskConical size={16} />}
        styles={{ message: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } }}
      >
        <Text size="sm" style={{ flex: 1 }}>
          {expires ? t('auth.demo.banner', { date: expires }) : t('auth.demo.bannerNoDate')}
        </Text>
        <Button size="xs" variant="filled" color="yellow" onClick={() => setOpened(true)}>
          {t('auth.demo.keep')}
        </Button>
      </Alert>
      <ClaimModal
        opened={opened}
        onClose={() => setOpened(false)}
        onClaimed={() => {
          setOpened(false);
          void api.GET('/api/v1/me').then(({ data }) => data && setUser(data));
          notifications.show({ color: 'green', message: t('auth.demo.claimed'), autoClose: 8000 });
        }}
      />
    </>
  );
}

function ClaimModal({
  opened,
  onClose,
  onClaimed,
}: {
  opened: boolean;
  onClose: () => void;
  onClaimed: () => void;
}) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    initialValues: { firstName: '', email: '', password: '' },
    validate: { firstName: required, email: requiredEmail, password: newPassword },
  });

  const submit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setProblem(null);
    try {
      const { error } = await api.POST('/api/v1/me/demo/claim', {
        body: { ...values, email: values.email.trim() },
      });
      if (error) {
        const failed = toProblem(error);
        form.setErrors(fieldErrors(failed));
        setProblem(failed);
      } else {
        onClaimed();
      }
    } catch (thrown) {
      setProblem(toProblem(thrown));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title={t('auth.demo.claimTitle')} centered>
      <form onSubmit={submit} noValidate>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('auth.demo.claimText')}
          </Text>
          <TextInput
            label={t('auth.firstName')}
            autoComplete="given-name"
            {...form.getInputProps('firstName')}
          />
          <TextInput
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label={t('auth.password')}
            description={t('auth.passwordHint')}
            autoComplete="new-password"
            {...form.getInputProps('password')}
          />
          {problem && Object.keys(fieldErrors(problem)).length === 0 && (
            <Text size="sm" c="red">
              {problemMessage(problem)}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {t('auth.demo.claimSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
