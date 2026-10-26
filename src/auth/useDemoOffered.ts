import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { unwrap } from '../api/http';

/** Whether this server offers a demo sandbox; false until the options arrive. */
export function useDemoOffered(): boolean {
  const options = useQuery({
    queryKey: ['authOptions'],
    queryFn: () => unwrap(api.GET('/api/v1/auth/options')),
    staleTime: Infinity,
  });
  return options.data?.demo ?? false;
}
