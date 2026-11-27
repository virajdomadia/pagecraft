"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { exportDoc, LOAD, LOCAL, roots, type SiteContent } from "@/lib/doc/model";
import { fromBase64, type SaveStatus, type SendResult, UpdateQueue } from "@/lib/doc/persistence";
import { type AwarenessEvent, Presence } from "@/lib/doc/awareness";
import { openStream } from "@/lib/doc/stream";
import { tabHeaders } from "@/lib/tab-session";

/**
 * The editor's document (04 §3): one Y.Doc per open site, loaded from `GET /sites/{id}/doc`
 * (snapshot + tail), saved through the UpdateQueue, undone by a Y.UndoManager that tracks only
 * this tab's own transactions (origin LOCAL). Teammates' edits arrive over the live stream (L1)
 * and are applied with origin LOAD: never queued back, never undone by this tab.
 */

/** A tab hidden this long lets its stream go (each open stream polls the database). */
const HIDDEN_CLOSE_MS = 60_000;

const GONE = "This site doesn't exist or you no longer have access.";

type Loaded = { doc: Y.Doc; undo: Y.UndoManager; queue: UpdateQueue; presence: Presence };

export type SiteDoc = {
  status: "loading" | "ready" | "error";
  error: string | null;
  doc: Y.Doc | null;
  /** Who else is here (L2): peers in, this tab's pointer / section / caret out. */
  presence: Presence | null;
  content: SiteContent | null;
  save: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /** Run `fn` as one local, undoable transaction. */
  change: (fn: (r: ReturnType<typeof roots>) => void) => void;
  /** Resolve once every local change has reached the API (publish waits on it). */
  flush: () => Promise<boolean>;
  /** A stable function for the undo manager to stop merging into the previous step. */
  stopCapturing: () => void;
};

async function send(siteId: string, b64: string): Promise<SendResult> {
  try {
    const res = await fetch(`/api/sites/${siteId}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tabHeaders() },
      body: JSON.stringify({ updates: [b64] }),
      credentials: "same-origin",
    });
    if (res.ok) return "ok";
    if ([409, 413, 422].includes(res.status)) return "rejected";
    if ([401, 403, 404].includes(res.status)) return "fatal";
    return "retry";
  } catch {
    return "retry";
  }
}

function localStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useSiteDoc(siteId: string): SiteDoc {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const listeners = useRef(new Set<() => void>());
  const [save, setSave] = useState<SaveStatus>("saved");
  const [stacks, setStacks] = useState({ undo: 0, redo: 0 });

  useEffect(() => {
    let disposed = false;
    const doc = new Y.Doc();
    const queue = new UpdateQueue(siteId, (b) => send(siteId, b), localStore());
    const unsubscribeSave = queue.subscribe(setSave);
    const presence = new Presence(doc.clientID, (body, leaving) =>
      fetch(`/api/sites/${siteId}/awareness`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tabHeaders() },
        body: JSON.stringify(body),
        credentials: "same-origin",
        keepalive: leaving, // outlives the tab on pagehide
      }).then(
        (r) => r.status,
        () => 0, // presence is best effort: the next heartbeat repairs it
      ),
    );

    const bump = () => {
      version.current++;
      listeners.current.forEach((fn) => fn());
    };
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== LOAD) queue.push(update);
      bump();
    });

    const beacon = () => {
      const pending = queue.pendingBase64();
      if (!pending) return;
      // keepalive fetch, not sendBeacon: it outlives the tab the same way and can carry the
      // teammate tab's session header.
      void fetch(`/api/sites/${siteId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tabHeaders() },
        body: JSON.stringify({ updates: [pending] }),
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => {}); // still in localStorage: the next load re-sends it
    };
    // The live stream: started once the document has loaded, paused while the tab is hidden.
    let applied = 0;
    let ready = false;
    let closeStream: (() => void) | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const startStream = () => {
      if (disposed || closeStream) return;
      closeStream = openStream({
        siteId,
        from: () => applied,
        headers: tabHeaders,
        onEvent: (e) => {
          if (e.event === "aw") presence.receive(e.data as AwarenessEvent);
          if (e.event !== "update") return;
          const { seq, data } = e.data as { seq: number; data: string };
          Y.applyUpdate(doc, fromBase64(data), LOAD);
          applied = Math.max(applied, seq);
        },
        onGone: () => setError(GONE),
      });
    };
    const stopStream = () => {
      closeStream?.();
      closeStream = null;
      presence.leave();
    };
    const leave = () => {
      beacon();
      presence.leave();
    };

    const onVisibility = () => {
      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = null;
      if (document.visibilityState === "hidden") {
        beacon();
        hiddenTimer = setTimeout(stopStream, HIDDEN_CLOSE_MS);
      } else if (ready) {
        startStream();
        presence.start();
      }
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisibility);

    (async () => {
      try {
        const res = await fetch(`/api/sites/${siteId}/doc`, { credentials: "same-origin", cache: "no-store", headers: tabHeaders() });
        if (!res.ok) throw new Error(res.status === 404 ? GONE : "Couldn't load the site.");
        const body = (await res.json()) as { snapshot: string; updates: string[]; seq: number };
        if (disposed) return;
        roots(doc); // declare the root types before integrating
        doc.transact(() => {
          if (body.snapshot) Y.applyUpdate(doc, fromBase64(body.snapshot), LOAD);
          for (const u of body.updates) Y.applyUpdate(doc, fromBase64(u), LOAD);
        }, LOAD);
        const leftover = queue.restore(); // edits a previous tab never got to send
        if (leftover) Y.applyUpdate(doc, leftover, LOAD);

        const { site, sections } = roots(doc);
        const undo = new Y.UndoManager([site, sections], { trackedOrigins: new Set([LOCAL]), captureTimeout: 400 });
        const onStack = () => setStacks({ undo: undo.undoStack.length, redo: undo.redoStack.length });
        undo.on("stack-item-added", onStack);
        undo.on("stack-item-popped", onStack);
        bump();
        setLoaded({ doc, undo, queue, presence });
        applied = body.seq;
        ready = true;
        if (document.visibilityState !== "hidden") {
          startStream();
          presence.start();
        }
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : "Couldn't load the site.");
      }
    })();

    return () => {
      disposed = true;
      stopStream();
      if (hiddenTimer) clearTimeout(hiddenTimer);
      beacon();
      presence.leave();
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribeSave();
      queue.dispose();
      doc.destroy();
      setLoaded(null);
    };
  }, [siteId]);

  const subscribe = useCallback((fn: () => void) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);
  const v = useSyncExternalStore(
    subscribe,
    () => version.current,
    () => 0,
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const content = useMemo(() => (loaded ? exportDoc(loaded.doc) : null), [loaded, v]);

  const change = useCallback(
    (fn: (r: ReturnType<typeof roots>) => void) => {
      if (!loaded) return;
      loaded.doc.transact(() => fn(roots(loaded.doc)), LOCAL);
    },
    [loaded],
  );

  return {
    status: error ? "error" : loaded ? "ready" : "loading",
    error,
    doc: loaded?.doc ?? null,
    presence: loaded?.presence ?? null,
    content,
    save,
    canUndo: stacks.undo > 0,
    canRedo: stacks.redo > 0,
    undo: useCallback(() => loaded?.undo.undo(), [loaded]),
    redo: useCallback(() => loaded?.undo.redo(), [loaded]),
    change,
    flush: useCallback(async () => (loaded ? loaded.queue.drain() : true), [loaded]),
    stopCapturing: useCallback(() => loaded?.undo.stopCapturing(), [loaded]),
  };
}
