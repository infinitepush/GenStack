"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  return <SessionProvider>{children}</SessionProvider>;
}
