import { useEffect, useMemo, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';

/**
 * Shows a public page under /uk/ in Ukrainian whatever language the visitor chose before, without changing that
 * choice: the page gets its own copy of the translations set to Ukrainian.
 */
export function UkrainianPage({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const ukrainian = useMemo(() => i18n.cloneInstance({ lng: 'uk' }), [i18n]);
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = 'uk';
    return () => {
      document.documentElement.lang = previous;
    };
  }, []);
  return <I18nextProvider i18n={ukrainian}>{children}</I18nextProvider>;
}
