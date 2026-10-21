import { Button, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { problemMessage, toProblem } from '../api/errors';
import { ProblemAlert } from '../components/feedback';
import type { IdentityMethod, IdentityProof } from './identity';

const fieldCodes = { password: 'INVALID_CURRENT_PASSWORD', code: 'INVALID_TWO_FACTOR_CODE' } as const;

/**
 * Asks for the current password or a 2FA code before a change of the ways to sign in. The caller's mutation runs
 * with the proof; its error is shown at the field when the proof is wrong.
 */
export function ConfirmIdentityModal({
  method,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  method: IdentityMethod;
  pending: boolean;
  error: unknown;
  onConfirm(proof: IdentityProof): void;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  const problem = error ? toProblem(error) : null;
  const fieldError = problem?.code === fieldCodes[method] ? problemMessage(problem) : undefined;

  return (
    <Modal opened onClose={onClose} title={<Text fw={600}>{t('settings.confirmIdentity.title')}</Text>}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(method === 'password' ? { password: value } : { code: value.trim() });
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t(
              method === 'password'
                ? 'settings.confirmIdentity.passwordHint'
                : 'settings.confirmIdentity.codeHint',
            )}
          </Text>
          {method === 'password' ? (
            <PasswordInput
              label={t('settings.security.current')}
              autoComplete="current-password"
              data-autofocus
              value={value}
              error={fieldError}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
          ) : (
            <TextInput
              label={t('settings.twoFactor.codeOrRecovery')}
              autoComplete="one-time-code"
              data-autofocus
              value={value}
              error={fieldError}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
          )}
          {!fieldError && <ProblemAlert error={error} />}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!value.trim()} loading={pending}>
              {t('settings.confirmIdentity.submit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
