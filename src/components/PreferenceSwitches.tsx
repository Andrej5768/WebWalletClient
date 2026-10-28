import { SegmentedControl, Tooltip, useMantineColorScheme, type MantineColorScheme } from '@mantine/core';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import appI18n from '../i18n';
import { isUkrainianPath, withoutUkrainianPrefix } from '../landing/seo';

/**
 * The interface language. It is saved for the next visits; on a public page that has a pair in the other language
 * (/uk/terms and /terms) it also opens that pair, since the Ukrainian pages stay Ukrainian.
 */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const change = (value: string) => {
    void appI18n.changeLanguage(value);
    if (isUkrainianPath(pathname) && value === 'en') navigate(withoutUkrainianPrefix(pathname));
    else if ((pathname === '/privacy' || pathname === '/terms') && value === 'uk') navigate(`/uk${pathname}`);
  };
  return (
    <SegmentedControl
      aria-label={t('language.label')}
      size="xs"
      value={i18n.language}
      onChange={change}
      data={[
        { value: 'uk', label: 'УКР' },
        { value: 'en', label: 'ENG' },
      ]}
    />
  );
}

export function ColorSchemeSwitch() {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const option = (value: MantineColorScheme, label: string, icon: React.ReactNode) => ({
    value,
    label: (
      <Tooltip label={label} withArrow openDelay={300}>
        <span aria-label={label} style={{ display: 'inline-flex' }}>
          {icon}
        </span>
      </Tooltip>
    ),
  });
  return (
    <SegmentedControl
      aria-label={t('theme.label')}
      size="xs"
      value={colorScheme}
      onChange={(value) => setColorScheme(value as MantineColorScheme)}
      data={[
        option('auto', t('theme.auto'), <Monitor size={14} />),
        option('light', t('theme.light'), <Sun size={14} />),
        option('dark', t('theme.dark'), <Moon size={14} />),
      ]}
    />
  );
}
