"use client";

import { Github } from "lucide-react";
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
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
      <div className="w-full rounded-lg border border-line bg-panel/90 p-6 shadow-2xl shadow-black/30">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-indigo-electric">{appConfig.app.name}</p>
        <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Use the demo credentials below, or configure GitHub OAuth in `.env`.
        </p>

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
