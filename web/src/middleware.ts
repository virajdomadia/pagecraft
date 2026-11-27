import { NextResponse, type NextRequest } from "next/server";
import { slugForHost } from "@/lib/hosts";

/**
 * Two jobs (04 §7, R1):
 * 1. `kaapi-corner.pagecraft.virajdomadia.com/…` → rewrite to `/s/kaapi-corner/…`.
 * 2. The studio (`/sites/*`) needs a session: with no `pc_session` cookie, go to sign-in and come
 *    back. A present-but-expired cookie is caught by the page itself (the API answers 401), so
 *    this check needs no network.
 * 3. `/api/*` is rewritten to the API, which then sees this proxy's address, not the visitor's.
 *    Pass the visitor's `x-real-ip` (Vercel sets it at its edge; a client can't) proven with
 *    PROXY_SECRET, so the API's per-IP rate limits see real visitors (the Frontrow recipe).
 */
export function middleware(request: NextRequest) {
  const slug = slugForHost(request.headers.get("host"), process.env.NEXT_PUBLIC_SITE_HOST || undefined);
  const { pathname, search } = request.nextUrl;

  if (slug) {
    if (pathname.startsWith("/_next") || pathname.startsWith("/templates/") || pathname.startsWith("/api/media/"))
      return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/s/${slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  const secret = process.env.PROXY_SECRET;
  const ip = request.headers.get("x-real-ip");
  if (pathname.startsWith("/api/") && secret && ip) {
    const headers = new Headers(request.headers);
    headers.set("x-pagecraft-client-ip", ip);
    headers.set("x-pagecraft-proxy", secret);
    return NextResponse.next({ request: { headers } });
  }

  if (pathname.startsWith("/sites") && !request.cookies.get("pc_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except static files; the host rewrite has to see `/` and page paths.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml).*)"],
};
