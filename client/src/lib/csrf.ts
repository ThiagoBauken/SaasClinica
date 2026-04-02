/**
 * CSRF Token utilities for frontend
 * Reads the CSRF token from cookie and includes it in requests
 */

const CSRF_COOKIE_NAME = '_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Get headers object with CSRF token included
 */
export function getCsrfHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = getCsrfToken();
  if (token) {
    headers[CSRF_HEADER_NAME] = token;
  }
  return headers;
}

/**
 * Initialize CSRF token by fetching from server
 * Call this once on app startup
 */
export async function initCsrfToken(): Promise<void> {
  try {
    await fetch('/api/csrf-token', {
      credentials: 'include',
    });
  } catch {
    // Silently fail - token will be set on first GET request
  }
}
