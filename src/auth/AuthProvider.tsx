import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshAccessToken, type Schemas } from '../api/client';
import { toProblem, type ApiProblem } from '../api/errors';
import { onAccessTokenChange, setAccessToken } from '../api/session';
import i18n from '../i18n';
import { AuthContext, type AuthState } from './context';

export type User = Schemas['UserResponse'];

async function loadUser(): Promise<User | null> {
  const { data } = await api.GET('/api/v1/me');
  return data ?? null;
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

  const finishSignIn = useCallback(async () => {
    const loaded = await loadUser();
    if (!loaded) {
      setAccessToken(null);
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
      if (!token || !(await finishSignIn())) setStatus('signedOut');
    });
    return () => {
      cancelled = true;
    };
  }, [finishSignIn]);

  // A failed refresh in the middle of the session (cookie expired or revoked) signs the user out.
  useEffect(
    () =>
      onAccessTokenChange((token) => {
        if (token === null) {
          setUser(null);
          setStatus('signedOut');
          queryClient.clear();
        }
      }),
    [queryClient],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<ApiProblem | null> => {
      try {
        const { data, error } = await api.POST('/api/v1/auth/login', { body: { email, password } });
        if (error || !data?.accessToken) return toProblem(error);
        setAccessToken(data.accessToken);
        return (await finishSignIn()) ? null : toProblem(undefined);
      } catch (thrown) {
        return toProblem(thrown);
      }
    },
    [finishSignIn],
  );

  const signOut = useCallback(async () => {
    try {
      await api.POST('/api/v1/auth/logout');
    } finally {
      setAccessToken(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, signIn, signOut, setUser }),
    [status, user, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
