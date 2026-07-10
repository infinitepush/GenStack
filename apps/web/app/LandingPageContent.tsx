"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Code2,
  Database,
  Gauge,
  Layers3,
  Sparkles,
  Table2,
  Wand2,
  Github,
  Play,
  ArrowUpRight,
  Cpu,
  Zap,
  ShieldCheck,
  Share2
} from "lucide-react";
import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Describe your app",
    desc: "Type a simple prompt in natural language describing what database fields, pages, and charts you need."
  },
  {
    number: "02",
    title: "AI builds structure",
    desc: "Gemini interprets the prompt to compile the schema, CRUD endpoints, and auto-repairs any design inconsistencies."
  },
  {
    number: "03",
    title: "Apply and render",
    desc: "Apply the generated JSON configuration immediately into the live database engine with zero compilation delay."
  },
  {
    number: "04",
    title: "Populate with data",
    desc: "Inject realistic mock records using the sample data generator to instantly bring tables and analytics charts to life."
  },
  {
    number: "05",
    title: "Ship and export",
    desc: "Download the complete standalone Next.js project codebase or push it directly to your GitHub repository."
  }
];

const features = [
  { icon: Bot, title: "AI App Generation", text: "Turn plain prompts into runtime-ready app configs." },
  { icon: Code2, title: "Config Repair Engine", text: "Schema repair keeps generated apps safe to render." },
  { icon: Table2, title: "Dynamic Forms & Tables", text: "Fields, validation, CRUD, search, sorting, and pagination." },
  { icon: BarChart3, title: "Analytics & Charts", text: "Generated dashboards get runtime-safe visual analytics." },
  { icon: Database, title: "Runtime Data Store", text: "Records persist through a flexible PostgreSQL JSON model." },
  { icon: Gauge, title: "Live Runtime Rendering", text: "Apply config and instantly open the generated app." }
];

const testimonials = [
  {
    name: "Alex Rivera",
    role: "Lead Platform Engineer",
    text: "Generating working dashboards in under 30 seconds feels like magic. The code output is clean, standard Next.js."
  },
  {
    name: "Sarah Chen",
    role: "Product Operations",
    text: "We went from custom build requests taking weeks to allowing operations teams to generate their own custom tools."
  }
];

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

function MiniBarChart({ bars }: { bars: number[] }): JSX.Element {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-card/40 p-4 shadow-sm h-32">
      <div className="absolute inset-x-4 top-4 flex gap-4 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Active
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent-secondary" />
          New Leads
        </span>
      </div>
      <div className="relative flex h-full items-end gap-3 pt-6">
        {bars.map((bar, index) => (
          <motion.div
            className="flex-1 rounded-t bg-accent/80"
            initial={{ height: "10%", opacity: 0.5 }}
            whileInView={{ height: `${bar}%`, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + index * 0.05, duration: 0.6, ease: "easeOut" }}
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

export default function LandingPageContent({ locale = "en" }: { locale?: string }): JSX.Element {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-zinc-100 grid-bg-overlay">
      {/* Soft Radial Ambient Glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.12),transparent_70%)] glow-blob" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[400px] w-[400px] bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.05),transparent_75%)] glow-blob" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 border-b border-line/40">
        <Link className="flex items-center gap-3" href="/">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-card/60 text-zinc-200">
            <Layers3 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="font-semibold tracking-tight text-zinc-100">GenStack</p>
            <p className="text-[10px] text-zinc-500 font-mono">AI Studio v0.1</p>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="hidden rounded-md px-3 py-2 text-zinc-400 hover:text-zinc-200 transition sm:block" href={`/${locale}/auth`}>
            Sign In
          </Link>
          <Link className="premium-btn-primary flex items-center justify-center px-5" href={`/${locale}/ai`}>
            Open Studio
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:pt-28">
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-start text-left">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-line bg-card/50 px-3.5 py-1 text-xs text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
            Next-generation AI compiler & config repair
          </motion.div>
          <motion.h1
            variants={fadeUp}
            className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl text-zinc-100 leading-[1.08] max-w-xl"
            style={{ fontSize: "clamp(36px, 6vw, 60px)" }}
          >
            Build Production Ready Internal Tools using AI
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-6 text-base md:text-lg leading-relaxed text-zinc-400 max-w-md">
            Generate dashboards, CRUD APIs, analytics, database schema, forms, and GitHub-ready projects from plain text.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3.5">
            <Link className="premium-btn-primary inline-flex items-center justify-center px-6 gap-2" href={`/${locale}/ai`}>
              Generate App
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              className="premium-btn-secondary inline-flex items-center justify-center px-5 gap-2"
              href={`/${locale}/ai?demo=true`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Watch Demo
            </Link>
          </motion.div>
        </motion.div>

        {/* Dashboard Preview (Right Side) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, cubicBezier: [0.16, 1, 0.3, 1] }}
          className="relative rounded-2xl border border-line bg-card/25 p-5 backdrop-blur-md shadow-2xl shadow-black/60"
        >
          <div className="grid gap-5">
            {/* Top Info Bar */}
            <div className="flex items-center justify-between border-b border-line/40 pb-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-accent animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-zinc-200 font-mono">CRM Dashboard</p>
                  <p className="text-[10px] text-zinc-500 font-mono">Status: Applied & Persistent</p>
                </div>
              </div>
              <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-[10px] font-mono text-success">
                Active Runtime
              </span>
            </div>

            {/* Metric Blocks */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { title: "Active Leads", value: "142", desc: "+12.4% today" },
                { title: "Pipeline Value", value: "$48,900", desc: "6 won deals" },
                { title: "Conversion Rate", value: "24.2%", desc: "+3.1% week" }
              ].map((metric) => (
                <div className="rounded-xl border border-line bg-card/30 p-3 text-left" key={metric.title}>
                  <p className="text-[10px] text-zinc-500 font-mono">{metric.title}</p>
                  <p className="mt-1 text-base font-bold font-mono text-zinc-100">{metric.value}</p>
                  <p className="mt-0.5 text-[9px] text-success font-mono">{metric.desc}</p>
                </div>
              ))}
            </div>

            {/* Chart Widget */}
            <MiniBarChart bars={[35, 60, 48, 80, 55, 72, 90]} />

            {/* Bottom Row Data Preview */}
            <div className="rounded-xl border border-line bg-card/20 overflow-hidden text-xs">
              <div className="flex justify-between border-b border-line px-4 py-2 bg-card/45 text-zinc-400 font-mono text-[10px]">
                <span>Company</span>
                <span>Stage</span>
              </div>
              {[
                { name: "Acme Enterprise", stage: "Proposal Sent" },
                { name: "Stripe India", stage: "Discovery" }
              ].map((row) => (
                <div className="flex items-center justify-between border-b border-line/40 px-4 py-2.5 last:border-b-0" key={row.name}>
                  <span className="font-medium text-zinc-300 font-mono text-[11px]">{row.name}</span>
                  <span className="rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[9px] text-accent font-semibold">
                    {row.stage}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Tech Stack Banner */}
      <section className="relative z-10 border-y border-line/40 bg-panel/30 py-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-mono">Modern Architecture Stack</p>
        <div className="mt-4 flex flex-wrap justify-center items-center gap-8 md:gap-14 text-zinc-400 font-mono text-xs font-semibold">
          <span className="flex items-center gap-1.5"><Layers3 className="h-4 w-4 text-accent" /> Next.js 14</span>
          <span className="flex items-center gap-1.5"><Database className="h-4 w-4 text-accent" /> PostgreSQL</span>
          <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-accent" /> Gemini 2.5</span>
          <span className="flex items-center gap-1.5"><Code2 className="h-4 w-4 text-accent" /> Express APIs</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Prisma ORM</span>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="text-center max-w-xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent font-semibold">How it works</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-100">From prompt to GitHub repository</h2>
          <p className="mt-3 text-sm text-zinc-400">GenStack handles compilation, schema validation, and rendering dynamically.</p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-5">
          {steps.map((step) => (
            <div className="relative rounded-2xl border border-line bg-card/10 p-6 flex flex-col justify-between h-56 transition hover:border-line/90 hover:bg-card/20" key={step.number}>
              <div>
                <p className="font-mono text-lg text-accent/50 font-bold">{step.number}</p>
                <h3 className="mt-4 text-sm font-bold text-zinc-200">{step.title}</h3>
                <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-12 border-t border-line/30">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent font-semibold">Platform Capabilities</p>
            <h2 className="mt-3 text-3xl font-extrabold text-zinc-100">Everything needed for internal tools</h2>
          </div>
          <Link className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline" href={`/${locale}/ai`}>
            Open AI Studio
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div className="rounded-2xl border border-line bg-card/20 p-6 transition hover:translate-y-[-2px] hover:border-line/90" key={feature.title}>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-sm font-bold text-zinc-200">{feature.title}</h3>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-500">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture overview section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 border-t border-line/30">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent font-semibold">Under the hood</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-100">Self-Repairing Config Architecture</h2>
            <p className="mt-4 text-xs leading-relaxed text-zinc-400">
              When AI generates code, minor issues like missing references or validation errors can break React UI renders. GenStack runs an internal schema validator and auto-corrects any inconsistencies before applying configurations to the database.
            </p>
            <div className="mt-6 space-y-3.5">
              {[
                { title: "Structured Gemini Generation", desc: "Uses JSON schema compilation to guarantee consistent data structures." },
                { title: "Dynamic Runtime Engine", desc: "Instantly compiles endpoints without restarting Express backend." },
                { title: "Full Code Export", desc: "Generates boilerplate-free Next.js workspaces matching best practices." }
              ].map((item) => (
                <div className="flex gap-3" key={item.title}>
                  <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">{item.title}</h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* visual mock code scaffold representation */}
          <div className="rounded-2xl border border-line bg-card/10 p-5 font-mono text-[11px] text-zinc-400">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Scaffolder: next-config-repair</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <pre className="overflow-x-auto whitespace-pre leading-relaxed text-zinc-300">
{`{
  "app": {
    "name": "Employee Hub",
    "version": "1.0.0"
  },
  "database": {
    "tables": [
      {
        "name": "employees",
        "fields": [
          { "name": "email", "type": "email", "required": true },
          { "name": "salary", "type": "number", "required": false }
        ]
      }
    ]
  },
  "ui": {
    "pages": [
      { "name": "Dashboard", "route": "/dashboard" }
    ]
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 border-t border-line/30">
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent font-semibold">Testimonials</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-100">Trusted by modern engineering teams</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {testimonials.map((t) => (
            <div className="rounded-2xl border border-line bg-card/15 p-7 flex flex-col justify-between" key={t.name}>
              <p className="text-xs italic leading-relaxed text-zinc-400">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-bold text-xs text-accent">
                  {t.name[0]}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">{t.name}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-20 text-center">
        <Wand2 className="mx-auto h-8 w-8 text-accent animate-pulse" />
        <h2 className="mt-6 text-3xl font-extrabold text-zinc-200">Start building with AI</h2>
        <p className="mt-3 text-xs text-zinc-400">Compile dynamic database tools, apply runtime schema edits, and export directly.</p>
        <div className="mt-8 flex justify-center">
          <Link className="premium-btn-primary inline-flex items-center justify-center px-8 gap-2" href={`/${locale}/ai`}>
            Build with AI
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line/40 bg-background py-8 text-center text-xs text-zinc-500 font-mono">
        <p>© {new Date().getFullYear()} GenStack AI Runtime Studio. Clean code, dynamic database engine.</p>
      </footer>
    </main>
  );
}
