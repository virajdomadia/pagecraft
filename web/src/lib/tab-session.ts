/**
 * "Open as your teammate" (L3): a second tab signed in as the other demo user of this sandbox.
 * Cookies are shared by every tab, so that tab keeps its session in sessionStorage (per tab) and
 * sends it in a header; the API accepts the header for demo sessions only. The session arrives
 * in the URL fragment (never sent to a server) and is moved out of the address bar at once.
 */

const KEY = "pc:tab-session";
export const TAB_HEADER = "x-pagecraft-session";

export function tabSession(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function tabHeaders(): Record<string, string> {
  const token = typeof window === "undefined" ? null : tabSession();
  return token ? { [TAB_HEADER]: token } : {};
}

/** Take a `#teammate=<token>` handed over by "Open as …", if this tab was opened with one. */
export function adoptTabSession(): void {
  const m = /^#teammate=([\w-]+)$/.exec(window.location.hash);
  if (!m) return;
  try {
    window.sessionStorage.setItem(KEY, m[1]);
  } catch {
    /* storage blocked: this tab stays the cookie's user */
  }
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function forgetTabSession(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
