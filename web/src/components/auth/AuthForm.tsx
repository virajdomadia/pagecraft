"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { DemoButtons } from "@/components/auth/DemoButtons";
import { api, ApiError, errorMessage } from "@/lib/api";
import { safeNext } from "@/lib/hosts";

const field =
  "mt-1.5 block w-full rounded-[3px] border border-line bg-paper px-3 py-2.5 text-[15px] text-ink outline-none transition focus:border-guide focus:ring-2 focus:ring-guide-soft";
const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";

/** S2: one card on the grid; the demo logins sit under the form. */
export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const signUp = mode === "sign-up";
  const safe = safeNext(next);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(["email", "password", ...(signUp ? ["name"] : [])].map((k) => [k, String(form.get(k) ?? "")]));
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api(`/auth/${mode}`, { method: "POST", json: body });
      router.push(safe);
      router.refresh();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === "validation") {
        const fields = (err.details.fields ?? {}) as Record<string, string>;
        setFieldErrors({
          ...(fields.email ? { email: "Enter a valid email address" } : {}),
          ...(fields.password ? { password: signUp ? "Use at least 8 characters" : "Enter your password" } : {}),
          ...(fields.name ? { name: "Tell us your name" } : {}),
        });
        return;
      }
      setError(errorMessage(err));
    }
  }

  return (
    <div className="pc-rise w-full max-w-[420px] rounded-[4px] border border-line bg-paper p-7 shadow-[0_30px_60px_-40px_rgba(27,27,47,.45)]">
      <h1 className="text-[26px] font-extrabold tracking-tight">{signUp ? "Make your first site" : "Welcome back"}</h1>
      <p className="mt-1 text-ink-2">{signUp ? "Free for three sites. No card." : "Sign in to your sites."}</p>
      <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
        {signUp && (
          <label className="block">
            <span className={label}>Your name</span>
            <input name="name" autoComplete="name" required maxLength={80} className={field} aria-invalid={Boolean(fieldErrors.name)} />
            {fieldErrors.name && <span className="mt-1 block text-sm text-coral-ink">{fieldErrors.name}</span>}
          </label>
        )}
        <label className="block">
          <span className={label}>Email</span>
          <input name="email" type="email" autoComplete="email" required className={field} aria-invalid={Boolean(fieldErrors.email)} />
          {fieldErrors.email && <span className="mt-1 block text-sm text-coral-ink">{fieldErrors.email}</span>}
        </label>
        <label className="block">
          <span className={label}>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={signUp ? "new-password" : "current-password"}
            required
            minLength={signUp ? 8 : 1}
            className={field}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password ? (
            <span className="mt-1 block text-sm text-coral-ink">{fieldErrors.password}</span>
          ) : (
            signUp && <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
          )}
        </label>
        {error && (
          <p role="alert" className="rounded-[3px] border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral-ink">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-[3px] bg-guide px-4 py-2.5 font-bold text-white transition hover:bg-guide-hover disabled:opacity-60"
        >
          {busy ? (signUp ? "Creating your account…" : "Signing in…") : signUp ? "Create account" : "Sign in"}
        </button>
      </form>
      {!signUp && (
        <p className="mt-3 text-sm text-muted">
          Forgot your password? Password resets arrive with email in the next release — for now,{" "}
          <a className="font-semibold text-guide underline-offset-2 hover:underline" href="https://virajdomadia.com/#contact">
            get in touch
          </a>
          .
        </p>
      )}
      <div className="my-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
        <span className="h-px flex-1 bg-line" />
        or look around with a demo login
        <span className="h-px flex-1 bg-line" />
      </div>
      <DemoButtons next={safe} />
      <p className="mt-6 text-sm text-ink-2">
        {signUp ? "Already have an account? " : "New to Pagecraft? "}
        <Link
          className="font-semibold text-guide underline-offset-2 hover:underline"
          href={`/${signUp ? "sign-in" : "sign-up"}${safe !== "/sites" ? `?next=${encodeURIComponent(safe)}` : ""}`}
        >
          {signUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
