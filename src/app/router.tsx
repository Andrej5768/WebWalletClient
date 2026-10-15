import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { AccountsPage } from '../accounts/AccountsPage';
import { TransactionsPage } from '../transactions/TransactionsPage';
import { BudgetPage } from '../budget/BudgetPage';
import { AuthProvider } from '../auth/AuthProvider';
import { ForgotPasswordPage } from '../auth/pages/ForgotPasswordPage';
import { LoginPage } from '../auth/pages/LoginPage';
import { RegisterPage } from '../auth/pages/RegisterPage';
import { ResetPasswordPage } from '../auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../auth/pages/VerifyEmailPage';
import { GuestOnly, RequireAuth } from '../auth/RequireAuth';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { AppShell } from '../shell/AppShell';

const sections = ['reports', 'goals', 'imports', 'settings'];

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
          { index: true, element: <ComingSoonPage section="dashboard" /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'budget', element: <BudgetPage /> },
          ...sections.map((section) => ({ path: section, element: <ComingSoonPage section={section} /> })),
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
