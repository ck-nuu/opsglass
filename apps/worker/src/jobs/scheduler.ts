import { db, checks, eq, lte, or, isNull } from '@repo/database';
import { checkQueue } from '../lib/queue';
import { sql } from 'drizzle-orm';

export const startScheduler = () => {
    console.log('Scheduler started...');

    // Check every 10 seconds
    setInterval(async () => {
        try {
            console.log('Scheduler running...');
            const now = new Date();

            // Find checks that are due:
            // lastRunAt is null OR (now - lastRunAt) > frequency (in seconds)
            // SQL: last_run_at IS NULL OR last_run_at <= now - frequency * interval '1 second'

            // Since extensive SQL interval arithmetic can be tricky with different adapters, 
            // we'll fetch potentially due checks or process in standard SQL if possible.
            // Simplified approach: Fetch all checks (scaling issue later? yes, but Phase 2 MVP)
            // Better: use raw sql filter for dates.

            // Postgres specific interval syntax
            const dueChecks = await db.select().from(checks)
                .where(
                    or(
                        isNull(checks.lastRunAt),
                        sql`${checks.lastRunAt} <= ${now}::timestamp - (${checks.frequency}::text || ' seconds')::interval`
                    )
                );

            console.log(`Found ${dueChecks.length} checks due for execution`);

            for (const check of dueChecks) {
                // Add to queue
                await checkQueue.add('run-check', {
                    checkId: check.id,
                    componentId: check.componentId,
                    type: check.type,
                    config: check.config,
                });

                // Update lastRunAt immediately to prevent double scheduling if next tick happens fast
                await db.update(checks)
                    .set({ lastRunAt: new Date() })
                    .where(eq(checks.id, check.id));

                console.log(`Scheduled check ${check.id}`);
            }

        } catch (error) {
            console.error('Scheduler error:', error);
        }
    }, 10000); // 10 seconds
};
