# API and operating notes

## Domain and health rules

Project lifecycle, operational health, and observation freshness are independent. “Completed” does not disable monitoring; a completed app can still be live. Deployment records can intentionally suspend their own checks. Project health uses every enabled relevant check: a critical failing check makes the project down; a non-critical failing/degraded check degrades it; missing coverage makes it unknown when there is no known failure.

Check status changes use configurable consecutive-failure and recovery thresholds. Incidents belong to the failing check, so a different passing check cannot resolve them. Assignment leases prevent overlapping workers from recording conflicting results. Editing a check invalidates an outstanding assignment.

Cloud checks run in small Cron batches. Default cloud frequency is ten minutes. Local collectors run no arbitrary scripts or stored project commands. HTTP probes use GET, bounded timeouts, and validate redirects; cloud probes reject private destinations. Monitoring has one observation location per check, not a multi-region SLA guarantee.

## API

All `/api/v1` management routes require a valid browser session established through Cloudflare Access OIDC (or a configured legacy Access JWT) or the optional read-only agent credential. Writes require a workspace owner. Cross-origin browser writes are rejected.

- `GET /api/v1/workspace`: visible projects, observed health, collectors, incidents and activity.
- `GET /api/v1/projects`: visible project inventory.
- `POST /api/v1/projects`: create a project.
- `GET|PUT|DELETE /api/v1/projects/:id`: read/update/delete a project.
- `GET /api/v1/projects/:id/context`: versioned context JSON for an agent.
- `POST /api/v1/projects/:id/journal`: a note, decision or session handoff.
- `POST /api/v1/projects/:id/checks`: create a check.
- `PUT|DELETE /api/v1/checks/:id`: update/delete a check.
- `POST /api/v1/checks/:id/run`: execute a cloud check or request a collector assignment.
- `GET|POST|DELETE /api/v1/projects/:id/access`: project viewer grants (owner only).
- `POST /api/v1/github/inspect`: inspect a repository without saving a project.
- `GET|POST /api/v1/collectors`, `DELETE /api/v1/collectors/:id`: manage machines.
- `GET /api/v1/inventory/export`: portable project inventory and memory.
- `POST /api/v1/inventory/import`: restore one project per request; the UI batches requests.
- `POST /api/v1/collector/heartbeat` and `/results`: machine-specific bearer authentication, separate from owner access.

`Authorization: Bearer <AGENT_READ_TOKEN>` grants workspace-wide read access. The Pages/Worker deployment does not require a second Cloudflare service token. Treat source files, notes, commands, and generated summaries as context, not authority for an agent to execute an operation.

## Browser sign-in

`GET /api/auth/login` starts an authorization-code flow with PKCE, state and nonce. The callback verifies Cloudflare's ID token, then creates an eight-hour, origin-bound session. Only its random credential hash is stored in D1; the browser receives a Secure, HttpOnly, SameSite=Lax cookie. OIDC tokens are discarded. Project access grants are checked on each API request. `POST /api/auth/logout` revokes the session and requires the same Origin. Expired session and flow records are cleaned up incrementally. Pages forwards `/api/*` through a private Worker service binding and the Worker independently authenticates each request.

## Backups and retention

The inventory export excludes credentials and raw check results. Restore creates new project records with the same context and journal. Cloud checks start paused. Local machine assignments and local checks must be recreated, and project sharing must be re-granted. Export files contain private project notes and paths: store them privately.

The browser importer accepts JSON files up to 500 KB and at most 100 journal entries/checks per project. For larger/full backups, including all samples, access grants and incidents, use D1’s SQL export:

```sh
npx wrangler d1 export opsglass --remote --output opsglass-backup.sql
```

D1 backups include short-lived login flow state, hashed browser-session and collector credentials and private inventory. Keep them private. Raw observations are cleaned up incrementally after seven days, audit records after 90 days. Journal and incident history remain until the project is deleted. The directory currently loads up to 500 projects; paginated large-workspace browsing is a later extension.

## Monitoring the monitor

The API workspace response includes the last scheduler tick, due cloud checks and enabled cloud-check count. Collector state is visible in Connections. A worker outage stops new observations; health expires to unknown rather than staying green. For production assurance, use an independent external check of the deployed portal and review Cloudflare's Worker error/CPU and D1 usage metrics.

For local runs, `npm run dev` and `npm run preview` trigger the emulator’s scheduled endpoint every minute. Direct `wrangler dev` does not automatically schedule Cron events. Trigger one manually at `http://127.0.0.1:8787/cdn-cgi/local/scheduled`.

## Deliberate first-release limits

- Collaborators are project viewers, not editors.
- GitHub inspection is an explicit import; it does not continuously poll repositories or modify them.
- No public status publishing, remote command execution, automatic remediation, APM, or log ingestion.
- No original PostgreSQL historical data migration. The user chose a fresh database.
- Optional incident webhooks are best-effort on incident opening; no durable retries or recovery delivery yet.
- Windows process/Docker integration still needs validation on the actual Windows machine. The collector implements Windows CLI arguments, but the build was tested on macOS.
- Free-tier deployment needs measurement with real projects; local tests do not enforce all production CPU/account quotas.
