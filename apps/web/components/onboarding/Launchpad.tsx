"use client";

import { ArrowRight, Bot, Gauge, Hospital, Layers3, Package, Sparkles, Users, Car } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LaunchpadProps {
  locale: string;
}

const quickStartSteps = [
  { number: "01", label: "Describe your application", description: "Write a prompt in AI Studio" },
  { number: "02", label: "Click Generate", description: "AI builds schema, APIs, and UI" },
  { number: "03", label: "Apply Configuration", description: "Activate the generated app" },
  { number: "04", label: "Explore Dashboard", description: "View tables, forms, and charts" },
  { number: "05", label: "Add Sample Data", description: "Populate with realistic demo records" },
  { number: "06", label: "Export to GitHub", description: "Push or download your application" }
];

const exampleApps = [
  { icon: Users, label: "Employee Management", prompt: "Build a modern Employee Management system with departments, job titles, salary tracking, and performance analytics." },
  { icon: Hospital, label: "Hospital", prompt: "Build a hospital billing and patient management system with patient records, appointments, billing status, and revenue analytics." },
  { icon: Package, label: "Inventory", prompt: "Build an inventory tracker with reorder alerts, low stock thresholds, and restocked today analytics." },
  { icon: Gauge, label: "CRM", prompt: "Create a sales CRM with leads, stages, company names, deal value, and pipeline analytics." },
  { icon: Car, label: "Parking", prompt: "Build a car parking manager with slots, vehicle types, payment status, and occupancy analytics." }
];

export function Launchpad({ locale }: LaunchpadProps): JSX.Element {
  const router = useRouter();

  const handleExampleClick = (prompt: string): void => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("genstack:prefill-prompt", prompt);
    }
    router.push(`/${locale}/ai`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-6 animate-fadeIn">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-card/60">
          <Layers3 className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-100">
          Welcome to GenStack
        </h1>
        <p className="max-w-md mx-auto text-sm text-zinc-400 leading-relaxed">
          Build production-ready business applications using AI. Follow the quick guide below or choose an example schema.
        </p>
      </div>

      {/* Quick Start Steps Grid */}
      <div className="premium-card p-6 md:p-8">
        <div className="flex items-center gap-2.5 pb-4 border-b border-line/40 mb-6">
          <Sparkles className="h-4.5 w-4.5 text-accent animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent font-mono">Quick Start Guide</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {quickStartSteps.map((step) => (
            <div className="flex items-start gap-4" key={step.number}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/5 text-[11px] font-bold text-accent font-mono">
                {step.number}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">{step.label}</p>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Example Prompts */}
      <div className="premium-card p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-2.5">
          <Bot className="h-4.5 w-4.5 text-accent" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent font-mono">Try one of these</h2>
            <p className="mt-1 text-xs text-zinc-500">Click any card to auto-fill the prompt in AI Studio.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exampleApps.map((app) => (
            <button
              className="group flex items-center gap-3.5 rounded-xl border border-line bg-card/20 p-4 text-left transition duration-200 hover:border-accent/40 hover:bg-accent/5"
              key={app.label}
              onClick={() => handleExampleClick(app.prompt)}
              type="button"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-card/40 transition group-hover:border-accent/20 group-hover:bg-accent/10">
                <app.icon className="h-4 w-4 text-zinc-400 transition group-hover:text-accent" />
              </div>
              <span className="text-xs font-semibold text-zinc-300 transition group-hover:text-zinc-100">{app.label}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-center pt-4">
          <Link
            className="premium-btn-primary inline-flex items-center justify-center px-8 gap-2.5"
            href={`/${locale}/ai`}
          >
            Generate First Application
            <ArrowRight className="h-4.5 w-4.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
