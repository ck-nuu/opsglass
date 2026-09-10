export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD?: string;
  ALLOWED_EMAILS: string;
  OIDC_CLIENT_ID?: string;
  OIDC_CLIENT_SECRET?: string;
  APP_ORIGINS?: string;
  GITHUB_TOKEN?: string;
  AGENT_READ_TOKEN?: string;
  ALERT_WEBHOOK_URL?: string;
  CHECK_BATCH_SIZE?: string;
  MAX_CLOUD_CHECKS?: string;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export function localDevelopment(request: Request, env: Env) {
  return (
    env.ENVIRONMENT === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
  );
}
export async function bodyJson(request: Request) {
  if (!(request.headers.get("content-type") || "").includes("application/json"))
    throw new HttpError(415, "Send JSON using Content-Type: application/json.");
  if (Number(request.headers.get("content-length") || 0) > 512_000)
    throw new HttpError(
      413,
      "This request is too large. Import fewer projects at once.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 512_000) {
      await reader.cancel();
      throw new HttpError(413, "This request is too large.");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "The request contains invalid JSON.");
  }
}
