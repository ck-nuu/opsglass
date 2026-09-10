import { createRemoteJWKSet, jwtVerify, base64url } from "jose";
import { Env, HttpError } from "./env";
import { digest } from "./credentials";
const SESSION = "__Host-opsglass_session";
const FLOW = "__Host-opsglass_login";
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const now = () => Math.floor(Date.now() / 1000);
const random = () =>
  base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
function cookie(request: Request, name: string) {
  const values = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + "="));
  if (values.length !== 1) return "";
  const value = values[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
}
function cookieValue(name: string, value: string, age: number) {
  return (
    name +
    "=" +
    value +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
    age
  );
}
function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 303, headers });
}
export function oidcConfigured(env: Env) {
  return Boolean(
    env.OIDC_CLIENT_ID &&
    env.OIDC_CLIENT_SECRET &&
    env.ACCESS_TEAM_DOMAIN &&
    env.APP_ORIGINS,
  );
}
function settings(request: Request, env: Env) {
  if (!oidcConfigured(env))
    throw new HttpError(503, "Cloudflare sign-in setup is incomplete.");
  const team = env.ACCESS_TEAM_DOMAIN;
  if (
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) ||
    !/^[A-Za-z0-9_-]+$/.test(env.OIDC_CLIENT_ID!)
  )
    throw new HttpError(503, "Cloudflare sign-in configuration is invalid.");
  const url = new URL(request.url);
  const allowed = (env.APP_ORIGINS || "")
    .split(",")
    .map((value) => value.trim());
  if (url.protocol !== "https:" || !allowed.includes(url.origin))
    throw new HttpError(403, "Sign-in is not available on this hostname.");
  const issuer =
    "https://" + team + "/cdn-cgi/access/sso/oidc/" + env.OIDC_CLIENT_ID;
  return {
    origin: url.origin,
    issuer,
    callback: url.origin + "/api/auth/callback",
  };
}
export async function sessionEmail(
  request: Request,
  env: Env,
): Promise<string | null> {
  const token = cookie(request, SESSION);
  if (!token || !oidcConfigured(env)) return null;
  const { origin } = settings(request, env);
  const row = await env.DB.prepare(
    "SELECT email FROM browser_sessions WHERE id = ? AND origin = ? AND expires_at > ?",
  )
    .bind(await digest(token), origin, now())
    .first<{ email: string }>();
  if (!row)
    throw new HttpError(401, "Your session has expired. Sign in again.");
  return row.email;
}
type Flow = { nonce: string; verifier: string; origin: string };
export async function authRoute(
  request: Request,
  env: Env,
  authorize: (email: string) => Promise<unknown>,
): Promise<Response> {
  const { origin, issuer, callback } = settings(request, env);
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/auth/login" && request.method === "GET") {
    const moment = now();
    const address = request.headers.get("CF-Connecting-IP") || "unknown";
    const bucket = await digest(address + ":" + Math.floor(moment / 600));
    const allowed = await env.DB.prepare(
      "INSERT INTO login_rate_limits(bucket, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 WHERE attempts < 10 RETURNING attempts",
    )
      .bind(bucket, moment + 1200)
      .first();
    if (!allowed)
      throw new HttpError(
        429,
        "Too many sign-in attempts. Try again in ten minutes.",
      );
    const flowId = random(),
      state = random(),
      nonce = random(),
      verifier = random();
    const challenge = base64url.encode(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      ),
    );
    await env.DB.prepare(
      "INSERT INTO login_flows(id, state_hash, nonce, verifier, origin, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        await digest(flowId),
        await digest(state),
        nonce,
        verifier,
        origin,
        moment + 600,
      )
      .run();
    const destination = new URL(issuer + "/authorization");
    destination.search = new URLSearchParams({
      client_id: env.OIDC_CLIENT_ID!,
      redirect_uri: callback,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    return redirect(destination.href, [cookieValue(FLOW, flowId, 600)]);
  }
  if (path === "/api/auth/callback" && request.method === "GET") {
    const flowId = cookie(request, FLOW);
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    if (
      !flowId ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      !code ||
      code.length > 4096 ||
      url.searchParams.has("error")
    )
      throw new HttpError(
        400,
        "Sign-in was not completed. Return to OpsGlass and try again.",
      );
    // Atomically consume the browser-bound flow, preventing cross-site callbacks and replay.
    const flow = await env.DB.prepare(
      "DELETE FROM login_flows WHERE id = ? AND state_hash = ? AND origin = ? AND expires_at > ? RETURNING nonce, verifier, origin",
    )
      .bind(await digest(flowId), await digest(state), origin, now())
      .first<Flow>();
    if (!flow)
      throw new HttpError(
        400,
        "This sign-in request expired or was already used. Start sign-in again.",
      );
    let email: string;
    try {
      const response = await fetch(issuer + "/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callback,
          client_id: env.OIDC_CLIENT_ID!,
          client_secret: env.OIDC_CLIENT_SECRET!,
          code_verifier: flow.verifier,
        }),
        // Workers supports manual redirects; the status check below rejects them.
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        console.error("OIDC token exchange rejected", {
          status: response.status,
        });
        await response.body?.cancel();
        throw new Error("exchange");
      }
      const tokens = (await response.json()) as { id_token?: string };
      if (!tokens.id_token || tokens.id_token.length > 32768)
        throw new Error("token");
      let jwks = keys.get(issuer);
      if (!jwks) {
        jwks = createRemoteJWKSet(new URL(issuer + "/jwks"));
        keys.set(issuer, jwks);
      }
      const { payload } = await jwtVerify(tokens.id_token, jwks, {
        issuer,
        audience: env.OIDC_CLIENT_ID!,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "sub", "nonce", "email"],
        maxTokenAge: "15m",
      });
      if (
        payload.nonce !== flow.nonce ||
        payload.email_verified === false ||
        typeof payload.email !== "string" ||
        !payload.email.includes("@")
      )
        throw new Error("identity");
      email = payload.email.toLowerCase();
    } catch (error) {
      const failure = error as {
        code?: string;
        claim?: string;
        message?: string;
      };
      // Record only fixed failure categories, never tokens, codes, identity or secrets.
      console.error("OIDC sign-in verification failed", {
        reason: ["exchange", "token", "identity"].includes(
          failure.message || "",
        )
          ? failure.message
          : "jwt",
        code: /^[A-Z_]+$/.test(failure.code || "") ? failure.code : undefined,
        claim: ["iss", "aud", "exp", "iat", "sub", "nonce", "email"].includes(
          failure.claim || "",
        )
          ? failure.claim
          : undefined,
      });
      throw new HttpError(
        401,
        "Cloudflare sign-in could not be verified. Return to OpsGlass and try again.",
      );
    }
    await authorize(email);
    const token = random();
    // Persist only a random credential hash. Discard all OIDC tokens after verification.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM browser_sessions WHERE id = ?").bind(
        await digest(cookie(request, SESSION)),
      ),
      env.DB.prepare(
        "INSERT INTO browser_sessions(id, email, origin, expires_at) VALUES (?, ?, ?, ?)",
      ).bind(await digest(token), email, origin, now() + 8 * 3600),
    ]);
    return redirect(origin + "/", [
      cookieValue(FLOW, "", 0),
      cookieValue(SESSION, token, 8 * 3600),
    ]);
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    if (request.headers.get("Origin") !== origin)
      throw new HttpError(403, "Sign out from the OpsGlass page.");
    await env.DB.prepare(
      "DELETE FROM browser_sessions WHERE id = ? AND origin = ?",
    )
      .bind(await digest(cookie(request, SESSION)), origin)
      .run();
    return redirect(origin + "/", [
      cookieValue(SESSION, "", 0),
      cookieValue(FLOW, "", 0),
    ]);
  }
  throw new HttpError(405, "This sign-in action does not support that method.");
}
