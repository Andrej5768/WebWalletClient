import { createContext, useContext } from 'react';
import type { Schemas } from '../api/client';
import type { ApiProblem } from '../api/errors';

export interface AuthState {
  status: 'loading' | 'signedIn' | 'signedOut';
  user: Schemas['UserResponse'] | null;
  /** Returns the problem to show, or null when signed in. */
  signIn(email: string, password: string): Promise<ApiProblem | null>;
  signOut(): Promise<void>;
  setUser(user: Schemas['UserResponse']): void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}
