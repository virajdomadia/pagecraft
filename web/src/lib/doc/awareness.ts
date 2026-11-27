/**
 * Presence (L2, 04 §5): who else has this site open, where their pointer is, which section they
 * selected and where their caret sits. Plain JSON over `POST /sites/{id}/awareness` (throttled to
 * one post per 100 ms, a heartbeat every 15 s, `null` on leave) and back over the stream as `aw`
 * events, which the server stamps with the poster's name and colour. A peer that goes quiet for
 * 30 s is dropped.
 */

export type RelPosJson = Record<string, unknown>;
export type PresenceState = {
  section?: string;
  /** Pointer as fractions of a section's box, so it lands right at any canvas width or zoom. */
  pointer?: { s: string; x: number; y: number };
  caret?: { anchor: RelPosJson; head: RelPosJson };
};
export type PeerUser = { id: string; name: string; colour: string };
export type Peer = { client: number; user: PeerUser; state: PresenceState; at: number };
export type AwarenessEvent = { client: number; user: PeerUser; state: PresenceState | null };

export const THROTTLE_MS = 100;
export const HEARTBEAT_MS = 15_000;
export const EXPIRE_MS = 30_000;

export type PresenceBody = { client: number; n: number; state: PresenceState | null };
/** Resolves to the HTTP status (0 when offline). */
type Post = (body: PresenceBody, leaving: boolean) => Promise<number>;

export class Presence {
  private peers = new Map<number, Peer>();
  private snapshot: Peer[] = [];
  private local: PresenceState = {};
  private lastSent = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private beat: ReturnType<typeof setInterval> | null = null;
  private sweep: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private left = false;
  private started = false;
  private n = 0;

  constructor(
    readonly client: number,
    private post: Post,
  ) {}

  start(): void {
    this.left = false;
    this.started = true;
    this.send();
    this.beat ??= setInterval(() => this.send(), HEARTBEAT_MS);
    this.sweep ??= setInterval(() => this.expire(), 5_000);
  }

  /** Change this tab's presence; `undefined` clears a key. Sent at most every THROTTLE_MS. */
  set(patch: Partial<PresenceState>): void {
    const next: PresenceState = { ...this.local, ...patch };
    for (const k of Object.keys(next) as (keyof PresenceState)[]) if (next[k] === undefined) delete next[k];
    if (JSON.stringify(next) === JSON.stringify(this.local)) return;
    this.local = next;
    if (this.left || this.timer) return;
    this.timer = setTimeout(() => this.send(), Math.max(0, THROTTLE_MS - (Date.now() - this.lastSent)));
  }

  leave(): void {
    if (this.left) return;
    this.left = true;
    this.stop();
    void this.post({ client: this.client, n: ++this.n, state: null }, true);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.beat) clearInterval(this.beat);
    if (this.sweep) clearInterval(this.sweep);
    this.timer = this.beat = this.sweep = null;
    this.started = false;
  }

  receive(e: AwarenessEvent): void {
    if (e.client === this.client) return;
    if (e.state === null) this.peers.delete(e.client);
    else this.peers.set(e.client, { client: e.client, user: e.user, state: e.state, at: Date.now() });
    this.changed();
  }

  /** Every other tab, oldest first; stable between changes (for useSyncExternalStore). */
  list = (): Peer[] => this.snapshot;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private expire(): void {
    const cutoff = Date.now() - EXPIRE_MS;
    let gone = false;
    for (const [k, p] of this.peers) if (p.at < cutoff) gone = this.peers.delete(k) || gone;
    if (gone) this.changed();
  }

  private send(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.left || !this.started) return; // a tab opened in the background stays invisible
    this.lastSent = Date.now();
    const n = ++this.n;
    void this.post({ client: this.client, n, state: this.local }, false).then((status) => {
      // 429: the server dropped it as too soon (or too many tabs); send the latest again later.
      if (status === 429 && n === this.n && !this.timer && !this.left) this.timer = setTimeout(() => this.send(), 1_000);
    });
  }

  private changed(): void {
    this.snapshot = [...this.peers.values()];
    this.listeners.forEach((fn) => fn());
  }
}

/** Ink or white, whichever reads better on a presence colour (WCAG contrast). */
export function textOn(hex: string): string {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const bg = /^#[0-9a-f]{6}$/i.test(hex) ? lum(hex) : 0;
  const ink = lum("#1b1b2f");
  return (bg + 0.05) / (ink + 0.05) >= 1.05 / (bg + 0.05) ? "#1b1b2f" : "#ffffff";
}
