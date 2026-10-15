import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, refreshAccessToken, type Schemas } from '../api/client';
import { toProblem, type ApiProblem } from '../api/errors';
import { onAccessTokenChange, setAccessToken, shareAccessToken } from '../api/session';
import i18n from '../i18n';
import { AuthContext, type AuthState } from './context';

type User = Schemas['UserResponse'];

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
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
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

  // Sign-out here, in another tab, or after a failed refresh clears everything this tab shows;
  // a sign-in in another tab signs this tab in too.
  useEffect(
    () =>
      onAccessTokenChange((token, remote) => {
        if (token === null) {
          setUser(null);
          setStatus('signedOut');
          queryClient.clear();
        } else if (remote && statusRef.current === 'signedOut') {
          void finishSignIn();
        }
      }),
    [queryClient, finishSignIn],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<ApiProblem | null> => {
      try {
        const { data, error } = await api.POST('/api/v1/auth/login', { body: { email, password } });
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

  const value = useMemo<AuthState>(
    () => ({ status, user, signIn, signOut, setUser }),
    [status, user, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
