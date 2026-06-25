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
    <div className="relative mx-auto grid min-h-[72vh] max-w-5xl items-center gap-10 overflow-hidden rounded-lg border border-line/45 bg-panel p-8 shadow-sm lg:grid-cols-[1fr_420px]">
      <div className="relative hidden lg:block">
        <Link className="inline-flex items-center gap-2.5" href="/">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-line bg-elevated text-zinc-300">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-zinc-200">GenStack</p>
            <p className="text-xs text-zinc-500 font-mono">AI Runtime Studio</p>
          </div>
        </Link>
        <h1 className="mt-12 max-w-md text-2xl font-bold text-zinc-100 leading-tight">Sign in when you are ready to save and ship.</h1>
        <p className="mt-4 max-w-md text-xs leading-relaxed text-zinc-400">
          The demo remains open for fast review. Authentication is available for GitHub OAuth and local credentials.
        </p>
        <div className="mt-8 grid max-w-sm gap-3">
          {["Prompt to config", "Runtime-ready dashboards", "CRUD data persistence"].map((item) => (
            <div className="rounded-md border border-line/50 bg-elevated/20 px-4 py-2 text-xs text-zinc-300 font-medium" key={item}>
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full rounded-lg border border-line/45 bg-panel p-6 shadow-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">GenStack</p>
        <h2 className="mt-3 text-xl font-bold text-zinc-100">Sign in</h2>
        <p className="mt-1 text-xs text-zinc-400">Use demo credentials, or connect GitHub OAuth.</p>

        {error ? (
          <div className="mt-4 rounded-md border border-danger/25 bg-danger/5 p-3 text-xs text-danger font-mono">
            {error}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {appConfig.auth.methods.includes("email") ? (
            <form className="space-y-3" onSubmit={(event) => void handleEmailSignIn(event)}>
              <input
                className="h-9 w-full rounded-md border border-line/50 bg-elevated/45 px-3 text-xs outline-none focus:border-accent focus:ring-0 transition text-zinc-200"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Email"
                autoComplete="email"
              />
              <input
                className="h-9 w-full rounded-md border border-line/50 bg-elevated/45 px-3 text-xs outline-none focus:border-accent focus:ring-0 transition text-zinc-200"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Password"
                autoComplete="current-password"
              />
              <button
                disabled={isSubmitting}
                className="w-full rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition disabled:opacity-50 shadow-none"
              >
                {isSubmitting ? "Signing in..." : "Continue with email"}
              </button>
            </form>
          ) : null}

          {appConfig.auth.methods.includes("github") ? (
            <button
              type="button"
              onClick={handleGitHubSignIn}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-elevated/25 hover:bg-elevated/45 px-3 py-2 text-xs font-semibold text-zinc-200 transition duration-150"
            >
              <Github className="h-3.5 w-3.5" />
              Continue with GitHub
            </button>
          ) : null}
        </div>
        <p className="mt-5 text-center text-xs text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link className="text-accent hover:underline font-semibold" href={`/${locale}/auth/register`}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
