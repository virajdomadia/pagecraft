"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { api, errorMessage, type ForgotOut } from "@/lib/api";

/**
 * L4 forgot / reset. The reset link only ever arrives by email; with email off the screen says
 * so plainly and never shows a link (that would hand any account to whoever typed its email).
 */

const field =
  "mt-1.5 block w-full rounded-[3px] border border-line bg-paper px-3 py-2.5 text-[15px] text-ink outline-none transition focus:border-guide focus:ring-2 focus:ring-guide-soft";
const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";
const button = "min-h-11 rounded-[3px] bg-guide px-4 py-2.5 font-bold text-white transition hover:bg-guide-hover disabled:opacity-60";
const card = "pc-rise w-full max-w-[420px] rounded-[4px] border border-line bg-paper p-7 shadow-[0_30px_60px_-40px_rgba(27,27,47,.45)]";
const link = "font-semibold text-guide underline-offset-2 hover:underline";

export function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; on: boolean } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const res = await api<ForgotOut>("/auth/forgot", { method: "POST", json: { email } });
      setDone({ email, on: res.email_on });
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  }

  return (
    <div className={card}>
      <h1 className="text-[26px] font-extrabold tracking-tight">Reset your password</h1>
      {done ? (
        done.on ? (
          <p className="mt-3 text-ink-2" role="status">
            If there&apos;s a Pagecraft account for <b className="text-ink">{done.email}</b>, a reset link is on its way. It works once, for an hour.
          </p>
        ) : (
          <div className="mt-3 rounded-[3px] border border-line bg-guide-soft p-3 text-sm text-ink-2" role="status">
            <p>
              <b className="text-ink">Email is off in this demo right now</b>, so reset links can&apos;t be sent. For your account&apos;s safety a link is never
              shown on screen.
            </p>
            <p className="mt-2">
              Locked out of a real account?{" "}
              <a className={link} href="https://virajdomadia.com/#contact">
                Get in touch
              </a>
              . Just looking around? Use a{" "}
              <Link className={link} href="/#try">
                demo login
              </Link>
              .
            </p>
          </div>
        )
      ) : (
        <>
          <p className="mt-1 text-ink-2">We&apos;ll email you a link to choose a new one.</p>
          <form className="mt-6 grid gap-4" onSubmit={submit}>
            <label className="block">
              <span className={label}>Email</span>
              <input name="email" type="email" autoComplete="email" required className={field} />
            </label>
            {error && (
              <p role="alert" className="rounded-[3px] border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral-ink">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={button}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-sm text-ink-2">
        <Link className={link} href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The token travels in the fragment, so it never reaches a server log; take it and clear it.
    const m = /^#token=([\w-]+)$/.exec(window.location.hash);
    setToken(m?.[1] ?? null);
    if (m) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters");
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset", { method: "POST", json: { token, password } });
      router.push("/sites");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h1 className="text-[26px] font-extrabold tracking-tight">Choose a new password</h1>
      {token === null ? (
        <p className="mt-3 text-ink-2" role="alert">
          This page needs the link from your reset email.{" "}
          <Link className={link} href="/forgot">
            Ask for a new one
          </Link>
          .
        </p>
      ) : (
        <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
          <label className="block">
            <span className={label}>New password</span>
            <input name="password" type="password" autoComplete="new-password" required minLength={8} className={field} aria-invalid={Boolean(error)} />
            <span className="mt-1 block text-xs text-muted">At least 8 characters. You&apos;ll be signed out everywhere else.</span>
          </label>
          {error && (
            <p role="alert" className="rounded-[3px] border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral-ink">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !token} className={button}>
            {busy ? "Saving…" : "Save and sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
