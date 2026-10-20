import { Anchor, Button, Group, Progress, Stack, Text, Title } from '@mantine/core';
import {
  BriefcaseBusiness,
  CalendarClock,
  ChartColumn,
  ChartPie,
  Code,
  CreditCard,
  FileText,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Tag,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DonutIcon } from '../components/icons';
import { Logo } from '../components/Logo';
import { ColorSchemeSwitch, LanguageSwitch } from '../components/PreferenceSwitches';
import { locale } from '../i18n';
import classes from './landing.module.css';

const SERVER_REPO = 'https://github.com/Andrej5768/WebWallet';
const CLIENT_REPO = 'https://github.com/Andrej5768/WebWalletClient';

const AUDIENCE: { key: string; icon: LucideIcon }[] = [
  { key: 'banks', icon: CreditCard },
  { key: 'investors', icon: TrendingUp },
  { key: 'fop', icon: BriefcaseBusiness },
];

const FEATURES: { key: string; icon: ComponentType<{ size?: number }> }[] = [
  { key: 'sync', icon: RefreshCw },
  { key: 'categories', icon: Tag },
  { key: 'envelopes', icon: DonutIcon },
  { key: 'planning', icon: CalendarClock },
  { key: 'reports', icon: ChartColumn },
  { key: 'investments', icon: ChartPie },
  { key: 'taxes', icon: FileText },
  { key: 'privacy', icon: ShieldCheck },
];

const STEPS = ['tracking', 'fym', 'compound', 'fire'];

// Sample data of the app preview: income and expenses by month, then the accounts
const BARS = [
  [28, 18],
  [31, 17],
  [24, 20],
  [35, 16],
  [30, 19],
  [37, 17],
  [33, 22],
  [29, 16],
  [36, 15],
  [34, 18],
  [38, 14],
  [40, 13],
];

function Tile({ icon: Icon }: { icon: ComponentType<{ size?: number }> }) {
  return (
    <span className={classes.tile} aria-hidden>
      <Icon size={18} />
    </span>
  );
}

function SignInButtons() {
  const { t } = useTranslation();
  return (
    <Group gap={12}>
      <Button component={Link} to="/register">
        {t('landing.register')}
      </Button>
      <Button component={Link} to="/login" variant="default">
        {t('landing.signIn')}
      </Button>
    </Group>
  );
}

/** The illustration next to the title: an overview screen with sample data, hidden from screen readers. */
function AppPreview({ number }: { number: (value: number) => string }) {
  const { t } = useTranslation();
  const accounts = [
    { code: 'MB', name: 'Monobank Black', amount: 38420, currency: 'UAH' },
    { code: 'PB', name: t('landing.preview.privat'), amount: 126900, currency: 'UAH' },
    { code: 'IB', name: 'Interactive Brokers', amount: 7260, currency: 'USD' },
    { code: 'CR', name: t('landing.preview.credit'), amount: -4380, currency: 'UAH' },
  ];
  return (
    <figure className={classes.window} aria-hidden>
      <div className={classes.windowBar}>
        <span className={classes.dot} />
        <span className={classes.dot} />
        <span className={classes.dot} />
        <span style={{ marginLeft: 10 }}>{t('landing.preview.title')}</span>
      </div>
      <div className={classes.windowBody}>
        <Group justify="space-between" align="flex-end" gap={12}>
          <div>
            <Text size="xs" c="dimmed">
              {t('landing.preview.netWorth')}
            </Text>
            <div className={`num ${classes.big}`}>
              {number(482150)} <span className={classes.code}>UAH</span>
            </div>
          </div>
          <Text size="sm" fw={500} className="num income">
            {t('landing.preview.change')}
          </Text>
        </Group>
        <div className={classes.bars}>
          {BARS.map(([income, expense], index) => (
            <div key={index} className={classes.bar}>
              <div className={classes.barIncome} style={{ height: income }} />
              <div className={classes.barExpense} style={{ height: expense }} />
            </div>
          ))}
        </div>
        <div>
          {accounts.map((account) => (
            <div key={account.code} className={classes.accountRow}>
              <span className={classes.tile} style={{ width: 28, height: 28, fontSize: 11, fontWeight: 600 }}>
                {account.code}
              </span>
              <span style={{ flex: '1 1 auto', fontWeight: 500 }}>{account.name}</span>
              <span className={`num ${account.amount < 0 ? 'expense' : ''}`} style={{ fontWeight: 500 }}>
                {number(account.amount)}
              </span>
              <span className={classes.code} style={{ width: 32 }}>
                {account.currency}
              </span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

/** Example of the goal calculations, with a note that it is an example. */
function GoalsExample({ number }: { number: (value: number, digits?: number) => string }) {
  const { t } = useTranslation();
  return (
    <figure style={{ margin: 0 }}>
      <Stack gap={16} aria-hidden>
        <div className={classes.panel}>
          <Group justify="space-between" align="baseline" gap={12}>
            <Text fw={600}>FIRE</Text>
            <Text size="xs" c="dimmed">
              {t('landing.independence.example.fireBasis')}
            </Text>
          </Group>
          <div>
            <Text size="xs" c="dimmed">
              {t('landing.independence.example.fireCapital')}
            </Text>
            <div className={`num ${classes.big}`} style={{ fontSize: 28 }}>
              {number(6000000)} <span className={classes.code}>UAH</span>
            </div>
          </div>
          <Progress value={23} size="md" />
          <Group justify="space-between" gap={12}>
            <Text size="sm" c="dimmed">
              {t('landing.independence.example.fireSaved', { amount: number(1380000) })}
            </Text>
            <Text size="sm" c="dimmed">
              {t('landing.independence.example.fireYear', { year: 2041 })}
            </Text>
          </Group>
        </div>
        <div
          className={classes.cards}
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
        >
          <div className={classes.panel}>
            <Text fw={600}>FYM</Text>
            <div>
              <span className={`num ${classes.big}`} style={{ fontSize: 24 }}>
                {number(7.4, 1)}
              </span>{' '}
              <Text span size="sm" c="dimmed">
                {t('landing.independence.example.fymValue')}
              </Text>
            </div>
            <Progress value={62} size="sm" color="green" />
          </div>
          <div className={classes.panel}>
            <Text fw={600}>{t('landing.independence.example.compound')}</Text>
            <Text size="sm" c="dimmed">
              {t('landing.independence.example.compoundBasis')}
            </Text>
            <span className={`num ${classes.big}`} style={{ fontSize: 24 }}>
              {number(3797000)}
            </span>
          </div>
        </div>
      </Stack>
      <Text component="figcaption" size="xs" c="dimmed" mt={16}>
        {t('landing.independence.example.caption')}
      </Text>
    </figure>
  );
}

/** Home page for visitors who are not signed in: what the project is, for whom, what it does. */
export function LandingPage() {
  const { t, i18n } = useTranslation();
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale(i18n.language), {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={`${classes.container} ${classes.headerRow}`}>
          <Logo />
          <nav aria-label={t('landing.sections')} className={classes.nav}>
            {(['features', 'audience', 'independence', 'source'] as const).map((key) => (
              <a key={key} href={`#${key}`} className={classes.navLink}>
                {t(`landing.nav.${key}`)}
              </a>
            ))}
          </nav>
          <Group gap={8}>
            <LanguageSwitch />
            <ColorSchemeSwitch />
            <Button component={Link} to="/login" variant="subtle" size="sm">
              {t('landing.signIn')}
            </Button>
            <Button component={Link} to="/register" size="sm">
              {t('landing.register')}
            </Button>
          </Group>
        </div>
      </header>

      <main>
        <section className={`${classes.container} ${classes.hero}`}>
          <Stack gap={24}>
            <span className={classes.badge}>{t('landing.hero.badge')}</span>
            <Title order={1} className={classes.heroTitle}>
              {t('landing.hero.title')}
            </Title>
            <p className={classes.lead}>{t('landing.hero.text')}</p>
            <SignInButtons />
            <Text size="sm" c="dimmed">
              {t('landing.hero.note')}
            </Text>
          </Stack>
          <AppPreview number={number} />
        </section>

        <section id="audience" className={`${classes.section} ${classes.surface}`}>
          <div className={classes.container}>
            <div className={classes.sectionHead}>
              <Title order={2}>{t('landing.audience.title')}</Title>
              <Text c="dimmed">{t('landing.audience.text')}</Text>
            </div>
            <div
              className={classes.cards}
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
            >
              {AUDIENCE.map(({ key, icon }) => (
                <div key={key} className={classes.card} style={{ padding: 24 }}>
                  <Tile icon={icon} />
                  <h3 className={classes.cardTitle} style={{ fontSize: 17 }}>
                    {t(`landing.audience.${key}.title`)}
                  </h3>
                  <p className={classes.cardText}>{t(`landing.audience.${key}.text`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className={classes.section}>
          <div className={classes.container}>
            <div className={classes.sectionHead}>
              <Title order={2}>{t('landing.features.title')}</Title>
              <Text c="dimmed">{t('landing.features.text')}</Text>
            </div>
            <div className={classes.cards}>
              {FEATURES.map(({ key, icon }) => (
                <div key={key} className={classes.card}>
                  <Tile icon={icon} />
                  <h3 className={classes.cardTitle}>{t(`landing.features.${key}.title`)}</h3>
                  <p className={classes.cardText}>{t(`landing.features.${key}.text`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="independence" className={`${classes.section} ${classes.surface}`}>
          <div className={`${classes.container} ${classes.split}`}>
            <Stack gap={20}>
              <Title order={2}>{t('landing.independence.title')}</Title>
              <Text c="dimmed">{t('landing.independence.text1')}</Text>
              <Text c="dimmed">{t('landing.independence.text2')}</Text>
              <ol className={classes.steps}>
                {STEPS.map((key, index) => (
                  <li key={key} className={classes.step}>
                    <span className={`num ${classes.stepNumber}`} aria-hidden>
                      {index + 1}
                    </span>
                    <span>
                      <Text fw={600}>{t(`landing.independence.steps.${key}.title`)}</Text>
                      <Text size="sm" c="dimmed">
                        {t(`landing.independence.steps.${key}.text`)}
                      </Text>
                    </span>
                  </li>
                ))}
              </ol>
            </Stack>
            <GoalsExample number={number} />
          </div>
        </section>

        <section id="source" className={classes.section}>
          <div className={`${classes.container} ${classes.split}`}>
            <Stack gap={12}>
              <Title order={2}>{t('landing.source.title')}</Title>
              <Text c="dimmed">{t('landing.source.text')}</Text>
              <p className={classes.license}>{t('landing.source.license')}</p>
            </Stack>
            <Stack gap={12}>
              {[
                { url: SERVER_REPO, label: t('landing.source.server'), icon: Code },
                { url: CLIENT_REPO, label: t('landing.source.client'), icon: Monitor },
              ].map(({ url, label, icon }) => (
                <a key={url} href={url} className={classes.repo} target="_blank" rel="noreferrer">
                  <Tile icon={icon} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text fw={600}>{label}</Text>
                    <span className={classes.repoUrl}>{url.replace('https://', '')}</span>
                  </span>
                </a>
              ))}
            </Stack>
          </div>
        </section>

        <section className={`${classes.section} ${classes.surface}`}>
          <div className={`${classes.container} ${classes.ctaRow}`}>
            <Stack gap={6}>
              <Title order={2} size="h3">
                {t('landing.cta.title')}
              </Title>
              <Text c="dimmed">{t('landing.cta.text')}</Text>
            </Stack>
            <SignInButtons />
          </div>
        </section>
      </main>

      <footer className={classes.footer}>
        <div className={`${classes.container} ${classes.footerRow}`}>
          <span>© 2026 WebWallet · {t('landing.footer')}</span>
          <Group gap={16}>
            <Anchor href={SERVER_REPO} c="dimmed" size="sm" target="_blank" rel="noreferrer">
              GitHub
            </Anchor>
            <Anchor component={Link} to="/login" c="dimmed" size="sm">
              {t('landing.signIn')}
            </Anchor>
          </Group>
        </div>
      </footer>
    </div>
  );
}
