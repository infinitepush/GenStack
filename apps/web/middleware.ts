import { getToken } from "next-auth/jwt";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { appConfig } from "./lib/app-config";

const intlMiddleware = createMiddleware({
  locales: appConfig.app.locales,
  defaultLocale: appConfig.app.locale
});

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const locale = segments[0] ?? appConfig.app.locale;
  const section = segments[1];
  const protectedSection = section === "dashboard" || section === "ai" || section === "import" || section === "export" || section === "config";

  if (!appConfig.auth.enabled) {
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
