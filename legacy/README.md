# Original implementation

`web-app/` contains the original Next.js API routes and organisation/status screens before the Cloudflare project-portal work. They use `packages/database` (PostgreSQL) and the original `apps/worker` (BullMQ/Redis). They are preserved for reference and excluded from the new static Next.js build.

The new app uses `apps/cloudflare` and Cloudflare D1. Do not expose these archived routes as a public management API: they predate the new authentication and project-level authorization.
