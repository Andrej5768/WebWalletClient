import i18n from '../i18n';
import { utf8Length } from './token';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requiredEmail(value: string): string | null {
  if (!value.trim()) return i18n.t('validation.required');
  return EMAIL.test(value.trim()) ? null : i18n.t('validation.email');
}

export function newPassword(value: string): string | null {
  if (!value) return i18n.t('validation.required');
  if (value.length < 8) return i18n.t('validation.passwordShort');
  return utf8Length(value) > 72 ? i18n.t('validation.passwordLong') : null;
}

export function required(value: string): string | null {
  return value.trim() ? null : i18n.t('validation.required');
}
