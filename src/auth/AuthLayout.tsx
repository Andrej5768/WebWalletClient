import { Card, Group } from '@mantine/core';
import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';
import { ColorSchemeSwitch, LanguageSwitch } from '../components/PreferenceSwitches';

/** Centered card with the logo and the language and theme switches, for every sign-in page. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" px={32} py={20} wrap="wrap">
        <Logo />
        <Group gap={8}>
          <LanguageSwitch />
          <ColorSchemeSwitch />
        </Group>
      </Group>
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px 96px',
        }}
      >
        <Card withBorder radius="md" padding={32} w="100%" maw={400}>
          {children}
        </Card>
      </main>
    </div>
  );
}
