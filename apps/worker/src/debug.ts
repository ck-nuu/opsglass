
import { db, checks, components, count, isNull, sql } from '@repo/database';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load env from worker root
dotenv.config({ path: path.join(__dirname, '../.env') });

const checkQueueName = 'check-queue';

async function main() {
    console.log('--- Debugging OpsGlass Checks ---');

    // 1. Check DB Connection and Counts
    try {
        console.log('1. Checking Database...');
        const [componentsCount] = await db.select({ value: count() }).from(components);
        const [checksCount] = await db.select({ value: count() }).from(checks);

        console.log(`   Components: ${componentsCount?.value}`);
        console.log(`   Checks: ${checksCount?.value}`);

        if (Number(checksCount?.value) === 0) {
            console.warn('   WARNING: No checks found in database. This is likely the issue.');
        } else {
            // Show a sample check
            const sampleCheck = await db.query.checks.findFirst();
            console.log('   Sample Check:', sampleCheck);
        }

    } catch (e) {
        console.error('   ERROR: Database connection failed:', e);
    }

    // 2. Check Redis Connection
    try {
        console.log('\n2. Checking Redis...');
        const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        await redis.ping();
        console.log('   Redis connection successful');

        const queueKey = `bull:${checkQueueName}:id`;
        // BullMQ uses different keys, let's just list keys
        const keys = await redis.keys('*');
        console.log(`   Total Redis Keys: ${keys.length}`);

        redis.disconnect();
    } catch (e) {
        console.error('   ERROR: Redis connection failed:', e);
    }

    // 3. Check Scheduler Logic Dry Run
    try {
        console.log('\n3. Checking Scheduler Logic...');
        const now = new Date();
        // Same logic as scheduler.ts
        const dueChecks = await db.select().from(checks)
            .where(
                sql`last_run_at IS NULL OR last_run_at <= ${now}::timestamp - (frequency || ' seconds')::interval`
            );
        console.log(`   Due Checks Count: ${dueChecks.length}`);
        if (dueChecks.length > 0) {
            console.log('   Next due check:', dueChecks[0]?.id);
        }

    } catch (e) {
        console.error('   ERROR: Scheduler query failed:', e);
    }

    console.log('\n--- Debug Complete ---');
    process.exit(0);
}

main();
