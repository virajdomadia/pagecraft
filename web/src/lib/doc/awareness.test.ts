import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXPIRE_MS, Presence, type PresenceState, textOn, THROTTLE_MS } from "@/lib/doc/awareness";

const rohan = { id: "u2", name: "Rohan Mehta", colour: "#FF6B6B" };

describe("Presence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends at most one post per THROTTLE_MS, always the latest state", async () => {
    const sent: (PresenceState | null)[] = [];
    const p = new Presence(7, async (b) => (sent.push(b.state), 204));
    p.start();
    expect(sent).toHaveLength(1);
    for (let i = 0; i < 20; i++) p.set({ pointer: { s: "s_a", x: i / 20, y: 0.5 } });
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(THROTTLE_MS);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.pointer?.x).toBe(19 / 20);
    p.set({ pointer: undefined, section: "s_a" });
    await vi.advanceTimersByTimeAsync(THROTTLE_MS);
    expect(sent[2]).toEqual({ section: "s_a" });
    p.leave();
    expect(sent.at(-1)).toBeNull();
    p.set({ section: "s_b" }); // nothing after leaving
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent.at(-1)).toBeNull();
  });

  it("tracks other tabs, ignores its own echo, and drops quiet or departed peers", async () => {
    const p = new Presence(7, async () => 204);
    p.start();
    p.receive({ client: 7, user: rohan, state: { section: "mine" } });
    expect(p.list()).toHaveLength(0);
    p.receive({ client: 9, user: rohan, state: { section: "s_a" } });
    p.receive({ client: 10, user: rohan, state: {} });
    expect(p.list().map((x) => x.client)).toEqual([9, 10]);
    p.receive({ client: 10, user: rohan, state: null });
    expect(p.list().map((x) => x.client)).toEqual([9]);
    await vi.advanceTimersByTimeAsync(EXPIRE_MS + 5_000);
    expect(p.list()).toHaveLength(0);
    p.stop();
  });
});

describe("Presence posting", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("numbers every post, resends the latest after a 429, and stays silent before start()", async () => {
    const bodies: { n: number; section?: string }[] = [];
    const answers = [429, 204];
    const p = new Presence(7, async (b) => (bodies.push({ n: b.n, section: b.state?.section }), answers.shift() ?? 204));
    p.set({ section: "s_a" });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(bodies).toHaveLength(0); // hidden tab: not started
    p.start();
    await vi.advanceTimersByTimeAsync(999);
    expect(bodies).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(bodies).toEqual([
      { n: 1, section: "s_a" },
      { n: 2, section: "s_a" },
    ]);
    p.stop();
  });
});

describe("textOn", () => {
  it("picks the colour that keeps a name tag readable (AA)", () => {
    expect(textOn("#4338CA")).toBe("#ffffff");
    for (const light of ["#2EC4B6", "#FF6B6B", "#F59E0B", "#0EA5E9", "#A855F7"]) expect(textOn(light)).toBe("#1b1b2f");
  });
});
