import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Reads the one-time token that email links carry in the URL fragment: `/verify-email#token=…`. */
export function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token && token.trim() ? token.trim() : null;
}

/** Bytes a password takes in UTF-8; BCrypt only uses the first 72. */
export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Removes the one-time token from the address bar and history once the page has read it, so the link
 * does not stay usable in the browser history or in synced history on other devices.
 */
export function useStripTokenFromUrl(): void {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.hash)
      void navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);
}
