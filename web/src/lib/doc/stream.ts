/**
 * The live stream (04 §5): `GET /sites/{id}/stream?from=<seq>` as Server-Sent Events, read with
 * fetch rather than EventSource so a reconnect always resumes from the last seq this tab has
 * applied (and request headers stay ours). The server closes every ~280 s and proxies may cut it
 * sooner; either way we reconnect with `from=` and the server replays what was missed — or the
 * whole snapshot, if compaction folded those rows away — so a drop never loses an edit.
 */

export type StreamEvent = { event: string; data: unknown; id?: string };

/** Split an SSE byte stream into events; returns the unparsed remainder. */
export function parseSse(buffer: string, emit: (e: StreamEvent) => void): string {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let event = "message";
    let data = "";
    let id: string | undefined;
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(":")) continue; // comment (ping)
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data += (data ? "\n" : "") + value;
      else if (field === "id") id = value;
    }
    if (!data) continue;
    try {
      emit({ event, data: JSON.parse(data), id });
    } catch {
      /* a malformed event is skipped, never fatal */
    }
  }
  return rest;
}

export type StreamOptions = {
  siteId: string;
  /** The last seq this tab has applied; read on every (re)connect. */
  from: () => number;
  onEvent: (e: StreamEvent) => void;
  /** Access is gone (removed from the site, signed out): stop for good. */
  onGone: () => void;
  headers?: () => HeadersInit;
};

const MAX_BACKOFF_MS = 15_000;

/** Open the stream and keep it open until the returned function is called. */
export function openStream(opts: StreamOptions): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let backoff = 500;

  const run = async () => {
    while (!stopped) {
      controller = new AbortController();
      let healthy = false;
      try {
        const res = await fetch(`/api/sites/${opts.siteId}/stream?from=${opts.from()}`, {
          credentials: "same-origin",
          cache: "no-store",
          headers: opts.headers?.(),
          signal: controller.signal,
        });
        if ([401, 403, 404].includes(res.status)) {
          stopped = true;
          opts.onGone();
          return;
        }
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer = parseSse(buffer + value, (e) => {
            if (e.event === "hello") {
              healthy = true;
              backoff = 500;
            }
            if (e.event === "gone") {
              stopped = true;
              opts.onGone();
            } else opts.onEvent(e);
          });
          if (stopped) return;
        }
      } catch {
        if (stopped) return;
      }
      // A clean close (lifetime reached) reconnects at once; failures back off.
      if (!healthy) {
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
    }
  };
  void run();

  return () => {
    stopped = true;
    controller?.abort();
  };
}
