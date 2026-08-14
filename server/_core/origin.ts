/** Returns true when a browser-supplied Origin header targets the receiving host. */
export function isSameOriginRequest(origin: string | undefined, host: string | undefined) {
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
