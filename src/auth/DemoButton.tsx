import { Button, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { problemMessage } from '../api/errors';
import { useAuth } from './context';
import { useDemoOffered } from './useDemoOffered';

/**
 * "Try the demo": opens a sandbox with example data and signs in to it, no registration needed. Nothing when the
 * server does not offer it.
 */
export function DemoButton({ hint = false, size = 'md' }: { hint?: boolean; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const { signInDemo } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const offered = useDemoOffered();
  if (!offered) return null;

  const start = async () => {
    setStarting(true);
    const result = await signInDemo();
    setStarting(false);
    if (result.status === 'problem') {
      notifications.show({ color: 'red', message: problemMessage(result.problem) });
    } else if (result.status === 'signedIn') {
      void navigate('/', { replace: true });
    }
  };

  return (
    <Stack gap={4}>
      <Button
        variant="light"
        size={size}
        leftSection={<FlaskConical size={16} />}
        loading={starting}
        onClick={() => void start()}
      >
        {t('auth.login.demo')}
      </Button>
      {hint && (
        <Text size="xs" c="dimmed" ta="center">
          {t('auth.login.demoHint')}
        </Text>
      )}
    </Stack>
  );
}
