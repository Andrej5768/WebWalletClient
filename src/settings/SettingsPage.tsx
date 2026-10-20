import { Stack, Tabs, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { CategoriesTab } from './CategoriesTab';
import { DataTab } from './DataTab';
import { PayeesTab } from './PayeesTab';
import { ProfileTab } from './ProfileTab';
import { RulesTab } from './RulesTab';
import { SecurityTab } from './SecurityTab';
import { TagsTab } from './TagsTab';

const tabs = ['profile', 'security', 'data', 'categories', 'rules', 'payees', 'tags'] as const;
type Tab = (typeof tabs)[number];

export function SettingsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (tabs as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'profile';

  return (
    <Stack gap="lg" maw={1100}>
      <Title order={1} size="h2">
        {t('nav.settings')}
      </Title>
      <Tabs
        value={tab}
        onChange={(value) => setParams(value && value !== 'profile' ? { tab: value } : {}, { replace: true })}
        keepMounted={false}
      >
        <Tabs.List mb="lg">
          {tabs.map((value) => (
            <Tabs.Tab key={value} value={value}>
              {t(`settings.tabs.${value}`)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="profile">
          <ProfileTab />
        </Tabs.Panel>
        <Tabs.Panel value="security">
          <SecurityTab />
        </Tabs.Panel>
        <Tabs.Panel value="data">
          <DataTab />
        </Tabs.Panel>
        <Tabs.Panel value="categories">
          <CategoriesTab />
        </Tabs.Panel>
        <Tabs.Panel value="rules">
          <RulesTab />
        </Tabs.Panel>
        <Tabs.Panel value="payees">
          <PayeesTab />
        </Tabs.Panel>
        <Tabs.Panel value="tags">
          <TagsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
