import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { generateKeyPair, exportJWK, SignJWT, base64url } from "jose";
import worker from "../apps/cloudflare/src/index";
import { onRequest } from "../apps/pages/functions/api/[[path]]";
import type { Env } from "../apps/cloudflare/src/env";
test("Pages gateway and OIDC browser sessions", async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      name: "session-test",
      modules: true,
      script: `export default {async fetch(request){
        const {url, redirect} = await request.json();
        try { const outgoing = new Request(url, {redirect}); return Response.json({redirect:outgoing.redirect}); }
        catch(error) { return Response.json({error:error.message}, {status:400}); }
      }}`,
      compatibilityDate: "2026-09-09",
      d1Databases: { DB: "sessions-test" },
    }),
  );
  const db = await mf.getD1Database("DB", "session-test");
  for (const migration of ["0001_registry.sql", "0002_browser_sessions.sql"]) {
    const sql = await readFile(
      new URL("../apps/cloudflare/migrations/" + migration, import.meta.url),
      "utf8",
    );
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  }
  const issuer =
    "https://session-test.cloudflareaccess.com/cdn-cgi/access/sso/oidc/client-test";
  const origin = "https://portal.example";
  const env = {
    DB: db,
    ENVIRONMENT: "production",
    ACCESS_TEAM_DOMAIN: "session-test.cloudflareaccess.com",
    ACCESS_AUD: "",
    ALLOWED_EMAILS: "owner@example.test",
    OIDC_CLIENT_ID: "client-test",
    OIDC_CLIENT_SECRET: "server-only-secret",
    APP_ORIGINS: origin,
  } as unknown as Env;
  const pair = await generateKeyPair("RS256");
  const jwk = await exportJWK(pair.publicKey);
  jwk.kid = "session-key";
  const originalFetch = globalThis.fetch;
  let nonce = "",
    challenge = "",
    email = "owner@example.test",
    wrongNonce = false,
    exchangeRedirect = false,
    exchangeCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === issuer + "/jwks") return Response.json({ keys: [jwk] });
    if (url === issuer + "/token") {
      // Validate the real token request options inside workerd, not only Node's Fetch API.
      const runtime = await mf.dispatchFetch("http://localhost", {
        method: "POST",
        body: JSON.stringify({ url, redirect: init?.redirect }),
      });
      assert.equal(runtime.status, 200, await runtime.text());
      exchangeCalls++;
      if (exchangeRedirect)
        return new Response(null, {
          status: 302,
          headers: { Location: "https://untrusted.example/token" },
        });
      const form = new URLSearchParams(String(init?.body));
      assert.equal(form.get("client_secret"), env.OIDC_CLIENT_SECRET);
      assert.equal(form.get("redirect_uri"), origin + "/api/auth/callback");
      assert.equal(
        base64url.encode(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(form.get("code_verifier")!),
            ),
          ),
        ),
        challenge,
      );
      const token = await new SignJWT({
        email,
        nonce: wrongNonce ? "wrong" : nonce,
      })
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
        .setIssuer(issuer)
        .setAudience("client-test")
        .setSubject("user-test")
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(pair.privateKey);
      return Response.json({ id_token: token });
    }
    throw new Error("Unexpected network request: " + url);
  };
  const request = (
    path: string,
    method = "GET",
    cookies = "",
    extra: Record<string, string> = {},
  ) =>
    worker.fetch(
      new Request(origin + path, {
        method,
        headers: { Cookie: cookies, ...extra },
      }),
      env,
    );
  async function begin() {
    const response = await request("/api/auth/login");
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get("Location")!);
    nonce = location.searchParams.get("nonce")!;
    challenge = location.searchParams.get("code_challenge")!;
    assert.equal(location.searchParams.get("code_challenge_method"), "S256");
    assert.equal(
      location.searchParams.get("redirect_uri"),
      origin + "/api/auth/callback",
    );
    const setCookie = response.headers.get("Set-Cookie")!;
    assert.match(setCookie, /HttpOnly; Secure; SameSite=Lax/);
    return {
      cookie: setCookie.split(";")[0]!,
      state: location.searchParams.get("state")!,
    };
  }
  let sessionCookie = "";
  try {
    await t.test(
      "unauthenticated requests and unapproved login hosts are denied",
      async () => {
        assert.equal((await request("/api/v1/workspace")).status, 401);
        assert.equal(
          (
            await worker.fetch(
              new Request("https://evil.example/api/auth/login"),
              env,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "state and browser binding prevent login CSRF without consuming a valid flow",
      async () => {
        const flow = await begin();
        const before = exchangeCalls;
        assert.equal(
          (await request("/api/auth/callback?code=test&state=" + flow.state))
            .status,
          400,
        );
        assert.equal(
          (
            await request(
              "/api/auth/callback?code=test&state=" + "A".repeat(43),
              "GET",
              flow.cookie,
            )
          ).status,
          400,
        );
        assert.equal(exchangeCalls, before);
        const response = await request(
          "/api/auth/callback?code=test&state=" + flow.state,
          "GET",
          flow.cookie,
        );
        assert.equal(response.status, 303);
        sessionCookie = response.headers
          .getSetCookie()
          .find((v) => v.startsWith("__Host-opsglass_session="))!
          .split(";")[0]!;
        const token = sessionCookie.split("=")[1]!;
        assert.equal(
          (
            await db
              .prepare("SELECT id FROM browser_sessions WHERE id = ?")
              .bind(token)
              .all()
          ).results.length,
          0,
        );
        assert.equal(
          (
            await request(
              "/api/auth/callback?code=test&state=" + flow.state,
              "GET",
              flow.cookie,
            )
          ).status,
          400,
        );
        assert.equal(
          (await request("/api/v1/workspace", "GET", sessionCookie)).status,
          200,
        );
      },
    );
    await t.test(
      "nonce validation and project authorization reject untrusted identities",
      async () => {
        let flow = await begin();
        wrongNonce = true;
        assert.equal(
          (
            await request(
              "/api/auth/callback?code=test&state=" + flow.state,
              "GET",
              flow.cookie,
            )
          ).status,
          401,
        );
        wrongNonce = false;
        email = "unshared@example.test";
        flow = await begin();
        assert.equal(
          (
            await request(
              "/api/auth/callback?code=test&state=" + flow.state,
              "GET",
              flow.cookie,
            )
          ).status,
          403,
        );
        email = "owner@example.test";
      },
    );
    await t.test(
      "token endpoint redirects are rejected without forwarding credentials",
      async () => {
        const flow = await begin();
        exchangeRedirect = true;
        try {
          const response = await request(
            "/api/auth/callback?code=test&state=" + flow.state,
            "GET",
            flow.cookie,
          );
          assert.equal(response.status, 401);
          assert.equal(response.headers.get("Set-Cookie"), null);
        } finally {
          exchangeRedirect = false;
        }
      },
    );
    await t.test(
      "private Pages proxy preserves origin and sessions without granting identity",
      async () => {
        let passed: Request | null = null;
        const proxyEnv = {
          API: {
            fetch: async (req: Request) => {
              passed = req;
              return worker.fetch(req, env);
            },
          },
        };
        const response = await onRequest({
          request: new Request(origin + "/api/v1/workspace", {
            headers: {
              Cookie: sessionCookie,
              "Cf-Access-Jwt-Assertion": "forged",
            },
          }),
          env: proxyEnv,
        } as never);
        assert.equal(response.status, 200);
        assert.equal(passed!.headers.get("Cf-Access-Jwt-Assertion"), null);
        assert.equal(passed!.url, origin + "/api/v1/workspace");
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        assert.equal(
          (
            await request("/api/v1/projects", "POST", sessionCookie, {
              Origin: "https://evil.example",
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "logout requires same-origin POST and revokes the stored session",
      async () => {
        assert.equal(
          (await request("/api/auth/logout", "GET", sessionCookie)).status,
          405,
        );
        assert.equal(
          (await request("/api/auth/logout", "POST", sessionCookie)).status,
          403,
        );
        assert.equal(
          (
            await request("/api/auth/logout", "POST", sessionCookie, {
              Origin: origin,
            })
          ).status,
          303,
        );
        assert.equal(
          (await request("/api/v1/workspace", "GET", sessionCookie)).status,
          401,
        );
      },
    );
    await t.test(
      "expired sessions fail and login requests are rate limited",
      async () => {
        const flow = await begin();
        const response = await request(
          "/api/auth/callback?code=test&state=" + flow.state,
          "GET",
          flow.cookie,
        );
        const expired = response.headers
          .getSetCookie()
          .find((v) => v.startsWith("__Host-opsglass_session="))!
          .split(";")[0]!;
        await db.prepare("UPDATE browser_sessions SET expires_at = 0").run();
        assert.equal(
          (await request("/api/v1/workspace", "GET", expired)).status,
          401,
        );
        for (let i = 0; i < 10; i++) await request("/api/auth/login");
        assert.equal((await request("/api/auth/login")).status, 429);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    await mf.dispose();
  }
});
