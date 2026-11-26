import type { components } from "@/lib/api-types";

/**
 * Typed fetch to the API (05 §2). In the browser every call goes to `/api/*` on this origin,
 * which next.config.ts rewrites to the API — cookies stay first-party, no CORS. Server
 * components use `lib/server-api.ts` instead (it forwards the session cookie).
 *
 * Errors are always the envelope `{ error: { code, message, details? } }` (06 §C).
 */

export type Schemas = components["schemas"];
export type Me = Schemas["Me"];
export type SiteCard = Schemas["SiteCard"];
export type SiteDetail = Schemas["SiteDetail"];
export type SitesOut = Schemas["SitesOut"];
export type TemplateOut = Schemas["TemplateOut"];
export type SlugCheck = Schemas["SlugCheck"];
export type PublishOut = Schemas["PublishOut"];
export type PublishedSite = Schemas["PublishedSite"];
export type DocOut = Schemas["DocOut"];
export type UploadOut = Schemas["UploadOut"];
export type SeoIn = Schemas["SeoIn"];

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
    if (body.error?.code)
      return new ApiError(res.status, body.error.code, body.error.message ?? "Something went wrong", body.error.details);
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, res.status >= 500 ? "unavailable" : "error", "Pagecraft is having a moment — try again");
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      credentials: "same-origin",
      headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "offline", "You seem to be offline — check your connection");
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong — try again";
}
