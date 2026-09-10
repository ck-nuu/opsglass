# OpsGlass

A private project workspace for application inventory, technology and hosting details, monitoring, and the context you need to resume work. Next.js/React renders a static frontend; Cloudflare Pages hosts the frontend; a Cloudflare Worker provides the API and scheduled checks; Cloudflare D1 stores the registry.

## Run locally

Requires Node.js **22.18+** and npm. Docker is optional and is only needed for container discovery/checks; the portal database runs in Cloudflare’s local emulator.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The command applies local migrations, starts the API on port 8787 and the Next.js development server on port 3000, and triggers local scheduled checks once per minute. Development access is limited to the loopback host. Production rejects requests until Cloudflare Access is configured.

For a production-build preview:

```sh
npm run build
npm run db:migrate
npm run preview
```

Open http://127.0.0.1:8787. Use `/?demo=1` for an explicitly labelled, read-only example workspace. Demo data is never inserted into the database. The real workspace starts empty.

## What is included

- Search and filter projects by technology and lifecycle; list and grid layouts.
- Project purpose, tags, owner, repositories, providers/accounts, deployments, local paths, and startup/test/deploy instructions.
- Next action, blockers, notes, session handoffs, and architecture decisions.
- GitHub manifest inspection and local folder/Docker discovery with review before import.
- HTTP and DNS checks on Cloudflare; HTTP, DNS, certificate, ping, and Docker checks on Mac/Windows collectors.
- Per-check confirmation thresholds, current observations, expired observations, incidents, and seven days of raw samples.
- Separate collector heartbeat state, revocable machine tokens, and deployment-level monitoring pause.
- Cloudflare Access OIDC sign-in with secure browser sessions. Owners manage the workspace; collaborators have view access to individual projects.
- Audit history, portable inventory export/restore, and read-only agent context APIs.

## Deployment and machine setup

- [Cloudflare setup](docs/CLOUDFLARE_SETUP.md)
- [Mac, Windows, Docker and Tailscale collectors](docs/COLLECTORS.md)
- [API and operating notes](docs/OPERATIONS.md)
- [Implementation decisions](docs/BUILD_PLAN.md)

A Cloudflare account, a Workers subdomain, an owner email, and Cloudflare Access setup are required to deploy. Do not commit tokens. `npm run deploy` checks configuration before building or deploying. `npm run deploy:check` performs a build and local deployment dry-run without publishing.

## Verification

```sh
npm test
npm run test:integration
npm run check-types
npm run lint
npm run deploy:check
```

The integration suite uses an isolated D1 emulator and locally signed authentication fixtures. It does not create Cloudflare resources or send notifications. It covers access isolation, collector scoping/replay, failure/recovery thresholds, stale machines, registry changes, export/restore, PKCE sign-in, cookie-bound sessions, logout, expiry and the Pages API proxy.

## Repository layout

- `apps/web`: Next.js static frontend.
- `apps/pages`: Pages deployment and private API service binding.
- `apps/cloudflare`: Worker API, scheduled checks, and D1 migrations.
- `packages/registry`: shared domain types, health rules, and manifest detection.
- `scripts/collector.mjs`: read-only Node collector and local discovery CLI.
- `legacy/web-app`: original Postgres-backed Next.js server routes and screens, retained for reference.
- `apps/worker`, `packages/database`, `packages/core`: original Node/BullMQ/Postgres implementation. These are not deployed by the new root scripts.

The Cloudflare version starts with a fresh D1 database. No original Postgres data is modified. The original public status pages are retained as source in `legacy/`; the new portal is private and does not publish project details.
