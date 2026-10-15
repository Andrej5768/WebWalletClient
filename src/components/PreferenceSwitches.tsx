import { SegmentedControl, Tooltip, useMantineColorScheme, type MantineColorScheme } from '@mantine/core';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <SegmentedControl
      aria-label={t('language.label')}
      size="xs"
      value={i18n.language}
      onChange={(value) => void i18n.changeLanguage(value)}
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
