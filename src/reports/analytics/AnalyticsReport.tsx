import { NavLink } from '@mantine/core';
import { ArrowLeftRight, ChartLine, GitCompare, PiggyBank } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router';
import classes from './analytics.module.css';
import { CashFlowView } from './CashFlowView';
import { CompareView } from './CompareView';
import { SavingsView } from './SavingsView';
import { TrendsView } from './TrendsView';

const views = [
  { value: 'cashflow', icon: ArrowLeftRight, element: <CashFlowView /> },
  { value: 'compare', icon: GitCompare, element: <CompareView /> },
  { value: 'trends', icon: ChartLine, element: <TrendsView /> },
  { value: 'savings', icon: PiggyBank, element: <SavingsView /> },
] as const;

/** The views of the analytics section: each has its own period. */
export function AnalyticsReport() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const current = views.find((view) => view.value === params.get('view')) ?? views[0];

  // Plan and actual moved to the budget, which shows them for many months
  if (params.get('view') === 'plan') return <Navigate to="/budget" replace />;

  const select = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === views[0].value) next.delete('view');
    else next.set('view', value);
    setParams(next, { replace: true });
  };

  return (
    <div className={classes.layout}>
      <nav className={classes.nav} aria-label={t('analytics.nav')}>
        {views.map(({ value, icon: Icon }) => (
          <NavLink
            key={value}
            component="button"
            label={t(`analytics.views.${value}`)}
            leftSection={<Icon size={16} strokeWidth={1.75} />}
            active={value === current.value}
            aria-current={value === current.value ? 'page' : undefined}
            onClick={() => select(value)}
            style={{ borderRadius: 6 }}
          />
        ))}
      </nav>
      <div className={classes.body}>{current.element}</div>
    </div>
  );
}
