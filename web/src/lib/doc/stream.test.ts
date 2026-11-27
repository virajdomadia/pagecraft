import { afterEach, describe, expect, it, vi } from "vitest";
import { openStream, parseSse, type StreamEvent } from "@/lib/doc/stream";

describe("parseSse", () => {
  it("parses events split across network chunks, skipping pings and bad JSON", () => {
    const got: StreamEvent[] = [];
    const wire = 'event: hello\ndata: {"seq":3}\n\n: ping\n\nid: 4\nevent: update\ndata: {"seq":4,"data":"AA=="}\n\nevent: update\ndata: {oops\n\nevent: gone\ndata: {}\n\n';
    let rest = "";
    for (let i = 0; i < wire.length; i += 7) rest = parseSse(rest + wire.slice(i, i + 7), (e) => got.push(e));
    expect(rest).toBe("");
    expect(got).toEqual([
      { event: "hello", data: { seq: 3 }, id: undefined },
      { event: "update", data: { seq: 4, data: "AA==" }, id: "4" },
      { event: "gone", data: {}, id: undefined },
    ]);
  });
});

describe("openStream", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("backs off while the API fails, resumes from the last applied seq, and stops on 404", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // no jitter
    const urls: string[] = [];
    const answers = [() => Promise.reject(new Error("down")), () => Promise.reject(new Error("down")), () => Promise.resolve(new Response(null, { status: 404 }))];
    vi.stubGlobal("fetch", (url: string) => (urls.push(url), answers[urls.length - 1]()));
    let gone = false;
    let seq = 7;
    openStream({ siteId: "s", from: () => seq, onEvent: () => {}, onGone: () => (gone = true) });
    await vi.advanceTimersByTimeAsync(0);
    expect(urls).toHaveLength(1);
    seq = 9;
    await vi.advanceTimersByTimeAsync(499);
    expect(urls).toHaveLength(1); // ≥ 500 ms before the first retry
    await vi.advanceTimersByTimeAsync(1);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain("from=9");
    await vi.advanceTimersByTimeAsync(999);
    expect(urls).toHaveLength(2); // the second wait doubles
    await vi.advanceTimersByTimeAsync(1);
    expect(urls).toHaveLength(3);
    expect(gone).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(urls).toHaveLength(3);
  });
});
