"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Editor } from "@/components/editor/Editor";
import { api, ApiError, type Me, type SiteDetail } from "@/lib/api";
import { adoptTabSession, forgetTabSession, tabSession } from "@/lib/tab-session";

type Who = { site: SiteDetail; me: Me } | "missing" | "signed-out" | "offline";

/**
 * The server rendered this page as the cookie's user (null when that user has no access). A
 * teammate tab (L3) is someone else: reload who and what it is with its own session before the
 * editor starts.
 */
export function TeammateGate({
  siteId,
  site,
  me,
  fresh,
  together,
}: {
  siteId: string;
  site: SiteDetail | null;
  me: Me | null;
  fresh: boolean;
  together: boolean;
}) {
  const router = useRouter();
  const [who, setWho] = useState<Who | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const cookieUser: Who = site && me ? { site, me } : me ? "missing" : "signed-out";
    adoptTabSession();
    if (!tabSession()) {
      setWho(cookieUser);
      return;
    }
    Promise.all([api<Me>("/auth/me"), api<SiteDetail>(`/sites/${siteId}`)])
      .then(([m, s]) => live && setWho({ me: m, site: s }))
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiError && [401, 404].includes(err.status)) {
          forgetTabSession(); // ended with its sandbox: this browser's own user again
          setWho(cookieUser);
        } else setWho("offline");
      });
    return () => {
      live = false;
    };
  }, [siteId, site, me, attempt]);

  useEffect(() => {
    if (who === "signed-out") router.replace(`/sign-in?next=${encodeURIComponent(`/sites/${siteId}/edit`)}`);
  }, [who, router, siteId]);

  if (who === "missing") notFound();
  if (who === "offline")
    return (
      <div className="grid min-h-dvh place-items-center bg-desk p-6 text-center" role="alert">
        <div>
          <p className="text-lg font-bold">Couldn&apos;t reach Pagecraft.</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-3 font-semibold text-guide">
            Try again
          </button>
        </div>
      </div>
    );
  if (!who || who === "signed-out")
    return (
      <div className="bp-grid grid min-h-dvh place-items-center" role="status">
        <p className="font-mono text-xs text-muted">Opening {site?.name ?? "the editor"}…</p>
      </div>
    );
  return <Editor site={who.site} me={who.me} fresh={fresh} together={together} />;
}
