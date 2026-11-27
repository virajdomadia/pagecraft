import * as Y from "yjs";

/**
 * Autosave (R4, 04 §4). Local Yjs updates are queued, merged with `Y.mergeUpdates` and posted
 * every 100 ms (short, so a teammate sees typing within ~250 ms) as one blob to `POST /sites/{id}/updates`. While a batch is in flight or failing,
 * the pending update is mirrored to localStorage (`pc:queue:{siteId}:{tab}`: one key per tab, so
 * two tabs on one site never overwrite each other's copy), so a crash, a closed tab
 * or a dead connection loses nothing: the next load re-applies and re-sends it. Re-sending is
 * always safe — applying a Yjs update twice is a no-op.
 */

export type SaveStatus = "saved" | "saving" | "offline" | "error";

// fatal: lost access, keep the batch for after sign-in. rejected: the API refused the content
// (413/422/409), so it can never succeed; drop it rather than block every later save.
export type SendResult = "ok" | "retry" | "fatal" | "rejected";
export type Sender = (updateBase64: string) => Promise<SendResult>;

export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export const FLUSH_MS = 100;
const MAX_BACKOFF_MS = 30_000;
// Under the API's 256 KB per request, with room for base64 + JSON.
const MAX_BATCH_BYTES = 180 * 1024;

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function storageKey(siteId: string): string {
  return `pc:queue:${siteId}`;
}

export class UpdateQueue {
  private pending: Uint8Array[] = [];
  private inflight: Uint8Array | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 1000;
  private stopped = false;
  private status: SaveStatus = "saved";
  private listeners = new Set<(s: SaveStatus) => void>();
  private idleWaiters: (() => void)[] = [];
  private key: string;

  constructor(
    private siteId: string,
    private send: Sender,
    private store: KeyValueStore | null,
  ) {
    this.key = `${storageKey(siteId)}:${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Whatever any tab of this site left behind (a crash, a closed tab, a tab still open): taken
   * over and re-sent from here; re-sending what the server already has is a no-op.
   * Apply the result to the doc after loading.
   */
  restore(): Uint8Array | null {
    const updates: Uint8Array[] = [];
    for (const k of this.savedKeys()) {
      try {
        const saved = this.store?.getItem(k);
        if (saved) updates.push(fromBase64(saved));
      } catch {
        /* unreadable: dropped below */
      }
      this.safeRemove(k);
    }
    if (!updates.length) return null;
    const update = updates.length === 1 ? updates[0] : Y.mergeUpdates(updates);
    this.pending.push(update);
    this.persistLocal();
    this.setStatus("saving");
    this.schedule(0);
    return update;
  }

  private savedKeys(): string[] {
    const base = storageKey(this.siteId);
    const keys: string[] = [];
    try {
      for (let i = 0; i < (this.store?.length ?? 0); i++) {
        const k = this.store?.key(i);
        if (k && (k === base || k.startsWith(`${base}:`))) keys.push(k);
      }
    } catch {
      /* storage blocked */
    }
    return keys;
  }

  push(update: Uint8Array): void {
    if (this.stopped) return;
    this.pending.push(update);
    this.persistLocal();
    this.setStatus(this.status === "offline" ? "offline" : "saving");
    this.schedule(FLUSH_MS);
  }

  getStatus(): SaveStatus {
    return this.status;
  }

  subscribe(fn: (s: SaveStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  hasPending(): boolean {
    return this.pending.length > 0 || this.inflight !== null;
  }

  /** Flush now and resolve once nothing is pending (publish waits on this). */
  async drain(): Promise<boolean> {
    if (!this.hasPending()) return true;
    const done = new Promise<void>((resolve) => this.idleWaiters.push(resolve));
    this.schedule(0);
    await Promise.race([done, new Promise((r) => setTimeout(r, 10_000))]);
    return !this.hasPending();
  }

  /** The merged pending update, for `navigator.sendBeacon` on pagehide. */
  pendingBase64(): string | null {
    const all = [...(this.inflight ? [this.inflight] : []), ...this.pending];
    return all.length ? toBase64(all.length === 1 ? all[0] : Y.mergeUpdates(all)) : null;
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  private schedule(ms: number): void {
    if (this.timer) {
      if (ms > 0) return; // a flush is already coming
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private async flush(): Promise<void> {
    if (this.inflight || this.pending.length === 0) return;
    let n = 1;
    for (let size = this.pending[0].length; n < this.pending.length && size + this.pending[n].length <= MAX_BATCH_BYTES; n++)
      size += this.pending[n].length;
    const parts = this.pending.splice(0, n);
    const batch = parts.length === 1 ? parts[0] : Y.mergeUpdates(parts);
    this.inflight = batch;
    let result: SendResult;
    try {
      result = await this.send(toBase64(batch));
    } catch {
      result = "retry";
    }
    this.inflight = null;
    if (result === "ok") {
      this.backoff = 1000;
      this.persistLocal();
      if (this.pending.length) {
        this.setStatus("saving");
        this.schedule(0);
      } else {
        this.setStatus("saved");
        this.idleWaiters.splice(0).forEach((fn) => fn());
      }
      return;
    }
    if (result === "rejected") {
      // Later edits may build on the refused one, so stop here; a reload resyncs from the server.
      this.pending = [];
      this.stopped = true;
      this.safeRemove();
      this.setStatus("error");
      this.idleWaiters.splice(0).forEach((fn) => fn());
      return;
    }
    // Keep it, in order, and try again.
    this.pending.unshift(batch);
    this.persistLocal();
    if (result === "fatal") {
      this.setStatus("error");
      this.idleWaiters.splice(0).forEach((fn) => fn());
      return;
    }
    this.setStatus("offline");
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.schedule(wait);
  }

  private persistLocal(): void {
    const merged = this.pendingBase64();
    if (merged) this.safeSet(merged);
    else this.safeRemove();
  }

  private setStatus(s: SaveStatus): void {
    if (s === this.status) return;
    this.status = s;
    this.listeners.forEach((fn) => fn(s));
  }

  private safeSet(v: string): void {
    try {
      this.store?.setItem(this.key, v);
    } catch {
      /* storage full or blocked: the in-memory queue still has it */
    }
  }
  private safeRemove(key = this.key): void {
    try {
      this.store?.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
