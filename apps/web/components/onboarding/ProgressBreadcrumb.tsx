"use client";

import { usePathname } from "next/navigation";

interface ProgressBreadcrumbProps {
  locale: string;
}

const stages = [
  { key: "generate", label: "Generate", routes: ["/ai"] },
  { key: "explore", label: "Explore", routes: ["/dashboard", "/summary", "/analytics"] },
  { key: "customize", label: "Customize", routes: ["/config", "/translations", "/import"] },
  { key: "deploy", label: "Deploy", routes: ["/export", "/integrations"] }
];

export function ProgressBreadcrumb({ locale }: ProgressBreadcrumbProps): JSX.Element {
  const pathname = usePathname();

  const activeStageIndex = stages.findIndex((stage) =>
    stage.routes.some((route) => pathname.includes(`/${locale}${route}`))
  );

  return (
    <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-card/45 px-4 py-2.5">
      {stages.map((stage, index) => {
        const isActive = index === activeStageIndex;
        const isPast = activeStageIndex > -1 && index < activeStageIndex;

        return (
          <div className="flex items-center" key={stage.key}>
            <div className="flex items-center gap-2">
              <div
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold font-mono transition ${
                  isActive
                    ? "bg-accent text-white"
                    : isPast
                      ? "bg-accent/20 text-accent"
                      : "bg-card border border-line text-zinc-500"
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`whitespace-nowrap text-[11px] font-semibold transition ${
                  isActive
                    ? "text-accent"
                    : isPast
                      ? "text-zinc-400"
                      : "text-zinc-500"
                }`}
              >
                {stage.label}
              </span>
            </div>

            {index < stages.length - 1 && (
              <div
                className={`mx-3 h-px w-6 shrink-0 transition ${
                  isPast ? "bg-accent/30" : "bg-line/60"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
