import { lazy } from 'react';

// Sections load on demand; charts in particular are heavy.
export const DashboardPage = lazy(() =>
  import('../dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
export const SettingsPage = lazy(() =>
  import('../settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
export const ImportsPage = lazy(() =>
  import('../imports/ImportsPage').then((m) => ({ default: m.ImportsPage })),
);
export const AccountsPage = lazy(() =>
  import('../accounts/AccountsPage').then((m) => ({ default: m.AccountsPage })),
);
export const TransactionsPage = lazy(() =>
  import('../transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })),
);
export const BudgetPage = lazy(() => import('../budget/BudgetPage').then((m) => ({ default: m.BudgetPage })));
export const ReportsPage = lazy(() =>
  import('../reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
export const GoalsPage = lazy(() => import('../goals/GoalsPage').then((m) => ({ default: m.GoalsPage })));
export const InvestmentsPage = lazy(() =>
  import('../investments/InvestmentsPage').then((m) => ({ default: m.InvestmentsPage })),
);
export const InstrumentPage = lazy(() =>
  import('../investments/instrument/InstrumentPage').then((m) => ({ default: m.InstrumentPage })),
);
