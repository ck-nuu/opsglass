# OpsGlass

OpsGlass is a Unified Application & Dependency Monitoring Platform.

## Architecture

- `apps/web`: Next.js dashboard and API
- `apps/worker`: Node.js monitoring worker (using BullMQ)
- `packages/database`: Shared database schema and Drizzle ORM
- `packages/core`: Shared types and logic

## Production Monitoring

### Checking Worker Health

To verify if the monitoring worker is running correctly in production, use the built-in health check tool. This will verify:
- Database connectivity and recent check activity.
- Redis connectivity and BullMQ queue status.
- Number of active workers listening to the queue.
- Upcoming scheduled checks.

Run the following command from the root directory:

```bash
npm run health-check --filter=worker
```

Or from the `apps/worker` directory:

```bash
npm run health-check
```

### Healthy Output Example

```text
🚀 --- OpsGlass Worker Health Check ---

📊 1. Database Status
   ✅ Components: 11
   ✅ Total Checks: 9
   ✅ Total Results: 5459

🕒 Recent Check Activity (last 5):
   ✅ [7:13:51 AM] DNS (11ms): Resolved 6 records
   ✅ [7:13:43 AM] DNS (11ms): Resolved 1 records

🔋 2. Queue & Redis Status
   ✅ Redis connected (redis://localhost:6379)
   ✅ Active Workers: 3
   📦 Job Counts:
      Waiting:   0
      Active:    0
      Completed: 5763
      Failed:    955

📅 3. Scheduler Prognosis
   ✅ Due Checks: 0
```

## Development

### Setup

1. Copy `.env.example` to `.env` and fill in the values.
2. Install dependencies: `npm install`
3. Start local infrastructure: `docker-compose up -d`
4. Run development services: `npm run dev`

### Project Structure

- `apps/web`: The main Next.js application.
- `apps/worker`: The background worker that performs the actual checks.
- `packages/database`: Contains the database schema and migrations.
- `packages/core`: Contains shared types and the status calculation engine.
