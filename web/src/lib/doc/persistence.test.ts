import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { fromBase64, storageKey, toBase64, UpdateQueue, type SendResult } from "@/lib/doc/persistence";

class MemoryStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function edits(n: number): { doc: Y.Doc; updates: Uint8Array[] } {
  const doc = new Y.Doc();
  const updates: Uint8Array[] = [];
  doc.on("update", (u: Uint8Array) => updates.push(u));
  const text = doc.getText("t");
  for (let i = 0; i < n; i++) text.insert(text.length, String(i));
  return { doc, updates };
}

function replay(base64s: string[]): string {
  const doc = new Y.Doc();
  for (const b of base64s) Y.applyUpdate(doc, fromBase64(b));
  return doc.getText("t").toString();
}

describe("UpdateQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("batches a burst of updates into one merged POST after 300 ms", async () => {
    const sent: string[] = [];
    const store = new MemoryStore();
    const q = new UpdateQueue("site1", async (b) => (sent.push(b), "ok"), store);
    const { updates } = edits(5);
    updates.forEach((u) => q.push(u));
    expect(q.getStatus()).toBe("saving");
    expect(store.getItem(storageKey("site1"))).not.toBeNull();
    await vi.advanceTimersByTimeAsync(299);
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(1);
    expect(replay(sent)).toBe("01234");
    expect(q.getStatus()).toBe("saved");
    expect(store.getItem(storageKey("site1"))).toBeNull();
  });

  it("keeps the batch when offline, shows Offline, and retries with backoff", async () => {
    const results: SendResult[] = ["retry", "retry", "ok"];
    const sent: string[] = [];
    const statuses: string[] = [];
    const q = new UpdateQueue("s", async (b) => (sent.push(b), results.shift()!), new MemoryStore());
    q.subscribe((s) => statuses.push(s));
    const { updates } = edits(2);
    updates.forEach((u) => q.push(u));
    await vi.advanceTimersByTimeAsync(300);
    expect(q.getStatus()).toBe("offline");
    q.push(edits(1).updates[0]); // typing continues while offline
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent).toHaveLength(3);
    expect(q.getStatus()).toBe("saved");
    expect(statuses).toEqual(["saving", "offline", "saved"]);
    expect(q.hasPending()).toBe(false);
  });

  it("restores what an earlier tab left in localStorage and re-sends it", async () => {
    const store = new MemoryStore();
    const { doc, updates } = edits(3);
    store.setItem(storageKey("s"), toBase64(Y.mergeUpdates(updates)));
    const sent: string[] = [];
    const q = new UpdateQueue("s", async (b) => (sent.push(b), "ok"), store);
    const restored = q.restore();
    expect(restored).not.toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(replay(sent)).toBe(doc.getText("t").toString());
    expect(store.getItem(storageKey("s"))).toBeNull();
  });

  it("drain() resolves once the server has everything (publish waits on it)", async () => {
    const q = new UpdateQueue("s", async () => "ok", new MemoryStore());
    q.push(edits(1).updates[0]);
    const done = q.drain();
    await vi.advanceTimersByTimeAsync(0);
    await expect(done).resolves.toBe(true);
  });

  it("a fatal answer (lost access) stops retrying and reports an error", async () => {
    const send = vi.fn(async (): Promise<SendResult> => "fatal");
    const q = new UpdateQueue("s", send, new MemoryStore());
    q.push(edits(1).updates[0]);
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(q.getStatus()).toBe("error");
  });

  it("base64 round-trips large updates", () => {
    const bytes = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
