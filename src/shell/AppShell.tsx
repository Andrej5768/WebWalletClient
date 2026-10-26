import { ActionIcon, Avatar, Button, Group, Skeleton, Text, Tooltip } from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { LogOut, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { DemoBanner } from '../auth/DemoBanner';
import { useAuth } from '../auth/context';
import { Logo } from '../components/Logo';
import { ColorSchemeSwitch, LanguageSwitch } from '../components/PreferenceSwitches';
import { AccountsWidget } from './AccountsWidget';
import { BalanceWidget } from './BalanceWidget';
import { mainNav, settingsNav, type NavItem } from './nav';
import classes from './shell.module.css';

function initials(first?: string | null, last?: string | null): string {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
}

function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useTranslation();
  const label = t(`nav.${item.key}`);
  const link = (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={classes.navItem}
      aria-label={collapsed ? label : undefined}
    >
      <item.icon size={16} strokeWidth={1.75} />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip label={label} position="right" withArrow>
      {link}
    </Tooltip>
  ) : (
    link
  );
}

/** Sidebar with the balance, navigation and accounts, the header, and the current page. */
export function AppShell() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // Until the viewer chooses, the menu folds to icons on screens narrower than 1280 px, so tables keep their columns
  const [chosen, setCollapsed] = useLocalStorage<boolean | null>({
    key: 'ww-sidebar-collapsed',
    defaultValue: null,
  });
  const narrow = useMediaQuery('(max-width: 1279.98px)', false, { getInitialValueInEffect: false });
  const collapsed = chosen ?? narrow;

  return (
    <div className={classes.layout}>
      <aside className={`${classes.sidebar} ${collapsed ? classes.collapsed : ''}`}>
        <div className={classes.brand}>
          {collapsed ? null : (
            <div style={{ flex: 1 }}>
              <Logo />
            </div>
          )}
          <Tooltip label={t('shell.collapse')} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t('shell.collapse')}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </ActionIcon>
          </Tooltip>
        </div>

        {!collapsed && <BalanceWidget />}

        <nav
          aria-label={t('shell.mainNav')}
          style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}
        >
          {mainNav.map((item) => (
            <NavEntry key={item.path} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {!collapsed && (
          <div style={{ marginTop: 16 }}>
            <AccountsWidget />
          </div>
        )}

        <div style={{ flex: 1 }} />
        <NavEntry item={settingsNav} collapsed={collapsed} />
        <Group
          gap={10}
          wrap="nowrap"
          justify="center"
          pt={12}
          mt={8}
          style={{ borderTop: '1px solid var(--ww-border)' }}
        >
          <Avatar size={30} radius="xl" color="gray">
            {initials(user?.firstName, user?.lastName)}
          </Avatar>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {[user?.firstName, user?.lastName].filter(Boolean).join(' ')}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {user?.email}
                </Text>
              </div>
              <Tooltip label={t('shell.signOut')} withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={t('shell.signOut')}
                  onClick={() => void signOut()}
                >
                  <LogOut size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      </aside>

      <div className={classes.main}>
        <DemoBanner />
        <header className={classes.header}>
          <div style={{ flex: 1 }} />
          <LanguageSwitch />
          <ColorSchemeSwitch />
          <Button leftSection={<Plus size={16} />} onClick={() => void navigate('/transactions?new=1')}>
            {t('shell.addTransaction')}
          </Button>
        </header>
        <main className={classes.content}>
          <Suspense fallback={<Skeleton height={320} radius="md" maw={1200} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
