import i18n from '../i18n';

/** RFC 9457 problem details returned by the backend, with its `code` and field `errors` extensions. */
export interface ApiProblem {
  status?: number;
  code?: string;
  title?: string;
  /** Already translated by the backend into the request language. */
  detail?: string;
  errors?: { field: string; message: string }[];
  /** ACCOUNT_DELETION_SCHEDULED: cancels the deletion and signs in at /api/v1/auth/restore. */
  restoreToken?: string;
  deletionScheduledAt?: string;
}

/** Turns whatever an API call or fetch threw into a problem with a message to show. */
export function toProblem(error: unknown): ApiProblem {
  if (error && typeof error === 'object' && ('code' in error || 'detail' in error)) {
    return error as ApiProblem;
  }
  return { code: 'NETWORK', detail: i18n.t('errors.network') };
}

/** Field validation messages keyed by field name, for form `setErrors`. */
export function fieldErrors(problem: ApiProblem): Record<string, string> {
  return Object.fromEntries((problem.errors ?? []).map(({ field, message }) => [field, message]));
}

export function problemMessage(problem: ApiProblem): string {
  return problem.detail ?? problem.title ?? i18n.t('errors.unexpected');
}
