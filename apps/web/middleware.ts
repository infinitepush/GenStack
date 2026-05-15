import { getToken } from "next-auth/jwt";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const locales = ["en", "hi"] as const;
const defaultLocale = "en";
const authEnabled = true;

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale
});

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const locale = segments[0] ?? defaultLocale;
  const section = segments[1];
  const protectedSection = section === "import" || section === "export";

  if (!authEnabled) {
    return intlMiddleware(request);
  }

  if (protectedSection) {
    const token = await getToken({ req: request });
    if (!token) {
      const signInUrl = new URL(`/${locale}/auth`, request.url);
      signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};
