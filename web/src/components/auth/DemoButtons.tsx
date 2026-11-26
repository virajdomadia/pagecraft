"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";

/**
 * The two landing-page demo logins (PRD decision 2): a reviewer never types a password.
 * Creator = Deepa, owner of Kaapi Corner. Collaborator = Rohan, editor on it.
 */
export function DemoButtons({ className = "", next = "/sites", tone = "studio" }: { className?: string; next?: string; tone?: "studio" | "landing" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(as: "creator" | "collaborator") {
    setBusy(as);
    setError(null);
    try {
      await api("/auth/demo", { method: "POST", json: { as } });
      router.push(next);
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
