# Cloudflare deployment

OpsGlass uses Cloudflare Pages for the static frontend, a Worker for the API and scheduled checks, and D1 for its database. Pages Functions forward `/api/*` to the Worker using a private service binding. GoDaddy can continue managing `mdanso.com` DNS.

## Account and database

Use Node.js 22.18+ and npm. The named Wrangler profile preserves unrelated Cloudflare logins:

```sh
npm ci
npx wrangler auth create opsglass
npx wrangler auth activate opsglass
npx wrangler whoami
```

This installation uses `learn@mdanso.com`, account `bfc8014b99ecc75f4211e56ca6bb2233`. Keep that account ID in the Worker configuration and the `deploy:frontend` script. Pages does not accept `account_id` in its configuration file. The owner login is separately `ops@mdanso.com`.

D1 database `opsglass` already exists, ID `b9daadab-29fe-4932-9b9b-071c68eb08b2`. Do not recreate it. For a new installation, use `npx wrangler d1 create opsglass --location weur` and copy its ID into `wrangler.jsonc`.

## Cloudflare sign-in

Complete Zero Trust's free-plan onboarding. Under Integrations → Identity providers, add One-time PIN, or use another appropriate identity provider.

Under Access controls → Applications, create a **SaaS application using OpenID Connect**, named `OpsGlass SSO`. This works with the Pages subdomain while authoritative DNS remains at GoDaddy. Configure:

- Scopes: `openid`, `email`, `profile`.
- Enable PKCE. Leave “Allow PKCE without Client Secret” off.
- Redirect URLs, exactly:
  - `https://ops.mdanso.com/api/auth/callback`
  - `https://opsglass-mdanso.pages.dev/api/auth/callback`
  - `https://opsglass.mdanso-ops.workers.dev/api/auth/callback`
- Allow policy: include the exact owner email `ops@mdanso.com`.
- Permit the One-time PIN identity provider.

The reference application shape is in `docs/access-application.json`. The configured application ID is recorded in `docs/DEPLOYMENT.md`. Do not recreate an existing application.

Non-secret Worker variables:

- `ACCESS_TEAM_DOMAIN`: `sweet-sea-9ab8.cloudflareaccess.com`.
- `OIDC_CLIENT_ID`: the application's client ID.
- `APP_ORIGINS`: comma-separated exact HTTPS origins corresponding to the redirects, without trailing slashes.
- `ALLOWED_EMAILS`: workspace owners, initially `ops@mdanso.com`. These emails have access to every project.
- `ENVIRONMENT`: `production`.

Generate the client secret in Cloudflare and store it only as a Worker secret:

```sh
npx wrangler secret put OIDC_CLIENT_SECRET
```

Never commit or put the secret in frontend variables. The API independently verifies sign-in using the OIDC signature, issuer, audience, expiry, nonce, PKCE and browser-bound state. It stores only a hash of the opaque eight-hour session credential in D1. Cookies are Secure, HttpOnly and SameSite=Lax. Missing authentication/configuration locks private API routes. The public shell and labelled demo contain no private inventory.

## Publish

The Cloudflare account email must be verified before Workers/Pages publishing is permitted.

Create the actual Pages project once:

```sh
npx wrangler pages project create opsglass-mdanso --production-branch main --force
```

With pinned Wrangler 4.130, `--force` selects Pages instead of its automatic migration to Workers. This is needed for the custom subdomain with external DNS.

Apply migrations and deploy:

```sh
npm run db:migrate:remote
npm run deploy
```

The root deploy builds and publishes the Worker, then publishes Pages with its `API` service binding. `OIDC_CLIENT_SECRET` must be installed before sign-in can work. If installing a secret before the Worker exists, Wrangler may offer to create it; otherwise install immediately after the first Worker deployment.

Check the public health endpoint, an unauthenticated private API request (must be denied), and the full owner sign-in flow. `/api/health` intentionally exposes only service/version metadata. Preview URLs on the Worker are disabled; arbitrary Pages preview hosts are not allowed to start sign-in.

## Connect ops.mdanso.com without moving DNS

First attach `ops.mdanso.com` under the Pages project's **Custom domains**. Then add this record at GoDaddy:

| Type | Name | Target |
| --- | --- | --- |
| CNAME | `ops` | `opsglass-mdanso.pages.dev` |

Use the actual production Pages hostname returned by Cloudflare if it differs. Do not change nameservers. If an `ops` record exists, review it before replacing it. Wait for Pages to validate DNS and issue its certificate. Creating the CNAME before attaching the domain to Pages can produce an error.

The backend can remain `opsglass.mdanso-ops.workers.dev`. Browser API calls stay on the frontend's origin through the private service binding, so this does not require cross-site login cookies or permissive CORS.

## Collectors and optional integrations

Register each machine in OpsGlass and download its private collector configuration. Run the collector with Node.js 22.18+ and appropriate Docker access. It sends outbound HTTPS requests using its own scoped, revocable credential. This deployment does not need a Cloudflare Access service token for collectors or agents. Tailscale stays on the local machines.

Optional Worker secrets:

```sh
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put AGENT_READ_TOKEN
npx wrangler secret put ALERT_WEBHOOK_URL
```

- `GITHUB_TOKEN`: optional fine-grained read-only Contents/Metadata access to selected private repositories.
- `AGENT_READ_TOKEN`: a long random secret granting read access to the whole workspace, not project-restricted access.
- `ALERT_WEBHOOK_URL`: optional owner-chosen HTTPS destination for best-effort incident-open notifications. No durable retries or recovery notifications yet. Leave unset until notifications are wanted.

Secrets never appear in API responses. Collector credentials are hashed in D1 and shown only at registration.

## Share a project

Grant an email view access in the project's **Access** tab and allow that email in the Cloudflare SSO application's policy. Do not add it to `ALLOWED_EMAILS` unless it should administer every project. Viewers can read shared project notes, paths and monitoring; they cannot edit projects or manage machines. No invitation emails are sent automatically.

## Free-tier operating budget

Defaults: at most 30 enabled cloud checks, at least ten minutes apart, three processed per minute. Collectors pull at most five due checks per heartbeat. Raw samples expire after seven days, audit entries after 90 days. Cleanup runs incrementally.

Pages Functions and Worker API/cron invocations use the account's Workers allowance; D1 also has shared daily row-read/write limits. Monitor actual usage and CPU after adding real projects. Lengthen check intervals or pause unused checks if needed. Deployment does not enable a paid plan.

References:

- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/saas-apps/generic-oidc-saas/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
