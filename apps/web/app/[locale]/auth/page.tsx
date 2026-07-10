"use client";

import { Github, Layers3, Loader2, Sparkles, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { appConfig } from "@/lib/app-config";

export default function AuthPage({ params }: Readonly<{ params: { locale: string } }>): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locale = appConfig.app.locales.includes(params.locale) ? params.locale : appConfig.app.locale;
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${locale}/dashboard`;

  useEffect(() => {
    if (session) {
      router.push(`/${locale}/dashboard`);
    }
  }, [session, locale, router]);

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

      window.location.href = result?.url ?? callbackUrl;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubSignIn = (): void => {
    void signIn("github", { callbackUrl });
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-background py-12 px-6 lg:px-8 grid-bg-overlay overflow-hidden">
      {/* Background Ambient Blur */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.1),transparent_70%)] glow-blob" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link className="flex flex-col items-center justify-center gap-2.5 group" href="/">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-card/40 text-zinc-300 transition group-hover:border-accent group-hover:scale-105 duration-200">
            <Layers3 className="h-6 w-6 text-accent" />
          </div>
          <div className="text-center">
            <p className="font-bold tracking-tight text-zinc-100 text-lg">GenStack</p>
            <p className="text-[10px] text-zinc-500 font-mono tracking-[0.2em] uppercase">AI Runtime Studio</p>
          </div>
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="premium-card p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">Welcome Back</h2>
            <p className="mt-1 text-xs text-zinc-400">Sign in to manage and generate applications.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-danger/25 bg-danger/5 p-3 text-xs text-danger font-mono text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {appConfig.auth.methods.includes("email") ? (
              <form className="space-y-3.5" onSubmit={(event) => void handleEmailSignIn(event)}>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Mail className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    className="w-full pl-10 premium-input"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder="Email Address"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    className="w-full pl-10 premium-input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="Password"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full premium-btn-primary flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      Signing in...
                    </>
                  ) : (
                    "Continue with Email"
                  )}
                </button>
              </form>
            ) : null}

            {process.env.NODE_ENV !== "production" && (
              <button
                type="button"
                onClick={() => {
                  setEmail("piyush89101@gmail.com");
                  setPassword("123456");
                }}
                className="w-full rounded-xl border border-dashed border-line hover:border-line/80 bg-hover/40 px-3 py-2.5 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition duration-150"
              >
                ⚡ Fill Development Demo Credentials
              </button>
            )}

            {appConfig.auth.methods.includes("github") && (
              <button
                type="button"
                onClick={handleGitHubSignIn}
                className="w-full premium-btn-secondary flex items-center justify-center gap-2"
              >
                <Github className="h-4 w-4" />
                Continue with GitHub
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link className="text-accent hover:underline font-semibold" href={`/${locale}/auth/register`}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
