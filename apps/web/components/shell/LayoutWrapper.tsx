"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { appConfig } from "@/lib/app-config";

interface LayoutWrapperProps {
  children: React.ReactNode;
  locale: string;
}

export function LayoutWrapper({ children, locale }: LayoutWrapperProps): JSX.Element {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Determine if this is a route that should exclude the sidebar layout
  const isRawRoot = segments.length === 0;
  const firstSegment = segments[0];
  const isLocaleRoot = segments.length === 1 && firstSegment !== undefined && appConfig.app.locales.includes(firstSegment);
  const isAuthPage = segments.length >= 2 && segments[1] === "auth";

  if (isRawRoot || isLocaleRoot || isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
      <Sidebar locale={locale} />
      <main className="min-w-0 px-5 py-6 lg:px-8">{children}</main>
    </div>
  );
}
