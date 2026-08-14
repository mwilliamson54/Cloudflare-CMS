/** Returns true when a browser-supplied Origin header targets the receiving host. */
export function isSameOriginRequest(origin: string | undefined, host: string | undefined) {
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Double-submit token check for cookie-authenticated requests. */
export function hasValidCsrfToken(cookieToken: string | undefined, headerToken: string | undefined) {
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}
