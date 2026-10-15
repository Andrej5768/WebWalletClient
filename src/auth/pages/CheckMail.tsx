import { Anchor, Button, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../../api/client';

/** "Check your email" with an optional resend of the confirmation link. */
export function CheckMail({ text, resendTo }: { text: string; resendTo?: string }) {
  const { t } = useTranslation();
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!resendTo) return;
    setSending(true);
    await api.POST('/api/v1/auth/resend-verification', { body: { email: resendTo } }).catch(() => undefined);
    setSending(false);
    setResent(true);
  };

  return (
    <Stack gap="md">
      <ThemeIcon size={36} radius="md" aria-hidden>
        <Mail size={18} />
      </ThemeIcon>
      <Title order={1} size="h2">
        {t('auth.checkMail.title')}
      </Title>
      <Text c="dimmed">{text}</Text>
      <Button component={Link} to="/login" variant="default" fullWidth size="md">
        {t('auth.backToLogin')}
      </Button>
      {resendTo && (
        <Text size="xs" c="dimmed" ta="center">
          {resent ? (
            t('auth.checkMail.resent')
          ) : (
            <>
              {t('auth.checkMail.noMail')}{' '}
              <Anchor component="button" type="button" size="xs" onClick={resend} disabled={sending}>
                {t('auth.verify.resend')}
              </Anchor>
            </>
          )}
        </Text>
      )}
    </Stack>
  );
}
