import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import {
  AccountsPage,
  BudgetPage,
  DashboardPage,
  GoalsPage,
  ImportsPage,
  InstrumentPage,
  InvestmentsPage,
  ReportsPage,
  SettingsPage,
  TaxesPage,
  TransactionsPage,
} from './pages';
import { AuthProvider } from '../auth/AuthProvider';
import { ForgotPasswordPage } from '../auth/pages/ForgotPasswordPage';
import { LoginPage } from '../auth/pages/LoginPage';
import { RegisterPage } from '../auth/pages/RegisterPage';
import { ResetPasswordPage } from '../auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../auth/pages/VerifyEmailPage';
import { GuestOnly, RequireAuth } from '../auth/RequireAuth';
import { AppShell } from '../shell/AppShell';

export const routes = [
  {
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      {
        path: '/login',
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        path: '/register',
        element: (
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        ),
      },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      // Links from emails; they work whether or not someone is signed in.
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'budget', element: <BudgetPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'goals', element: <GoalsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'imports', element: <ImportsPage /> },
          { path: 'investments', element: <InvestmentsPage /> },
          { path: 'investments/instruments/:id', element: <InstrumentPage /> },
          { path: 'taxes', element: <TaxesPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
