# OpsGlass deployment record

Updated 2026-09-10. Owner login: `ops@mdanso.com`. Intended frontend: `ops.mdanso.com`.

## Resources

- Account: `learn@mdanso.com`, ID `bfc8014b99ecc75f4211e56ca6bb2233`.
- Wrangler profile: `opsglass`, scoped to `/Users/md/Projects/opsglass`; default profile preserved.
- D1: `opsglass`, ID `b9daadab-29fe-4932-9b9b-071c68eb08b2`, created with the Western Europe location hint; Cloudflare reported `WEUR`/`LHR`.
- Workers namespace: `mdanso-ops.workers.dev`.
- Live API: `https://opsglass.mdanso-ops.workers.dev`.
- Live Pages frontend: `https://opsglass-mdanso.pages.dev`.
- Zero Trust team: `sweet-sea-9ab8.cloudflareaccess.com`, free plan.
- Access OIDC app: `OpsGlass SSO`, ID `05cc20e9-9786-4741-8613-9be75660999a`.
- Owner policy: `5265a21e-6c34-48f3-99b2-75b8c8d31d33`, exact email `ops@mdanso.com`.

## Publishing status

Both D1 migrations (`0001_registry.sql` and `0002_browser_sessions.sql`) are applied. Cloudflare email verification is complete and publishing succeeded on 2026-09-09.

- Worker `opsglass` is deployed with its once-per-minute cron trigger. Production ticks and cleanup writes are verified on 2026-09-10; observed cron invocations completed successfully.
- `OIDC_CLIENT_SECRET` is installed as a Worker secret.
- Pages production deployment: `0f9fe2b2`, serving `https://opsglass-mdanso.pages.dev`.
- Pages `API` service binding points to Worker `opsglass`.
- SSO uses the exact owner policy and One-time PIN as its selected identity provider.
- Live frontend and health endpoints return 200; unsigned private API requests return 401. Login redirects with a Secure, HttpOnly, SameSite=Lax flow cookie.
- A callback failure was traced to Workers rejecting Fetch `redirect: "error"`. Version `12313536-4e32-4747-9cf5-b8092d4e87eb` uses supported manual redirects and rejects non-success responses, preserving credential isolation. All 18 integration tests pass, including request construction inside workerd and redirect rejection. Final live owner sign-in is awaiting a fresh attempt.
- `ops.mdanso.com` is attached to Pages; validation is pending with “CNAME record not set”.

An unused draft Worker named `opsglass-mdanso` remains from an earlier failed Pages-to-Workers automatic conversion. It has no active routes and is not the live Pages project.

No GoDaddy DNS records or nameservers have been changed. No paid plan was enabled.

## Data hosting

Project inventory, stack evidence, hosting details, notes, checks, observations, incidents, project grants, browser-session hashes and collector-credential hashes reside in D1 in this account. The Western Europe location hint is not a country or residency guarantee. Optional integration credentials are encrypted Worker secrets.

Pages hosts the frontend. Its `/api/*` function forwards to the Worker via a private service binding. The Worker runs the API and scheduled checks. Existing applications, Docker containers and their databases remain on their existing Mac, Windows or internet hosts. Collectors send selected inventory and health observations; they do not upload source code or application databases.

## Custom domain

Keep GoDaddy's authoritative DNS. `ops.mdanso.com` is already attached to the Pages project. Add a GoDaddy CNAME named `ops`, targeting `opsglass-mdanso.pages.dev` (TTL: default). Cloudflare will validate and provision HTTPS. The Worker can keep its temporary hostname. Other subdomains and mail records need no changes.

See `CLOUDFLARE_SETUP.md` for deployment and sign-in commands.
