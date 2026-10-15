import { Menu, Skeleton, Text, UnstyledButton } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccountsSummary } from '../api/queries';
import { formatMoney } from '../lib/money';
import classes from './shell.module.css';

export type BalanceMode = 'netWorth' | 'availableWithCredit' | 'readyToAssign';
const modes: BalanceMode[] = ['netWorth', 'availableWithCredit', 'readyToAssign'];

/** The balance above the menu; the user picks which figure it shows. */
export function BalanceWidget() {
  const { t } = useTranslation();
  const { data, isLoading } = useAccountsSummary();
  const [mode, setMode] = useLocalStorage<BalanceMode>({ key: 'ww-balance-mode', defaultValue: 'netWorth' });

  const value = data?.[mode];
  const currency = data?.currency ?? 'UAH';

  return (
    <div className={classes.widget}>
      <Menu position="bottom-start" width={260} shadow="md">
        <Menu.Target>
          <UnstyledButton
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Text size="xs" fw={500} c="dimmed">
              {t(`balance.${mode}.label`)}
            </Text>
            <ChevronDown size={14} color="var(--ww-faint)" />
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {modes.map((item) => (
            <Menu.Item
              key={item}
              aria-label={t(`balance.${item}.label`)}
              aria-current={item === mode ? 'true' : undefined}
              leftSection={<span style={{ width: 16 }}>{item === mode && <Check size={16} />}</span>}
              onClick={() => setMode(item)}
            >
              <Text size="sm" fw={500}>
                {t(`balance.${item}.label`)}
              </Text>
              <Text size="xs" c="dimmed">
                {t(`balance.${item}.hint`)}
              </Text>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      {isLoading ? (
        <Skeleton height={26} width="70%" />
      ) : (
        <Text
          className={`num ${value !== undefined && value < 0 ? 'expense' : ''}`}
          fz={22}
          fw={600}
          lh={1.1}
          style={{ letterSpacing: '-0.01em' }}
        >
          {value === undefined ? '—' : formatMoney(value, currency)}
        </Text>
      )}
      {data?.unconvertedCurrencies?.length ? (
        <Text size="xs" c="dimmed">
          {t('balance.unconverted', { currencies: data.unconvertedCurrencies.join(', ') })}
        </Text>
      ) : null}
    </div>
  );
}
