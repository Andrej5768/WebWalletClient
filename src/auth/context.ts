import { createContext, useContext } from 'react';
import type { Schemas } from '../api/client';
import type { ApiProblem } from '../api/errors';

/** Signed in, a problem to show, or the code of two-factor authentication is needed. */
export type SignInResult =
  | { status: 'signedIn' }
  | { status: 'problem'; problem: ApiProblem }
  | { status: 'twoFactor'; challenge: string };

export interface AuthState {
  status: 'loading' | 'signedIn' | 'signedOut';
  user: Schemas['UserResponse'] | null;
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Opens a demo sandbox with example data and signs in to it; no registration needed. */
  signInDemo(): Promise<SignInResult>;
  /** Exchanges the ticket the Google sign-in redirected with for a session. */
  completeGoogle(ticket: string): Promise<SignInResult>;
  /** Exchanges the challenge of {@link signIn} and a code for a session; returns the problem to show, or null. */
  completeTwoFactor(challenge: string, code: string, trustDevice: boolean): Promise<ApiProblem | null>;
  /** Cancels the deletion of the account with the token of the sign-in and signs in; returns the problem, or null. */
  restoreAccount(token: string): Promise<ApiProblem | null>;
  signOut(): Promise<void>;
  /** Ends the session the server has already ended (the account is to be deleted) and goes to the home page. */
  endSession(): void;
  /** True after {@link endSession} until the next sign-in: the signed-out app shows the home page. */
  sessionEnded: boolean;
  setUser(user: Schemas['UserResponse']): void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}
