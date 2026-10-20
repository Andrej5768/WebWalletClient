import { Center, Loader } from '@mantine/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './context';

/** Shows the children to a signed-in user. Everyone else gets `home` at the root and the sign-in page elsewhere. */
export function RequireAuth({ children, home }: { children: ReactNode; home?: ReactNode }) {
  const { status, sessionEnded } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <Center mih="100vh">
        <Loader size="sm" />
      </Center>
    );
  }
  if (status === 'signedOut') {
    if (home && location.pathname === '/') return home;
    if (sessionEnded) return <Navigate to="/" replace />;
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

/** Keeps signed-in users away from the sign-in and registration pages. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }
  return children;
}
