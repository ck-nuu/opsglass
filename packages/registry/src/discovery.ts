import type { StackItem, ImportCandidate, Project } from "./index";
const known: Record<string, [string, string]> = {
  next: ["Next.js", "framework"],
  react: ["React", "frontend"],
  vue: ["Vue", "frontend"],
  nuxt: ["Nuxt", "framework"],
  svelte: ["Svelte", "frontend"],
  "@sveltejs/kit": ["SvelteKit", "framework"],
  astro: ["Astro", "framework"],
  express: ["Express", "backend"],
  fastify: ["Fastify", "backend"],
  hono: ["Hono", "backend"],
  "@nestjs/core": ["NestJS", "backend"],
  typescript: ["TypeScript", "language"],
  tailwindcss: ["Tailwind CSS", "styling"],
  "drizzle-orm": ["Drizzle", "database"],
  prisma: ["Prisma", "database"],
  "@prisma/client": ["Prisma", "database"],
  pg: ["PostgreSQL", "database"],
  postgres: ["PostgreSQL", "database"],
  mongoose: ["MongoDB", "database"],
  redis: ["Redis", "database"],
  ioredis: ["Redis", "database"],
  bullmq: ["BullMQ", "jobs"],
  "@clerk/nextjs": ["Clerk", "authentication"],
  "next-auth": ["Auth.js", "authentication"],
  stripe: ["Stripe", "payments"],
  firebase: ["Firebase", "service"],
  "@supabase/supabase-js": ["Supabase", "service"],
  "@trpc/server": ["tRPC", "api"],
  wrangler: ["Cloudflare Workers", "hosting"],
  vitest: ["Vitest", "testing"],
  "@playwright/test": ["Playwright", "testing"],
  zod: ["Zod", "validation"],
};
export function detectStack(files: Record<string, string>): {
  stack: StackItem[];
  commands: Project["commands"];
  warnings: string[];
} {
  const items: StackItem[] = [];
  const warnings: string[] = [];
  const commands = { setup: "", dev: "", test: "", deploy: "" };
  const add = (
    name: string,
    category: string,
    source: string,
    version?: string,
  ) => {
    if (!items.some((i) => i.name === name && i.source === source))
      items.push({
        name,
        category,
        source,
        ...(version ? { version } : {}),
        detectedAt: new Date().toISOString(),
      });
  };
  for (const [path, content] of Object.entries(files)) {
    const file = path.split("/").pop() || path;
    if (file === "package.json") {
      try {
        const manifest = JSON.parse(content);
        add("Node.js", "runtime", path, manifest.engines?.node);
        const dependencies = {
          ...manifest.dependencies,
          ...manifest.devDependencies,
        };
        for (const [dep, version] of Object.entries(dependencies)) {
          const info = known[dep];
          if (info)
            add(
              info[0],
              info[1],
              path,
              typeof version === "string" ? version : undefined,
            );
        }
        if (path === "package.json") {
          const manager =
            typeof manifest.packageManager === "string"
              ? manifest.packageManager.split("@")[0]
              : "npm";
          const safeManager = ["npm", "pnpm", "yarn", "bun"].includes(manager)
            ? manager
            : "npm";
          commands.setup = `${safeManager} install`;
          for (const name of ["dev", "test", "deploy"] as const)
            if (manifest.scripts?.[name])
              commands[name] = `${safeManager} run ${name}`;
        }
      } catch {
        warnings.push(`Could not parse ${path}.`);
      }
    }
    if (["pyproject.toml", "requirements.txt", "Pipfile"].includes(file)) {
      add("Python", "language", path);
      for (const [pattern, name, category] of [
        [/\bfastapi\b/i, "FastAPI", "framework"],
        [/\bdjango\b/i, "Django", "framework"],
        [/\bflask\b/i, "Flask", "framework"],
        [/\bsqlalchemy\b/i, "SQLAlchemy", "database"],
        [/\bcelery\b/i, "Celery", "jobs"],
        [/\bpytest\b/i, "pytest", "testing"],
      ] as const)
        if (pattern.test(content)) add(name, category, path);
      if (!commands.setup && file === "requirements.txt")
        commands.setup = "python -m pip install -r requirements.txt";
    }
    if (file === "go.mod") {
      add("Go", "language", path, content.match(/^go\s+([\d.]+)/m)?.[1]);
      if (content.includes("gin-gonic/gin")) add("Gin", "framework", path);
    }
    if (file === "Cargo.toml") {
      add("Rust", "language", path);
      if (/\baxum\b/.test(content)) add("Axum", "framework", path);
    }
    if (file === "composer.json") {
      add("PHP", "language", path);
      if (content.includes("laravel/framework"))
        add("Laravel", "framework", path);
    }
    if (file.endsWith(".csproj")) add(".NET", "framework", path);
    if (file === "Gemfile") {
      add("Ruby", "language", path);
      if (/['"]rails['"]/.test(content)) add("Rails", "framework", path);
    }
    if (file === "pom.xml" || file.startsWith("build.gradle"))
      add("Java / JVM", "runtime", path);
    if (/^Dockerfile/.test(file) || /^(docker-)?compose\.ya?ml$/.test(file))
      add("Docker", "infrastructure", path);
    if (/^wrangler\.(jsonc?|toml)$/.test(file))
      add("Cloudflare Workers", "hosting configuration", path);
    if (file === "vercel.json") add("Vercel", "hosting configuration", path);
    if (file === "netlify.toml") add("Netlify", "hosting configuration", path);
    if (file === "fly.toml") add("Fly.io", "hosting configuration", path);
  }
  return { stack: items.slice(0, 100), commands, warnings };
}
export const manifestPattern =
  /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|Pipfile|go\.mod|Cargo\.toml|composer\.json|Gemfile|pom\.xml|build\.gradle(?:\.kts)?|[^/]+\.csproj|Dockerfile(?:\.[^/]+)?|(?:docker-)?compose\.ya?ml|wrangler\.(?:jsonc?|toml)|vercel\.json|netlify\.toml|fly\.toml)$/;
export function candidateToProject(candidate: ImportCandidate) {
  return {
    name: candidate.name,
    description: candidate.description,
    stack: candidate.stack,
    commands: candidate.commands,
    resources: candidate.repository
      ? [
          {
            id: crypto.randomUUID(),
            name: "Source code",
            kind: "repository",
            url: candidate.repository,
            environment: "",
            provider: "GitHub",
            note: "",
          },
        ]
      : [],
    deployments: candidate.localPath
      ? [
          {
            id: crypto.randomUUID(),
            name: "Local development",
            environment: "local",
            provider: "Local",
            url: "",
            dashboardUrl: "",
            machineId: "",
            localPath: candidate.localPath,
            expectedRunning: false,
          },
        ]
      : [],
  };
}
