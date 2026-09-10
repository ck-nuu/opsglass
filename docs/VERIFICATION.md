# Verification record

Verified locally on macOS on 2026-09-09.

- ESLint: passed with zero warnings.
- TypeScript: Next.js route generation, web application, Cloudflare Worker and Pages Function passed.
- Unit tests: 9 passed, covering stack discovery, skipped secrets and symlinks, Docker opt-in, health aggregation, observation expiry, thresholds cloud target/redirect validation and independent completion of slow collector assignments.
- API integration: 9 scenarios passed against an isolated D1 emulator. Includes production JWT authentication, origin enforcement, project CRUD, collector isolation and replay rejection, independent incidents, recovery thresholds, offline machines, restricted viewers, credential revocation and inventory restore.
- Browser-session integration: 7 additional scenarios passed (18 integration tests including suite parents): PKCE/state/nonce, owner authorization, session hashing/expiry, callback replay, origin checks, logout, login rate limits, and Pages proxy authentication/header handling.
- Production Next.js static export: passed.
- Pages Functions bundle: passed.
- Wrangler deployment dry-run: passed; no resources created or published.
- Local D1 migration and the local scheduled-check endpoint: passed.
- Browser: project creation, technology tags, journal handoff, edits and startup-command persistence checked. Demo and real workspace remain separate. Desktop and mobile layouts reviewed, including a 320px viewport with no horizontal overflow. No browser console errors observed in these flows.

The source project's local database starts empty. Test fixtures and browser verification data were held in separate local emulator storage.

## Still requires the real environment

The Worker and Pages frontend are published. Both D1 migrations are applied and the sign-in secret is installed. Live frontend/health responses, private API denial and sign-in redirect/cookie flags pass. The callback failure was reproduced in workerd: `redirect: "error"` is unsupported. The deployed correction uses manual redirects with explicit non-success rejection. Worker type checking and all 18 integration tests pass, including runtime request-option validation and a token-endpoint redirect regression. Final live owner sign-in is awaiting a fresh attempt. Production cron and cleanup writes are verified; observed cron invocations complete successfully. The custom domain is registered in Pages and awaits its GoDaddy CNAME. Production CPU/usage validation with real projects remains pending. Collectors have automated local tests, but have not yet been installed or tested against the owner's actual Windows/Mac Docker workloads or tailnet. Private GitHub imports require an optional repository-scoped token. Alert delivery is best effort and has no retry queue.
