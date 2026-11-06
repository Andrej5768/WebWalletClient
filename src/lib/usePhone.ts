import { useMediaQuery } from '@mantine/hooks';

/** Narrower than a tablet: the shell hides the sidebar and wide tables give way to lists. */
export const PHONE_QUERY = '(max-width: 767.98px)';

export function usePhone(): boolean {
  return useMediaQuery(PHONE_QUERY, false, { getInitialValueInEffect: false });
}
