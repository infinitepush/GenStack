"use client";

import { ArrowRight, Layers3, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface WelcomeModalProps {
  locale: string;
}

function getOnboardingKey(userId: string): string {
  return `genstack:onboarding:${userId}`;
}

export function WelcomeModal({ locale }: WelcomeModalProps): JSX.Element | null {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getOnboardingKey(userId);
    const dismissed = localStorage.getItem(key);
    if (!dismissed) {
      const timer = setTimeout(() => setIsVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, [userId]);

  const dismiss = (permanent: boolean): void => {
    setIsVisible(false);
    if (permanent) {
      localStorage.setItem(getOnboardingKey(userId), "completed");
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40">
        <button
          className="absolute right-4 top-4 rounded-xl p-1.5 text-zinc-500 hover:bg-hover hover:text-zinc-300 transition"
          onClick={() => dismiss(false)}
          type="button"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-xl border border-accent/30 bg-accent/10">
          <Layers3 className="h-7 w-7 text-accent" />
        </div>

        <h2 className="text-center text-xl font-bold text-zinc-100">Welcome to GenStack</h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Generate production-ready business applications in 3 steps.
        </p>

        <div className="mt-7 space-y-4">
          {[
            { step: "1", text: "Describe your application in AI Studio" },
            { step: "2", text: "Click Generate" },
            { step: "3", text: "Customize, manage data, and export" }
          ].map((item) => (
            <div className="flex items-center gap-3.5" key={item.step}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-xs font-bold text-accent font-mono">
                {item.step}
              </div>
              <p className="text-sm text-zinc-300">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <Link
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-md shadow-accent/20 transition hover:bg-accent-hover"
            href={`/${locale}/ai`}
            onClick={() => dismiss(true)}
          >
            <Sparkles className="h-4 w-4" />
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-center gap-4">
            <button
              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
              onClick={() => dismiss(false)}
              type="button"
            >
              Skip
            </button>
            <span className="text-zinc-600">·</span>
            <button
              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
              onClick={() => dismiss(true)}
              type="button"
            >
              Don&apos;t show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
