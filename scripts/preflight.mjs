import { unstable_readConfig } from "wrangler";
// Use the pinned Wrangler parser so valid JSONC comments and trailing commas work.
const config = unstable_readConfig({ config: "wrangler.jsonc" });
const missing = [];
if (!/^[a-f0-9]{32}$/i.test(config.account_id || ""))
  missing.push("Pin the intended Cloudflare account_id in wrangler.jsonc.");
if (
  config.d1_databases[0].database_id === "00000000-0000-0000-0000-000000000000"
)
  missing.push(
    "Create a D1 database and put its database_id in wrangler.jsonc.",
  );
for (const name of [
  "ACCESS_TEAM_DOMAIN",
  "OIDC_CLIENT_ID",
  "APP_ORIGINS",
  "ALLOWED_EMAILS",
])
  if (!config.vars[name])
    missing.push(
      `Set ${name} in wrangler.jsonc (see docs/CLOUDFLARE_SETUP.md).`,
    );
if (
  !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(
    config.vars.ACCESS_TEAM_DOMAIN || "",
  )
)
  missing.push(
    "ACCESS_TEAM_DOMAIN must be your Cloudflare Access team hostname.",
  );
for (const origin of String(config.vars.APP_ORIGINS || "").split(",")) {
  try {
    const url = new URL(origin.trim());
    if (url.protocol !== "https:" || url.origin !== origin.trim())
      throw new Error();
  } catch {
    missing.push("APP_ORIGINS must contain exact HTTPS origins without paths.");
  }
}
if (config.vars.ENVIRONMENT !== "production")
  missing.push("Set ENVIRONMENT to production.");
if (process.env.OPSG_DEV_PROXY)
  missing.push("Unset OPSG_DEV_PROXY before building a deployment.");
if (missing.length) {
  console.error(
    "Deployment setup is incomplete:\n" +
      missing.map((s) => "- " + s).join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    "Deployment configuration is ready. Install OIDC_CLIENT_SECRET as a Worker secret before signing in.",
  );
