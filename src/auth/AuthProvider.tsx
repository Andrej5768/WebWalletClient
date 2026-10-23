import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, refreshAccessToken, type Schemas } from '../api/client';
import { toProblem, type ApiProblem } from '../api/errors';
import { onAccessTokenChange, setAccessToken, shareAccessToken } from '../api/session';
import i18n from '../i18n';
import { clearDataKeys } from '../lib/storage';
import { AuthContext, type AuthState, type SignInResult } from './context';

type User = Schemas['UserResponse'];
type LoginResponse = Schemas['LoginResponse'];

async function loadUser(): Promise<User | null> {
  try {
    const { data } = await api.GET('/api/v1/me');
    return data ?? null;
  } catch {
    return null;
  }
}

function applyUserLanguage(user: User) {
  if ((user.locale === 'uk' || user.locale === 'en') && user.locale !== i18n.language) {
    void i18n.changeLanguage(user.locale);
  }
}

/** Restores the session from the refresh cookie on start and exposes sign-in and sign-out. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
    // /boot.js hides the static home page of index.html for a browser that has signed in
    try {
      if (status === 'signedIn') localStorage.setItem('ww-returning', '1');
    } catch {
      // Storage can be unavailable (private mode)
    }
  }, [status]);

  /** Loads the profile with the current access token; signs out when that is not possible. */
  const finishSignIn = useCallback(async () => {
    const loaded = await loadUser();
    if (!loaded) {
      setAccessToken(null);
      setStatus('signedOut');
      return false;
    }
    applyUserLanguage(loaded);
    setUser(loaded);
    setSessionEnded(false);
    setStatus('signedIn');
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refreshAccessToken().then(async (token) => {
      if (cancelled) return;
      if (token) await finishSignIn();
      else setStatus('signedOut');
    });
    return () => {
      cancelled = true;
    };
  }, [finishSignIn]);

  // Sign-out here, in another tab, or after a failed refresh clears everything this tab shows and the financial
  // inputs kept in the browser; a sign-in in another tab signs this tab in too.
  useEffect(
    () =>
      onAccessTokenChange((token, remote) => {
        if (token === null) {
          setUser(null);
          setStatus('signedOut');
          queryClient.clear();
          clearDataKeys();
        } else if (remote && statusRef.current === 'signedOut') {
          void finishSignIn();
        }
      }),
    [queryClient, finishSignIn],
  );

  /** A session, the second step of two-factor authentication, or the problem of a login response. */
  const loginResult = useCallback(
    async (call: Promise<{ data?: LoginResponse; error?: unknown }>): Promise<SignInResult> => {
      try {
        const { data, error } = await call;
        if (data?.twoFactorChallenge) return { status: 'twoFactor', challenge: data.twoFactorChallenge };
        if (error || !data?.accessToken) return { status: 'problem', problem: toProblem(error) };
        shareAccessToken(data.accessToken);
        return (await finishSignIn())
          ? { status: 'signedIn' }
          : { status: 'problem', problem: toProblem(undefined) };
      } catch (thrown) {
        return { status: 'problem', problem: toProblem(thrown) };
      }
    },
    [finishSignIn],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      loginResult(api.POST('/api/v1/auth/login', { body: { email, password } })),
    [loginResult],
  );

  const completeGoogle = useCallback(
    (ticket: string) => loginResult(api.POST('/api/v1/auth/google/complete', { body: { ticket } })),
    [loginResult],
  );

  const completeTwoFactor = useCallback(
    async (challenge: string, code: string, trustDevice: boolean): Promise<ApiProblem | null> => {
      try {
        const { data, error } = await api.POST('/api/v1/auth/login/two-factor', {
          body: { challenge, code, trustDevice },
        });
        if (error || !data?.accessToken) return toProblem(error);
        shareAccessToken(data.accessToken);
        return (await finishSignIn()) ? null : toProblem(undefined);
      } catch (thrown) {
        return toProblem(thrown);
      }
    },
    [finishSignIn],
  );

  const restoreAccount = useCallback(
    async (token: string): Promise<ApiProblem | null> => {
      try {
        const { data, error } = await api.POST('/api/v1/auth/restore', { body: { token } });
        if (error || !data?.accessToken) return toProblem(error);
        shareAccessToken(data.accessToken);
        return (await finishSignIn()) ? null : toProblem(undefined);
      } catch (thrown) {
        return toProblem(thrown);
      }
    },
    [finishSignIn],
  );

  const signOut = useCallback(async () => {
    // The local session ends in any case; a failure means the server session may still be alive.
    try {
      const { response } = await api.POST('/api/v1/auth/logout');
      if (!response.ok) throw new Error(`Logout failed: ${response.status}`);
    } catch {
      notifications.show({ color: 'yellow', message: i18n.t('shell.signOutFailed') });
    } finally {
      shareAccessToken(null);
    }
  }, []);

  const endSession = useCallback(() => {
    setSessionEnded(true);
    shareAccessToken(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      signIn,
      completeGoogle,
      completeTwoFactor,
      restoreAccount,
      signOut,
      endSession,
      sessionEnded,
      setUser,
    }),
    [
      status,
      user,
      signIn,
      completeGoogle,
      completeTwoFactor,
      restoreAccount,
      signOut,
      endSession,
      sessionEnded,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
