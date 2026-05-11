"use client";

export function Skeleton({ className = "" }: Readonly<{ className?: string }>): JSX.Element {
  return <div className={`animate-pulse rounded-lg bg-zinc-800 ${className}`} aria-hidden />;
}
