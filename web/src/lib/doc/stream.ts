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
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue; // a malformed event is skipped, never fatal
    }
    emit({ event, data: parsed, id }); // a throwing handler ends this connection (see openStream)
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
/** A connection that lasted this long (or delivered an update) was healthy: reconnect at once. */
const HEALTHY_MS = 5_000;
/** The server pings every 20 s; this much silence means a dead connection nobody closed. */
export const SILENCE_MS = 45_000;

/** Open the stream and keep it open until the returned function is called. */
export function openStream(opts: StreamOptions): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let backoff = 500;

  const run = async () => {
    while (!stopped) {
      controller = new AbortController();
      const opened = Date.now();
      let delivered = false;
      const ctrl = controller;
      let silence = setTimeout(() => ctrl.abort(), SILENCE_MS);
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
          clearTimeout(silence);
          silence = setTimeout(() => ctrl.abort(), SILENCE_MS);
          // onEvent throwing (an update that won't apply) lands in the catch: reconnect from the
          // last seq that did apply, with backoff, rather than skip past it.
          buffer = parseSse(buffer + value, (e) => {
            if (stopped) return;
            if (e.event === "gone") {
              stopped = true;
              opts.onGone();
              return;
            }
            opts.onEvent(e);
            if (e.event === "update") delivered = true;
          });
          if (stopped) return;
        }
      } catch {
        if (stopped) return;
      } finally {
        clearTimeout(silence);
      }
      // A healthy connection that ended (lifetime reached) reconnects almost at once; one that
      // failed fast backs off, so a broken API is never hammered.
      const healthy = delivered || Date.now() - opened >= HEALTHY_MS;
      if (healthy) backoff = 500;
      await new Promise((r) => setTimeout(r, (healthy ? 250 : backoff) + Math.random() * 250));
      if (!healthy) backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  };
  void run();

  return () => {
    stopped = true;
    controller?.abort();
  };
}
