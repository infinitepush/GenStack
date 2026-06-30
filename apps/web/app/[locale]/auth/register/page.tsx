"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Layers3, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? "en";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      const body = await response.json() as { success: boolean; error?: string };
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "Registration failed.");
      }

      toast.success("Account created successfully. Please sign in.");
      router.push(`/${locale}/auth`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
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
        <h1 className="mt-12 max-w-md text-2xl font-bold text-zinc-100 leading-tight">Create your account to start generating.</h1>
        <p className="mt-4 max-w-md text-xs leading-relaxed text-zinc-400">
          Sign up to preserve dynamic workspace configurations, export projects, and track dynamic record histories in PostgreSQL.
        </p>
      </div>

      <div className="relative w-full rounded-lg border border-line/45 bg-panel p-6 shadow-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">GenStack</p>
        <h2 className="mt-3 text-xl font-bold text-zinc-100">Sign Up</h2>
        <p className="mt-1 text-xs text-zinc-400">Register credentials to activate dynamic features.</p>

        {error ? (
          <div className="mt-4 rounded-md border border-danger/25 bg-danger/5 p-3 text-xs text-danger font-mono">
            {error}
          </div>
        ) : null}

        <form className="mt-5 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          <input
            className="h-9 w-full rounded-md border border-line/50 bg-elevated/45 px-3 text-xs outline-none focus:border-accent focus:ring-0 transition text-zinc-200"
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            placeholder="Full Name"
            required
          />
          <input
            className="h-9 w-full rounded-md border border-line/50 bg-elevated/45 px-3 text-xs outline-none focus:border-accent focus:ring-0 transition text-zinc-200"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="Email Address"
            required
          />
          <input
            className="h-9 w-full rounded-md border border-line/50 bg-elevated/45 px-3 text-xs outline-none focus:border-accent focus:ring-0 transition text-zinc-200"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Password"
            required
          />
          <input
            className="h-9 w-full rounded-md border border-line/50 bg-elevated/45 px-3 text-xs outline-none focus:border-accent focus:ring-0 transition text-zinc-200"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            placeholder="Confirm Password"
            required
          />
          <button
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 w-full rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition disabled:opacity-50 shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating account...
              </>
            ) : (
              "Register"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <Link className="text-accent hover:underline font-semibold" href={`/${locale}/auth`}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
