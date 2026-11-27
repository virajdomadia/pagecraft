"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage, type SitesOut } from "@/lib/api";

/**
 * The two landing-page demo logins (PRD decision 2): a reviewer never types a password.
 * Creator = Deepa, owner of Kaapi Corner. Collaborator = Rohan, editor on it. `together` adds
 * "Edit together, live" (L3): Deepa's editor, offering to open Rohan's in a second tab.
 */
export function DemoButtons({
  className = "",
  next = "/sites",
  tone = "studio",
  together = false,
}: {
  className?: string;
  next?: string;
  tone?: "studio" | "landing";
  together?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(as: "creator" | "collaborator", live = false) {
    setBusy(live ? "together" : as);
    setError(null);
    try {
      await api("/auth/demo", { method: "POST", json: { as } });
      const site = live ? (await api<SitesOut>("/sites")).sites[0] : undefined;
      router.push(site ? `/sites/${site.id}/edit?together=1` : next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  const btn =
    tone === "landing"
      ? "btn btn-line"
      : "inline-flex min-h-11 flex-1 flex-col items-start justify-center gap-0.5 rounded-[3px] border border-line bg-paper px-4 py-2.5 text-left transition hover:border-guide hover:bg-guide-soft disabled:opacity-60";
  return (
    <div className={className}>
      <div className={tone === "landing" ? "demo-buttons" : "flex flex-col gap-2 sm:flex-row"}>
        {together && (
          <button type="button" className={btn} onClick={() => go("creator", true)} disabled={busy !== null}>
            {busy === "together" ? "Opening…" : "Edit together, live"}
          </button>
        )}
        <button type="button" className={btn} onClick={() => go("creator")} disabled={busy !== null}>
          {tone === "landing" ? (
            busy === "creator" ? "Opening…" : "Try as the creator"
          ) : (
            <>
              <span className="text-sm font-bold">{busy === "creator" ? "Opening…" : "Demo creator"}</span>
              <span className="font-mono text-[11px] text-muted">Deepa · owns Kaapi Corner</span>
            </>
          )}
        </button>
        <button type="button" className={btn} onClick={() => go("collaborator")} disabled={busy !== null}>
          {tone === "landing" ? (
            busy === "collaborator" ? "Opening…" : "Try as the collaborator"
          ) : (
            <>
              <span className="text-sm font-bold">{busy === "collaborator" ? "Opening…" : "Demo collaborator"}</span>
              <span className="font-mono text-[11px] text-muted">Rohan · editor on Kaapi Corner</span>
            </>
          )}
        </button>
      </div>
      {error && (
        <p role="alert" className={tone === "landing" ? "demo-error" : "mt-2 text-sm text-coral-ink"}>
          {error}
        </p>
      )}
    </div>
  );
}
