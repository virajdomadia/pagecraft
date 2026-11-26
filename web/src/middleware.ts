import { NextResponse, type NextRequest } from "next/server";
import { slugForHost } from "@/lib/hosts";

/**
 * Two jobs (04 §7, R1):
 * 1. `kaapi-corner.pagecraft.virajdomadia.com/…` → rewrite to `/s/kaapi-corner/…`.
 * 2. The studio (`/sites/*`) needs a session: with no `pc_session` cookie, go to sign-in and come
 *    back. A present-but-expired cookie is caught by the page itself (the API answers 401), so
 *    this check needs no network.
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
