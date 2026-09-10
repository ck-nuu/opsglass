import { detectStack, manifestPattern } from "@repo/registry/discovery";
import type { ImportCandidate } from "@repo/registry";
import { Env, HttpError } from "./env";
type Entry = { name: string; path: string; type: string; size: number };
export async function inspectRepository(
  env: Env,
  repository: string,
): Promise<ImportCandidate> {
  const match = repository
    .trim()
    .match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!match)
    throw new HttpError(
      400,
      "Use a GitHub repository URL or owner/repository.",
    );
  const owner = match[1];
  const name = match[2];
  const root = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "OpsGlass",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  async function get(path: string) {
    const response = await fetch(root + path, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404)
      throw new HttpError(
        404,
        "Repository not found or not accessible. Private repositories need a GitHub token configured on the Worker.",
      );
    if (response.status === 403 || response.status === 429)
      throw new HttpError(
        429,
        "GitHub rate limit or permission restriction. Try later or configure a read-only GitHub token.",
      );
    if (!response.ok)
      throw new HttpError(502, `GitHub returned ${response.status}.`);
    return response.json() as Promise<any>;
  }
  const repo = await get("");
  const rootEntries = (await get(
    `/contents?ref=${encodeURIComponent(repo.default_branch)}`,
  )) as Entry[];
  if (!Array.isArray(rootEntries))
    throw new HttpError(400, "This repository has no readable files yet.");
  const entries = [...rootEntries];
  const warnings: string[] = [];
  for (const dir of rootEntries
    .filter(
      (e) =>
        e.type === "dir" &&
        ["apps", "packages", "services", "backend", "frontend"].includes(
          e.name,
        ),
    )
    .slice(0, 3)) {
    const children = (await get(
      `/contents/${encodeURIComponent(dir.path)}?ref=${encodeURIComponent(repo.default_branch)}`,
    )) as Entry[];
    if (!Array.isArray(children)) continue;
    entries.push(...children);
    for (const child of children.filter((e) => e.type === "dir").slice(0, 3)) {
      const nested = (await get(
        `/contents/${child.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(repo.default_branch)}`,
      )) as Entry[];
      if (Array.isArray(nested)) entries.push(...nested);
    }
  }
  const manifests = entries
    .filter(
      (e) =>
        e.type === "file" && manifestPattern.test(e.path) && e.size < 80_000,
    )
    .slice(0, 12);
  const files: Record<string, string> = {};
  // A bounded manifest scan keeps one import within Worker subrequest limits.
  for (const file of manifests) {
    const result = await get(
      `/contents/${file.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(repo.default_branch)}`,
    );
    if (result.encoding === "base64" && typeof result.content === "string") {
      const bytes = Uint8Array.from(
        atob(result.content.replace(/\s/g, "")),
        (c) => c.charCodeAt(0),
      );
      files[file.path] = new TextDecoder().decode(bytes);
    }
  }
  const detected = detectStack(files);
  warnings.push(
    ...detected.warnings,
    "Hosting configuration is a clue; confirm the actual deployment location.",
  );
  if (manifests.length >= 12)
    warnings.push(
      "The scan is limited to 12 manifests. Review large monorepos manually.",
    );
  if (!manifests.length)
    warnings.push(
      "No supported manifests were found. Add the technology stack manually.",
    );
  return {
    name: repo.name || name,
    description: repo.description || "",
    repository: `https://github.com/${owner}/${name}`,
    ...detected,
    warnings,
    source: `GitHub: ${owner}/${name}`,
  };
}
