import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Guards /admin. In Next 16 this file is `proxy.ts`, not `middleware.ts`, and
 * the exported function is `proxy` — the edge runtime is not supported here.
 *
 * This only checks that a session cookie is present; the signature and expiry
 * are verified in the admin layout, which can reach the database. The point is
 * to bounce anonymous visitors to the login page cheaply, not to be the only
 * line of defence.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return NextResponse.next();
  }
  if (!request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: "/admin/:path*" };
