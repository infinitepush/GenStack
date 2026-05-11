import { randomUUID } from "node:crypto";
import type { AppConfig, DatabaseTableConfig } from "@genstack/config-types";
import { logger } from "../lib/logger.js";

export interface ExportError {
  stage: string;
  path?: string;
  message: string;
}

export interface ExportJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  repoName: string;
  repoUrl?: string;
  filesTotal: number;
  filesExported: number;
  errors: ExportError[];
  cloneCommand?: string;
}

interface GitHubUser {
  login: string;
}

interface GitHubRepo {
  html_url: string;
  clone_url: string;
  name: string;
}

const jobs = new Map<string, ExportJob>();

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "generated-app";
}

function toBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function prismaFieldType(type: string): string {
  if (type === "number") return "Float";
  if (type === "boolean") return "Boolean";
  if (type === "date") return "DateTime";
  return "String";
}

function modelName(table: string): string {
  const singular = table.endsWith("s") ? table.slice(0, -1) : table;
  return singular.replace(/(^|_)([a-z])/g, (_match, _prefix: string, letter: string) => letter.toUpperCase());
}

function generatePrismaSchema(tables: DatabaseTableConfig[]): string {
  const models = tables.map((table) => {
    const fields = table.fields
      .map((field) => `  ${field.name} ${prismaFieldType(field.type)}${field.required ? "" : "?"}`)
      .join("\n");
    return `model ${modelName(table.name)} {\n  id String @id @default(cuid())\n${fields}\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}`;
  });

  return `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\n\n${models.join("\n\n")}\n`;
}

export function generateStandaloneProject(config: AppConfig): Record<string, string> {
  const firstPage = config.ui.pages[0]?.route ?? "/dashboard";
  const files: Record<string, string> = {
    "package.json": JSON.stringify(
      {
        name: slugify(config.app.name),
        version: "0.1.0",
        private: true,
        scripts: { dev: "next dev", build: "next build", start: "next start", prisma: "prisma generate" },
        dependencies: {
          "@prisma/client": "^5.22.0",
          next: "^14.2.23",
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          recharts: "^2.15.0",
          zod: "^3.24.1"
        },
        devDependencies: {
          prisma: "^5.22.0",
          typescript: "^5.7.2",
          tailwindcss: "^3.4.17",
          postcss: "^8.4.49",
          autoprefixer: "^10.4.20",
          "@types/node": "^20.17.10",
          "@types/react": "^18.3.18",
          "@types/react-dom": "^18.3.5"
        }
      },
      null,
      2
    ),
    "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, jsx: "preserve", noEmit: true, moduleResolution: "Bundler" } }, null, 2),
    "next.config.ts": "import type {NextConfig} from 'next';\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n",
    "tailwind.config.ts": "import type {Config} from 'tailwindcss';\nexport default {content: ['./app/**/*.tsx', './components/**/*.tsx'], theme: {extend: {}}, plugins: []} satisfies Config;\n",
    "postcss.config.js": "module.exports = {plugins: {tailwindcss: {}, autoprefixer: {}}};\n",
    ".env.example": "DATABASE_URL=\"postgresql://user:password@localhost:5432/app\"\n",
    "app/globals.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody{margin:0;background:#0a0a0a;color:#fafafa;font-family:ui-sans-serif,system-ui;}\n",
    "app/layout.tsx": `import './globals.css';\nexport default function Layout({children}: Readonly<{children: React.ReactNode}>){return <html lang="${config.app.locale}"><body>{children}</body></html>}\n`,
    "app/page.tsx": `import {redirect} from 'next/navigation';\nexport default function Home(){redirect('${firstPage}')}\n`,
    "app/dashboard/[page]/page.tsx": `import config from '../../../generated-config.json';\nimport {TableRenderer} from '../../../components/TableRenderer';\nimport {FormRenderer} from '../../../components/FormRenderer';\nexport default function Page({params}: {params:{page:string}}){const page = config.ui.pages.find((item) => item.route === '/' + params.page) ?? config.ui.pages[0]; return <main style={{padding:24}}><h1>{page?.name ?? config.app.name}</h1><div style={{display:'grid', gap:16}}>{page?.components.map((component, index) => component.type === 'form' ? <FormRenderer key={index} config={component}/> : component.type === 'table' ? <TableRenderer key={index} config={component} data={[]}/> : <div key={index}>Unsupported component: {component.type}</div>)}</div></main>}\n`,
    "components/FormRenderer.tsx": "export function FormRenderer({config}: {config: Record<string, any>}){return <form style={{border:'1px solid #333', padding:16}}>{(config.fields ?? []).map((field: string) => <label key={field} style={{display:'block', marginBottom:12}}>{field}<input style={{display:'block', marginTop:4}} /></label>)}<button>Save</button></form>}\n",
    "components/TableRenderer.tsx": "export function TableRenderer({config, data}: {config: Record<string, any>; data: Array<Record<string, unknown>>}){const columns = config.columns ?? []; return <table><thead><tr>{columns.map((column: string) => <th key={column}>{column}</th>)}</tr></thead><tbody>{data.map((row, index) => <tr key={index}>{columns.map((column: string) => <td key={column}>{String(row[column] ?? '-')}</td>)}</tr>)}</tbody></table>}\n",
    "lib/prisma.ts": "import {PrismaClient} from '@prisma/client';\nexport const prisma = new PrismaClient();\n",
    "generated-config.json": JSON.stringify(config, null, 2),
    "README.md": `# ${config.app.name}\n\nGenerated by AppGen.\n\n## Setup\n\n1. npm install\n2. cp .env.example .env\n3. npm run prisma\n4. npm run dev\n\n## Config Summary\n\n- Tables: ${config.database.tables.map((table) => table.name).join(", ") || "none"}\n- Pages: ${config.ui.pages.map((page) => page.name).join(", ") || "none"}\n`
  };

  if (config.database.tables.length > 0) {
    files["prisma/schema.prisma"] = generatePrismaSchema(config.database.tables);
  }

  return files;
}

async function githubFetch<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid token");
    if (response.status === 403) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      throw new Error(remaining === "0" ? "Rate limited, try in 60s" : "Token missing 'repo' scope");
    }
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `GitHub API returned ${response.status}`);
  }

  return (await response.json()) as T;
}

async function resolveRepoName(owner: string, desiredName: string, token: string): Promise<string> {
  const base = slugify(desiredName);
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const response = await fetch(`https://api.github.com/repos/${owner}/${candidate}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
    });
    if (response.status === 404) return candidate;
    if (response.status === 401) throw new Error("Invalid token");
    if (response.status === 403) throw new Error("Token missing 'repo' scope");
  }
  return `${base}-${Date.now()}`;
}

export function getExportJob(id: string): ExportJob | undefined {
  return jobs.get(id);
}

export function startGitHubExport(input: { config: AppConfig; token: string; repoName: string }): ExportJob {
  const id = randomUUID();
  const job: ExportJob = {
    id,
    status: "queued",
    stage: "Queued",
    repoName: slugify(input.repoName),
    filesTotal: 0,
    filesExported: 0,
    errors: []
  };
  jobs.set(id, job);

  void runExport(job, input).catch((error: unknown) => {
    job.status = "failed";
    job.errors.push({ stage: job.stage, message: error instanceof Error ? error.message : "Export failed" });
    logger.error({ error, jobId: job.id }, "GitHub export failed");
  });

  return job;
}

async function runExport(job: ExportJob, input: { config: AppConfig; token: string; repoName: string }): Promise<void> {
  job.status = "running";
  job.stage = "Generating project scaffold";
  const files = generateStandaloneProject(input.config);
  job.filesTotal = Object.keys(files).length;

  job.stage = "Creating GitHub repository";
  const user = await githubFetch<GitHubUser>("https://api.github.com/user", input.token);
  const repoName = await resolveRepoName(user.login, input.repoName, input.token);
  job.repoName = repoName;
  const repo = await githubFetch<GitHubRepo>("https://api.github.com/user/repos", input.token, {
    method: "POST",
    body: JSON.stringify({ name: repoName, description: "Generated by AppGen", private: false })
  });
  job.repoUrl = repo.html_url;
  job.cloneCommand = `git clone ${repo.clone_url}`;

  job.stage = "Uploading files";
  for (const [path, content] of Object.entries(files)) {
    try {
      await githubFetch(`https://api.github.com/repos/${user.login}/${repoName}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`, input.token, {
        method: "PUT",
        body: JSON.stringify({ message: "Initial commit", content: toBase64(content) })
      });
      job.filesExported += 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "File upload failed";
      job.errors.push({ stage: "Uploading files", path, message });
      logger.warn({ path, message }, "GitHub file upload failed");
    }
  }

  job.stage = "Finalizing";
  job.status = "completed";
}
