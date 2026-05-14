"use client";

import { Github, Layers3 } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { appConfig } from "@/lib/app-config";

export default function AuthPage({ params }: Readonly<{ params: { locale: string } }>): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("piyush89101@gmail.com");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locale = appConfig.app.locales.includes(params.locale) ? params.locale : appConfig.app.locale;
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${locale}/dashboard`;

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl
      });

      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }

      router.push(result?.url ?? callbackUrl);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubSignIn = (): void => {
    void signIn("github", { callbackUrl });
  };

  return (
    <div className="relative mx-auto grid min-h-[72vh] max-w-5xl items-center gap-8 overflow-hidden rounded-2xl border border-line bg-panel/60 p-6 shadow-2xl shadow-black/30 lg:grid-cols-[1fr_420px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(99,102,241,0.24),transparent_24rem),radial-gradient(circle_at_85%_80%,rgba(14,165,233,0.12),transparent_20rem)]" />
      <div className="relative hidden lg:block">
        <Link className="inline-flex items-center gap-3" href="/">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-electric text-white shadow-lg shadow-indigo-500/30">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">GenStack</p>
            <p className="text-xs text-zinc-500">AI Runtime Studio</p>
          </div>
        </Link>
        <h1 className="mt-10 max-w-md text-4xl font-semibold leading-tight">Sign in when you are ready to save and ship.</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
          The demo remains open for fast review. Authentication is available for GitHub OAuth and local credentials.
        </p>
        <div className="mt-8 grid max-w-sm gap-3">
          {["Prompt to config", "Runtime-ready dashboards", "CRUD data persistence"].map((item) => (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300" key={item}>
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full rounded-xl border border-line bg-black/45 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-indigo-electric">GenStack</p>
        <h2 className="mt-3 text-2xl font-semibold">Sign in</h2>
        <p className="mt-2 text-sm text-zinc-500">Use demo credentials, or connect GitHub OAuth.</p>

        {error ? (
          <div className="mt-4 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {appConfig.auth.methods.includes("email") ? (
            <form className="space-y-3" onSubmit={(event) => void handleEmailSignIn(event)}>
              <input
                className="w-full rounded-md border border-line bg-black/40 px-3 py-2 text-sm outline-none ring-indigo-electric/40 focus:ring-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Email"
                autoComplete="email"
              />
              <input
                className="w-full rounded-md border border-line bg-black/40 px-3 py-2 text-sm outline-none ring-indigo-electric/40 focus:ring-2"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Password"
                autoComplete="current-password"
              />
              <button
                disabled={isSubmitting}
                className="w-full rounded-md bg-indigo-electric px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isSubmitting ? "Signing in..." : "Continue with email"}
              </button>
            </form>
          ) : null}

          {appConfig.auth.methods.includes("github") ? (
            <button
              type="button"
              onClick={handleGitHubSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-black/30 px-3 py-2 text-sm font-medium text-zinc-100"
            >
              <Github className="h-4 w-4" />
              Continue with GitHub
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
