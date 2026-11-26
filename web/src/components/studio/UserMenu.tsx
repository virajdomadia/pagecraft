"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { api, type Me } from "@/lib/api";

export function Avatar({ name, colour, size = 30 }: { name: string; colour: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold text-ink ring-2 ring-paper"
      style={{ width: size, height: size, background: colour }}
    >
      {initials}
    </span>
  );
}

export function UserMenu({ me }: { me: Me }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current?.contains(e.target as Node) || setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      await api("/auth/sign-out", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex min-h-10 items-center gap-2 rounded-[3px] px-1.5 hover:bg-guide-soft"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={me.name} colour={me.avatar_colour} />
        <span className="hidden text-sm font-semibold sm:inline">{me.name}</span>
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div id={id} className="pc-rise absolute right-0 top-[calc(100%+6px)] z-40 w-64 rounded-[4px] border border-line bg-paper p-2 shadow-lg">
          <div className="border-b border-line px-2 pb-2">
            <p className="text-sm font-bold">{me.name}</p>
            <p className="truncate font-mono text-[11px] text-muted">{me.email}</p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {me.demo ? "Shared demo account" : `${me.plan === "pro" ? "Pro" : "Free"} plan`}
            </p>
          </div>
          <Link href="/" className="mt-1 block rounded-[3px] px-2 py-2 text-sm no-underline hover:bg-guide-soft">
            Pagecraft home
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="block w-full rounded-[3px] px-2 py-2 text-left text-sm hover:bg-guide-soft"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
