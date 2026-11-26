import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Called by the API after publish / unpublish / delete / slug change (04 §6 step 4):
 * `{ secret, tags: ["site:kaapi-corner"] }` → the published page re-renders on its next visit.
 * Lives under /api but is a real route here, so it wins over the /api/* rewrite.
 */
export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) return NextResponse.json({ error: { code: "unavailable", message: "Revalidation is not configured" } }, { status: 503 });

  let body: { secret?: unknown; tags?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "validation", message: "JSON body required" } }, { status: 422 });
  }
  const secret = typeof body.secret === "string" ? body.secret : "";
  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json({ error: { code: "unauthorized", message: "Bad secret" } }, { status: 401 });

  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string" && /^site:[a-z0-9-]{1,40}$/.test(t)) : [];
  tags.forEach((t) => revalidateTag(t));
  return NextResponse.json({ revalidated: tags });
}
