import type { Schemas } from '../api/client';

export type IdentityProof = Schemas['ConfirmIdentityRequest'];

/** What confirms the identity: the password if there is one, else a code of two-factor authentication, else nothing. */
export type IdentityMethod = 'password' | 'code';

/** The method of the user, or null when there is nothing to confirm with; `codeAccepted` is false while 2FA can be off. */
export function identityMethod(
  user: Schemas['UserResponse'] | null,
  codeAccepted = true,
): IdentityMethod | null {
  if (user?.hasPassword) return 'password';
  if (codeAccepted && user?.twoFactorEnabled) return 'code';
  return null;
}
