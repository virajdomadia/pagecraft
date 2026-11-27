/**
 * "Open as your teammate" (L3): a second tab signed in as the other demo user of this sandbox.
 * Cookies are shared by every tab, so that tab keeps its session in sessionStorage (per tab) and
 * sends it in a header; the API accepts the header for demo sessions only. The session arrives
 * in the URL fragment (never sent to a server) and is moved out of the address bar at once.
 * It belongs to one site's editor: anywhere else (dashboard, sign-in, another site) the tab is
 * the cookie's user again, so the two identities never mix on one page.
 */

const KEY = "pc:tab-session";
export const TAB_HEADER = "x-pagecraft-session";

function editingSite(): string | null {
  return /^\/sites\/([^/]+)\/edit\/?$/.exec(window.location.pathname)?.[1] ?? null;
}

export function tabSession(): string | null {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null") as { site: string; token: string } | null;
    return saved && saved.site === editingSite() ? saved.token : null;
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
  const site = editingSite();
  if (!m || !site) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ site, token: m[1] }));
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
