import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, type Me, toApiError } from "@/lib/api";

/** The API's base URL for server-side calls (the browser goes through the `/api` rewrite). */
export function apiUrl(): string {
  return (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

/** Signed-in fetch from a server component: forwards the session cookie as-is. */
export async function serverApi<T>(path: string): Promise<T> {
  const jar = await cookies();
  const session = jar.get("pc_session")?.value;
  const res = await fetch(`${apiUrl()}${path}`, {
    headers: session ? { cookie: `pc_session=${session}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

/** The signed-in user, or a redirect to sign-in that comes back to `next`. */
export async function requireMe(next: string): Promise<Me> {
  try {
    return await serverApi<Me>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
    throw err;
  }
}

/** A site the user is a member of, or Next's 404 (a non-member must not learn it exists). */
export async function loadOr404<T>(path: string): Promise<T> {
  const { notFound } = await import("next/navigation");
  try {
    return await serverApi<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    throw err;
  }
}
