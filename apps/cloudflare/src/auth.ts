import { createRemoteJWKSet, jwtVerify } from "jose";
import { Env, HttpError, localDevelopment } from "./env";
import { digest, secretMatches } from "./credentials";
import { oidcConfigured, sessionEmail } from "./session";
export { digest, secretMatches };
export type Identity = { email: string; role: "owner" | "viewer" | "agent" };
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authenticate(
  request: Request,
  env: Env,
): Promise<Identity> {
  if (localDevelopment(request, env))
    return { email: "local@opsglass", role: "owner" };
  const bearer =
    request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
  if (
    env.AGENT_READ_TOKEN &&
    (await secretMatches(bearer, env.AGENT_READ_TOKEN))
  )
    return { email: "agent", role: "agent" };
  const session = await sessionEmail(request, env);
  if (session) return identityForEmail(env, session);
  if (oidcConfigured(env) && !request.headers.get("Cf-Access-Jwt-Assertion"))
    throw new HttpError(401, "Sign in with Cloudflare to open your workspace.");
  const team = env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//, "").replace(
    /\/$/,
    "",
  );
  if (!team || !env.ACCESS_AUD || !env.ALLOWED_EMAILS)
    throw new HttpError(
      503,
      "OpsGlass is locked. Configure Cloudflare Access and your owner email before opening the workspace.",
    );
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team))
    throw new HttpError(503, "Cloudflare Access team domain is invalid.");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token)
    throw new HttpError(
      401,
      "Sign in through Cloudflare Access to open this workspace.",
    );
  let email = "";
  try {
    let keys = keySets.get(team);
    if (!keys) {
      keys = createRemoteJWKSet(
        new URL(`https://${team}/cdn-cgi/access/certs`),
      );
      keySets.set(team, keys);
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://${team}`,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    email =
      typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  } catch {
    throw new HttpError(
      401,
      "Your sign-in has expired or could not be verified. Sign in again.",
    );
  }
  return identityForEmail(env, email);
}
export async function identityForEmail(
  env: Env,
  email: string,
): Promise<Identity> {
  if (!email) throw new HttpError(403, "An email identity is required.");
  const owners = env.ALLOWED_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (owners.includes(email)) return { email, role: "owner" };
  const access = await env.DB.prepare(
    "SELECT 1 FROM project_access WHERE email = ? LIMIT 1",
  )
    .bind(email)
    .first();
  if (!access)
    throw new HttpError(
      403,
      "No projects have been shared with this email address.",
    );
  return { email, role: "viewer" };
}
export function ownerOnly(user: Identity) {
  if (user.role !== "owner")
    throw new HttpError(403, "Only the workspace owner can make this change.");
}
export async function projectPermission(
  env: Env,
  user: Identity,
  projectId: string,
) {
  if (user.role !== "viewer") return;
  if (
    !(await env.DB.prepare(
      "SELECT 1 FROM project_access WHERE project_id = ? AND email = ?",
    )
      .bind(projectId, user.email)
      .first())
  )
    throw new HttpError(404, "Project not found.");
}
export function checkOrigin(request: Request, env: Env) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return; // CLI requests still require a credential.
  if (origin === new URL(request.url).origin) return;
  if (
    localDevelopment(request, env) &&
    [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:8787",
      "http://127.0.0.1:8787",
    ].includes(origin)
  )
    return;
  throw new HttpError(403, "Cross-origin writes are not allowed.");
}
