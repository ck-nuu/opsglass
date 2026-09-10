# OpsGlass project portal

## Objective

One private place to find every project, understand its stack and hosting, see trustworthy health, and resume work with context. Keep Next.js/React and the existing repository; use a static Next.js export with a Cloudflare Worker API and D1 so the deployed app does not require a separate Postgres/Redis server.

## First release

- Searchable portfolio with independent lifecycle, observed health, and freshness.
- Project purpose, organisation, stack evidence, repository and dashboard links, environment/deployment records, setup commands, next action, blockers, and journal.
- Public/private GitHub repository import with a review before saving.
- Local folder discovery, explicit import, machine registration, and a read-only outbound collector for HTTP, DNS, TLS and ping checks. Docker container inventory and health are opt-in on each machine. No remote shell execution.
- HTTP and DNS monitoring from Cloudflare; TLS and ping from a local collector.
- Per-check failure/recovery thresholds, expiring observations, atomic leases, check history, incidents, and audit events.
- Cloudflare Access login, scoped/revocable collector credentials, optional read-only agent credential, project-restricted collaborator viewers, and context export.
- Export/restore project inventory, deployment instructions, meaningful integration tests, and a clearly labelled demo workspace.

## Deployment and data

The existing Postgres schema and Node worker are retained as legacy source. No existing database is modified. The original Next.js server routes are archived because static hosting uses the new protected Worker API. The owner confirmed that a fresh empty database is appropriate. Portable inventory can be exported and restored; demo data is never written to the real registry.

Production starts locked until the Cloudflare OIDC application, Worker secret, allowed origins and owner email are configured. Pages hosts the frontend and forwards API requests through a private Worker service binding; GoDaddy keeps authoritative DNS. Development authentication is only enabled by the local development command on loopback. Worker and Pages publishing are complete. The custom domain awaits its GoDaddy CNAME; final owner sign-in and real workload validation remain.

Mac and Windows collectors connect outbound over HTTPS. They can probe Tailscale addresses from within the tailnet; Cloudflare does not need access to the private network.

## Free-tier budget

Cloudflare currently documents 100,000 Worker requests/day, 10 ms CPU/invocation, 50 subrequests/invocation, and D1 allowances of 5 million rows read and 100,000 rows written/day. Default checks run every 10 minutes. Schedule small batches, bound history/response sizes, and retain raw samples for seven days. Account-wide quotas and actual CPU use still require production validation.

Sources checked 2026-09-09:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/

## Verification

Type checking, production static build, Worker dry-run, local D1 migrations, API integration tests (access, CRUD, stale states, thresholds, isolation, export/import), collector discovery tests, and desktop/mobile browser review.
