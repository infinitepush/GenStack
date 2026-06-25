"use client";

import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Bot, CheckCircle2, Code2, Database, Gauge, Layers3, Sparkles, Table2, Wand2 } from "lucide-react";
import Link from "next/link";

const examples = [
  { name: "Customer CRM", meta: "Leads, pipeline, deal value", bars: [72, 45, 88] },
  { name: "Expense Tracker", meta: "Spending, categories, imports", bars: [44, 78, 56] },
  { name: "Gym Manager", meta: "Members, plans, bookings", bars: [63, 54, 91] },
  { name: "Hospital Billing", meta: "Patients, invoices, payments", bars: [52, 82, 68] },
  { name: "Task Tracker", meta: "Projects, priority, status", bars: [83, 37, 64] }
];

const features = [
  { icon: Bot, title: "AI App Generation", text: "Turn plain prompts into runtime-ready app configs." },
  { icon: Code2, title: "Config Repair Engine", text: "Schema repair keeps generated apps safe to render." },
  { icon: Table2, title: "Dynamic Forms & Tables", text: "Fields, validation, CRUD, search, sorting, and pagination." },
  { icon: BarChart3, title: "Analytics & Charts", text: "Generated dashboards get runtime-safe visual analytics." },
  { icon: Database, title: "Runtime Data Store", text: "Records persist through a flexible PostgreSQL JSON model." },
  { icon: Gauge, title: "Live Runtime Rendering", text: "Apply config and instantly open the generated app." }
];

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55 } }
};

function MiniBarChart({ bars, height = "h-36" }: { bars: number[]; height?: string }): JSX.Element {
  return (
    <div className={`relative overflow-hidden rounded-md border border-line bg-elevated/25 p-4 shadow-sm ${height}`}>
      <div className="pointer-events-none absolute inset-x-4 top-4 space-y-7">
        {[0, 1, 2].map((line) => (
          <div className="border-t border-dashed border-line" key={line} />
        ))}
      </div>
      <div className="absolute left-4 top-3 flex gap-4 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" />Revenue</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent-light" />Activity</span>
      </div>
      <div className="relative flex h-full items-end gap-3 pt-8">
        {bars.map((bar, index) => (
          <motion.div
            className="flex-1 rounded-t bg-accent/80"
            initial={{ height: "8%", opacity: 0.45 }}
            whileInView={{ height: `${bar}%`, opacity: 1 }}
            animate={{ height: `${bar}%`, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35 + index * 0.08, duration: 0.78, ease: "easeOut" }}
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

export default function LandingPageContent({ locale = "en" }: { locale?: string }): JSX.Element {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(94,106,210,0.08),transparent_28rem)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:34px_34px]" />
 
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link className="flex items-center gap-3" href="/">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-line bg-elevated text-zinc-300">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-zinc-200">GenStack</p>
            <p className="text-xs text-zinc-500 font-mono">AI Runtime Studio</p>
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link className="hidden rounded-md px-3 py-2 text-zinc-400 hover:text-white sm:block" href={`/${locale}/auth`}>
            Sign In
          </Link>
          <Link className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover transition" href={`/${locale}/ai`}>
            Open Studio
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-6 pb-14 pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:pt-20">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-line bg-elevated/40 px-3 py-1 text-xs text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Powered by Gemini + runtime config repair
          </motion.div>
          <motion.h1 variants={fadeUp} className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal md:text-7xl text-zinc-100">
            Generate Internal Tools with AI
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
            Turn simple prompts into fully functional dashboards, forms, tables, analytics, and CRUD apps.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-white hover:bg-accent-hover transition" href={`/${locale}/ai`}>
              Generate Your First App
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-md border border-line bg-elevated/40 px-5 py-3 font-medium text-zinc-200 hover:bg-elevated/60 transition" href={`/${locale}/dashboard`}>
              View Example App
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ opacity: { duration: 0.5 }, scale: { duration: 0.5 } }}
          className="rounded-lg border border-line bg-panel p-4 shadow-sm"
        >
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-md border border-line bg-elevated/40 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-accent font-semibold font-mono">Prompt</p>
              <p className="mt-4 rounded-md border border-line bg-elevated/80 p-4 font-mono text-xs leading-6 text-zinc-200">
                Build a CRM for sales tracking with leads, deal value, stages, and analytics.
                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.1, repeat: Infinity }} className="ml-1 text-accent">|</motion.span>
              </p>
              <motion.div variants={stagger} initial="hidden" animate="show" className="mt-4 space-y-2">
                {["Understanding prompt", "Generating schema", "Creating APIs", "Preparing runtime"].map((step) => (
                  <motion.div variants={fadeUp} className="flex items-center gap-2 text-xs text-zinc-400 font-mono" key={step}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    {step}
                  </motion.div>
                ))}
              </motion.div>
            </div>
            <div className="rounded-md border border-line bg-[#141414] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-200 font-mono">Sales Dashboard</p>
                  <p className="text-[10px] text-zinc-500 font-mono">Runtime Ready</p>
                </div>
                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] text-emerald-400 font-mono">
                  0 blockers
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {["Leads", "Pipeline", "Won"].map((label, index) => (
                  <div className="rounded-md border border-line bg-elevated/20 p-3" key={label}>
                    <p className="text-[10px] text-zinc-500 font-mono">{label}</p>
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + index * 0.08 }} className="mt-1.5 text-xl font-bold font-mono text-zinc-100">
                      {[48, "$92k", 12][index]}
                    </motion.p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <MiniBarChart bars={[38, 74, 52, 88, 61, 45]} />
              </div>
              <div className="mt-4 rounded-md border border-line bg-elevated/10 overflow-hidden">
                {["Acme Corp", "Cotton Textiles", "Northwind"].map((row) => (
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-b-0" key={row}>
                    <span className="text-xs text-zinc-300 font-mono">{row}</span>
                    <span className="text-[10px] text-accent font-semibold font-mono">qualified</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="grid gap-4 md:grid-cols-3">
          {["Describe your app", "AI generates config", "Instant CRUD dashboard"].map((step, index) => (
            <motion.div variants={fadeUp} whileHover={{ y: -2 }} className="rounded-md border border-line bg-panel p-5 shadow-sm" key={step}>
              <p className="font-mono text-xs text-accent">0{index + 1}</p>
              <h2 className="mt-3 text-xl font-semibold text-zinc-200">{step}</h2>
              <p className="mt-2 text-xs leading-6 text-zinc-500">
                {[
                  "Start with a plain English prompt for a CRM, tracker, billing app, or admin dashboard.",
                  "GenStack validates, repairs, scores, and normalizes the generated runtime config.",
                  "Open a working form, table, chart, and CRUD app backed by PostgreSQL runtime storage."
                ][index]}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>
 
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent font-semibold">Core Platform</p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-200">Everything needed for MVP internal tools</h2>
          </div>
          <Link className="inline-flex items-center gap-2 text-sm text-accent hover:text-white" href={`/${locale}/ai`}>
            Open Studio <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <motion.div variants={fadeUp} whileHover={{ y: -2 }} className="rounded-md border border-line bg-panel p-5 shadow-sm" key={feature.title}>
              <feature.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-4 font-semibold text-zinc-200">{feature.title}</h3>
              <p className="mt-2 text-xs leading-6 text-zinc-500">{feature.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent font-semibold">Generated Apps</p>
          <h2 className="mt-3 text-3xl font-semibold text-zinc-200">One engine, many internal tools</h2>
        </div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {examples.map((example) => (
            <motion.div variants={fadeUp} whileHover={{ y: -2 }} className="rounded-md border border-line bg-panel p-4 shadow-sm" key={example.name}>
              <p className="font-medium text-zinc-200">{example.name}</p>
              <p className="mt-1 min-h-10 text-xs text-zinc-500">{example.meta}</p>
              <div className="mt-5">
                <MiniBarChart bars={example.bars} height="h-24" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>
 
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-16 text-center">
        <Wand2 className="mx-auto h-8 w-8 text-accent animate-pulse" />
        <h2 className="mt-5 text-4xl font-semibold text-zinc-200">Start building with AI</h2>
        <p className="mt-4 text-xs text-zinc-400">Generate a runtime-ready app, apply it, and open the dashboard in one flow.</p>
        <Link className="mt-8 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-white hover:bg-accent-hover transition" href={`/${locale}/ai`}>
          Build with AI
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
