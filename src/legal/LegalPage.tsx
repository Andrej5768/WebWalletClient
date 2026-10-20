import { Anchor, Container, Group, List, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { ColorSchemeSwitch, LanguageSwitch } from '../components/PreferenceSwitches';
import { privacy, terms, type LegalDocument } from './content';

/** The privacy policy or the terms of service, open to everyone, in the language of the page. */
export function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  const { t, i18n } = useTranslation();
  const documents = page === 'privacy' ? privacy : terms;
  const document: LegalDocument = i18n.language === 'en' ? documents.en : documents.uk;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ww-bg)' }}>
      <Group justify="space-between" px={32} py={20} wrap="wrap">
        <Anchor component={Link} to="/" underline="never" c="inherit" aria-label="WebWallet">
          <Logo />
        </Anchor>
        <Group gap={8}>
          <LanguageSwitch />
          <ColorSchemeSwitch />
        </Group>
      </Group>
      <Container size={720} pb={80} pt={24}>
        <Stack gap="xl">
          <Stack gap={6}>
            <Title order={1}>{document.title}</Title>
            <Text size="sm" c="dimmed">
              {document.updated}
            </Text>
          </Stack>
          <Text>{document.intro}</Text>
          {document.sections.map((section) => (
            <Stack key={section.title} gap="sm">
              <Title order={2} size="h4">
                {section.title}
              </Title>
              {section.paragraphs?.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
              ))}
              {section.items && (
                <List spacing={6}>
                  {section.items.map((item) => (
                    <List.Item key={item}>{item}</List.Item>
                  ))}
                </List>
              )}
            </Stack>
          ))}
          <Group gap="lg" pt="md" style={{ borderTop: '1px solid var(--ww-border)' }}>
            <Anchor component={Link} to="/" size="sm">
              {t('legal.home')}
            </Anchor>
            <Anchor component={Link} to={page === 'privacy' ? '/terms' : '/privacy'} size="sm">
              {page === 'privacy' ? t('legal.terms') : t('legal.privacy')}
            </Anchor>
          </Group>
        </Stack>
      </Container>
    </div>
  );
}
