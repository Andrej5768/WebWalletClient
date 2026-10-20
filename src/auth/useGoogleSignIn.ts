import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { unwrap } from '../api/http';

/** Whether this server offers sign-in with Google. */
export function useGoogleSignIn(): boolean {
  const options = useQuery({
    queryKey: ['authOptions'],
    queryFn: () => unwrap(api.GET('/api/v1/auth/options')),
    staleTime: Infinity,
  });
  return options.data?.googleSignIn ?? false;
}
