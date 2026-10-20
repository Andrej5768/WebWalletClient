import { api } from '../api/client';
import { useAuth } from '../auth/context';

/** Reloads the profile, so that the cards show the new state. */
export function useReloadUser() {
  const { setUser } = useAuth();
  return async () => {
    const { data } = await api.GET('/api/v1/me');
    if (data) setUser(data);
  };
}
