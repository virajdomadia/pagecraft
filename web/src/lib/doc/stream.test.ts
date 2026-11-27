import { describe, expect, it } from "vitest";
import { parseSse, type StreamEvent } from "@/lib/doc/stream";

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
