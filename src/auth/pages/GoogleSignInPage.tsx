import { Alert, Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { CircleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { problemMessage, type ApiProblem } from '../../api/errors';
import { AuthLayout } from '../AuthLayout';
import { useAuth } from '../context';
import { PendingDeletion } from '../PendingDeletion';
import { TwoFactorStep } from './TwoFactorStep';

type State =
  | { status: 'working' }
  | { status: 'twoFactor'; challenge: string }
  | { status: 'pendingDeletion'; problem: ApiProblem }
  | { status: 'failed'; message: string };

/** The account is to be deleted: offer to cancel; any other problem is shown as text. */
function afterProblem(problem: ApiProblem): State {
  return problem.code === 'ACCOUNT_DELETION_SCHEDULED'
    ? { status: 'pendingDeletion', problem }
    : { status: 'failed', message: problemMessage(problem) };
}

/**
 * The page Google sign-in comes back to: the fragment holds a one-time ticket, or the error of the sign-in.
 * The ticket is exchanged for a session like a password, with the two-factor step when it is on.
 */
export function GoogleSignInPage() {
  const { t } = useTranslation();
  const { completeGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Read once: the fragment is cleared right away, so that the ticket does not stay in the address bar
  const [fragment] = useState(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    return { ticket: params.get('ticket'), error: params.get('error') };
  });
  const [state, setState] = useState<State>(() =>
    fragment.ticket
      ? { status: 'working' }
      : {
          status: 'failed',
          message: t(`auth.google.errors.${fragment.error ?? 'failed'}`, {
            defaultValue: t('auth.google.errors.failed'),
          }),
        },
  );
  const started = useRef(false);

  useEffect(() => {
    if (location.hash) void navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    // The ticket works once, so the exchange must not run twice
    if (!fragment.ticket || started.current) return;
    started.current = true;
    void completeGoogle(fragment.ticket).then((result) => {
      if (result.status === 'signedIn') void navigate('/', { replace: true });
      else if (result.status === 'twoFactor') setState({ status: 'twoFactor', challenge: result.challenge });
      else setState(afterProblem(result.problem));
    });
  }, [completeGoogle, fragment.ticket, navigate]);

  if (state.status === 'working') {
    return (
      <Center mih="100vh">
        <Loader size="sm" aria-label={t('auth.google.working')} />
      </Center>
    );
  }

  return (
    <AuthLayout>
      {state.status === 'twoFactor' ? (
        <TwoFactorStep
          challenge={state.challenge}
          onSignedIn={() => void navigate('/', { replace: true })}
          onExpired={(problem) => setState(afterProblem(problem))}
          onBack={() => void navigate('/login', { replace: true })}
        />
      ) : state.status === 'pendingDeletion' ? (
        <PendingDeletion
          problem={state.problem}
          onRestored={() => void navigate('/', { replace: true })}
          onBack={() => void navigate('/login', { replace: true })}
        />
      ) : (
        <Stack gap="lg">
          <Title order={1} size="h2">
            {t('auth.google.failedTitle')}
          </Title>
          <Alert role="alert" color="yellow" variant="light" p="xs" icon={<CircleAlert size={16} />}>
            <Text size="sm">{state.message}</Text>
          </Alert>
          <Button component={Link} to="/login" size="md">
            {t('auth.backToLogin')}
          </Button>
        </Stack>
      )}
    </AuthLayout>
  );
}
