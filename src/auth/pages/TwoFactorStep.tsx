import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { CircleAlert, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { problemMessage, type ApiProblem } from '../../api/errors';
import { required } from '../../lib/validation';
import { useAuth } from '../context';

/** The second step of signing in: a code of the authenticator app or a recovery code. */
export function TwoFactorStep({
  challenge,
  onSignedIn,
  onExpired,
  onBack,
}: {
  challenge: string;
  onSignedIn(): void;
  /** Signing in cannot go on with a code: the time for it is over, or the account is to be deleted. */
  onExpired(problem: ApiProblem): void;
  onBack(): void;
}) {
  const { t } = useTranslation();
  const { completeTwoFactor } = useAuth();
  const [recovery, setRecovery] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({ initialValues: { code: '', trust: false }, validate: { code: required } });

  const submit = form.onSubmit(async ({ code, trust }) => {
    setSubmitting(true);
    setProblem(null);
    const result = await completeTwoFactor(challenge, code.trim(), trust);
    setSubmitting(false);
    if (!result) {
      onSignedIn();
    } else if (result.code === 'TWO_FACTOR_EXPIRED' || result.code === 'ACCOUNT_DELETION_SCHEDULED') {
      onExpired(result);
    } else {
      setProblem(result);
      form.setFieldValue('code', '');
    }
  });

  const switchMode = () => {
    setRecovery((value) => !value);
    setProblem(null);
    form.setFieldValue('code', '');
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        <ThemeIcon size={40} radius="md" variant="light" aria-hidden>
          <Smartphone size={20} />
        </ThemeIcon>
        <Stack gap={4}>
          <Title order={1} size="h2">
            {t('auth.twoFactor.title')}
          </Title>
          <Text c="dimmed">{recovery ? t('auth.twoFactor.recoveryText') : t('auth.twoFactor.appText')}</Text>
        </Stack>
        {recovery ? (
          <TextInput
            label={t('auth.twoFactor.recoveryCode')}
            autoComplete="off"
            ff="monospace"
            data-autofocus
            {...form.getInputProps('code')}
          />
        ) : (
          <TextInput
            label={t('auth.twoFactor.code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', letterSpacing: '0.3em' } }}
            size="md"
            data-autofocus
            {...form.getInputProps('code')}
          />
        )}
        {!recovery && (
          <Checkbox
            label={t('auth.twoFactor.trust')}
            {...form.getInputProps('trust', { type: 'checkbox' })}
          />
        )}
        <Stack gap="xs">
          {problem && (
            <Alert role="alert" color="yellow" variant="light" p="xs" icon={<CircleAlert size={16} />}>
              <Text size="sm">{problemMessage(problem)}</Text>
            </Alert>
          )}
          <Button type="submit" fullWidth size="md" loading={submitting}>
            {t('auth.twoFactor.submit')}
          </Button>
        </Stack>
        <Group justify="space-between">
          <Anchor component="button" type="button" size="sm" onClick={switchMode}>
            {recovery ? t('auth.twoFactor.useApp') : t('auth.twoFactor.useRecovery')}
          </Anchor>
          <Anchor component="button" type="button" size="sm" onClick={onBack}>
            {t('auth.twoFactor.back')}
          </Anchor>
        </Group>
      </Stack>
    </form>
  );
}
