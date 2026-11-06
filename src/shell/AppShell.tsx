import { ActionIcon, Avatar, Button, Drawer, Group, Skeleton, Text, Tooltip } from '@mantine/core';
import { useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { DemoBanner } from '../auth/DemoBanner';
import { useAuth } from '../auth/context';
import { Logo } from '../components/Logo';
import { ColorSchemeSwitch, LanguageSwitch } from '../components/PreferenceSwitches';
import { usePhone } from '../lib/usePhone';
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

/** The balance, the sections, the accounts and the user: beside the page, or in the drawer on a phone. */
function SidebarContent({ collapsed, phone }: { collapsed: boolean; phone: boolean }) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  return (
    <>
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
      {phone && (
        <Group gap="xs" py="sm">
          <LanguageSwitch />
          <ColorSchemeSwitch />
        </Group>
      )}
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
    </>
  );
}

/**
 * Sidebar with the balance, navigation and accounts, the header, and the current page. On a phone the sidebar
 * moves into a drawer behind a menu button, and the header keeps only the menu, the logo and a new transaction.
 */
export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Until the viewer chooses, the menu folds to icons on screens narrower than 1280 px, so tables keep their columns
  const [chosen, setCollapsed] = useLocalStorage<boolean | null>({
    key: 'ww-sidebar-collapsed',
    defaultValue: null,
  });
  const narrow = useMediaQuery('(max-width: 1279.98px)', false, { getInitialValueInEffect: false });
  const phone = usePhone();
  const collapsed = chosen ?? narrow;
  const [menuOpened, menu] = useDisclosure(false);

  // A section picked in the drawer opens with the drawer closed.
  const closeMenu = menu.close;
  useEffect(() => closeMenu(), [pathname, closeMenu]);

  const addTransaction = () => void navigate('/transactions?new=1');

  return (
    <div className={classes.layout}>
      {phone ? (
        <Drawer
          opened={menuOpened}
          onClose={menu.close}
          size={300}
          title={<Logo />}
          classNames={{ body: classes.drawerBody }}
        >
          <SidebarContent collapsed={false} phone />
        </Drawer>
      ) : (
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
          <SidebarContent collapsed={collapsed} phone={false} />
        </aside>
      )}

      <div className={classes.main}>
        <DemoBanner />
        <header className={classes.header}>
          {phone ? (
            <>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label={t('shell.menu')}
                aria-expanded={menuOpened}
                onClick={menu.open}
              >
                <Menu size={20} />
              </ActionIcon>
              <Logo />
              <div style={{ flex: 1 }} />
              <ActionIcon size="lg" aria-label={t('shell.addTransaction')} onClick={addTransaction}>
                <Plus size={20} />
              </ActionIcon>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }} />
              <LanguageSwitch />
              <ColorSchemeSwitch />
              <Button leftSection={<Plus size={16} />} onClick={addTransaction}>
                {t('shell.addTransaction')}
              </Button>
            </>
          )}
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
