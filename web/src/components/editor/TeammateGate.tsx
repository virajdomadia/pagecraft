"use client";

import { useEffect, useState } from "react";
import { Editor } from "@/components/editor/Editor";
import { api, type Me, type SiteDetail } from "@/lib/api";
import { adoptTabSession, forgetTabSession, tabSession } from "@/lib/tab-session";

/**
 * The server rendered this page with the cookie's user. A teammate tab (L3) is someone else:
 * reload who and what it is with its own session before the editor starts.
 */
export function TeammateGate({ site, me, fresh, together }: { site: SiteDetail; me: Me; fresh: boolean; together: boolean }) {
  const [who, setWho] = useState<{ site: SiteDetail; me: Me } | null>(null);

  useEffect(() => {
    adoptTabSession();
    if (!tabSession()) return setWho({ site, me });
    Promise.all([api<Me>("/auth/me"), api<SiteDetail>(`/sites/${site.id}`)])
      .then(([m, s]) => setWho({ me: m, site: s }))
      .catch(() => {
        forgetTabSession(); // expired with its sandbox: fall back to this browser's own user
        setWho({ site, me });
      });
  }, [site, me]);

  if (!who)
    return (
      <div className="bp-grid grid min-h-dvh place-items-center" role="status">
        <p className="font-mono text-xs text-muted">Opening {site.name}…</p>
      </div>
    );
  return <Editor site={who.site} me={who.me} fresh={fresh} together={together} />;
}
