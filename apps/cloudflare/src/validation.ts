import { z } from "zod";
import { lifecycles } from "@repo/registry";
const short = z.string().trim().max(300);
const url = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (s) => !s || /^https?:\/\/[^\s]+$/i.test(s),
    "Use an http:// or https:// URL.",
  );
export const projectInput = z.object({
  name: short.min(1, "Give the project a name."),
  slug: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z0-9-]*$/)
    .default(""),
  description: z.string().max(3000).default(""),
  organisation: short.default("Personal"),
  owner: short.default(""),
  lifecycle: z.enum(lifecycles).default("building"),
  tags: z.array(short.max(40)).max(20).default([]),
  stack: z
    .array(
      z.object({
        name: short.min(1),
        version: short.optional(),
        category: short.default("framework"),
        source: short.default("manual"),
        detectedAt: z.string().datetime().optional(),
      }),
    )
    .max(100)
    .default([]),
  resources: z
    .array(
      z.object({
        id: short,
        name: short.min(1),
        kind: z.enum([
          "repository",
          "hosting",
          "database",
          "domain",
          "documentation",
          "service",
        ]),
        url,
        environment: short.default(""),
        provider: short.default(""),
        note: z.string().max(2000).default(""),
      }),
    )
    .max(100)
    .default([]),
  deployments: z
    .array(
      z.object({
        id: short,
        name: short.min(1),
        environment: short,
        provider: short.default(""),
        url: url.default(""),
        dashboardUrl: url.default(""),
        machineId: short.default(""),
        localPath: z.string().max(2000).default(""),
        expectedRunning: z.boolean().default(true),
      }),
    )
    .max(30)
    .default([]),
  commands: z
    .object({
      setup: z.string().max(3000).default(""),
      dev: z.string().max(3000).default(""),
      test: z.string().max(3000).default(""),
      deploy: z.string().max(3000).default(""),
    })
    .default({}),
  nextAction: z.string().max(5000).default(""),
  blockers: z.string().max(5000).default(""),
  notes: z.string().max(20000).default(""),
  lastWorkedAt: z.string().datetime().nullable().default(null),
});
export const checkInput = z
  .object({
    name: short.min(1),
    deploymentId: short.default(""),
    kind: z.enum(["http", "dns", "ssl", "ping", "docker"]),
    target: z.string().trim().min(1).max(2048),
    runner: z.enum(["cloud", "collector"]).default("cloud"),
    collectorId: short.default(""),
    interval: z.number().int().min(60).max(86400).default(600),
    timeout: z.number().int().min(1000).max(10000).default(8000),
    expectedStatus: z.number().int().min(100).max(599).default(200),
    expectedValue: short.default(""),
    critical: z.boolean().default(true),
    enabled: z.boolean().default(true),
    failureThreshold: z.number().int().min(1).max(10).default(2),
    recoveryThreshold: z.number().int().min(1).max(10).default(2),
  })
  .superRefine((c, ctx) => {
    if (c.runner === "cloud" && !["http", "dns"].includes(c.kind))
      ctx.addIssue({
        code: "custom",
        message: "TLS, ping, and Docker checks run on a local collector.",
      });
    if (c.runner === "cloud" && c.interval < 600)
      ctx.addIssue({
        code: "custom",
        message:
          "Cloud checks run every 10 minutes or longer on this free-tier configuration.",
      });
    if (c.runner === "collector" && !c.collectorId)
      ctx.addIssue({ code: "custom", message: "Choose a collector." });
    if (c.kind === "http" && !/^https?:\/\//i.test(c.target))
      ctx.addIssue({
        code: "custom",
        message: "HTTP checks need an http:// or https:// URL.",
      });
    if (
      c.kind === "docker" &&
      !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(c.target)
    )
      ctx.addIssue({ code: "custom", message: "Use a container name or ID." });
  });
