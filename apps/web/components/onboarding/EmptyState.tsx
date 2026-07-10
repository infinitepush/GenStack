"use client";

import { Bot, ArrowRight } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  locale: string;
  icon?: React.ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptyState({
  locale,
  icon,
  title,
  description,
  ctaLabel = "Generate Application",
  ctaHref
}: EmptyStateProps): JSX.Element {
  const href = ctaHref ?? `/${locale}/ai`;

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6 animate-fadeIn">
      <div className="premium-card p-8 md:p-10 max-w-md w-full text-center shadow-xl">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-card/40">
          {icon ?? <Bot className="h-6 w-6 text-accent" />}
        </div>
        <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{description}</p>
        <div className="mt-7 flex justify-center">
          <Link
            className="premium-btn-primary inline-flex items-center justify-center px-6 gap-2"
            href={href}
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
