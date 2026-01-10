import 'dotenv/config';
import { db, checks, components, checkResults, count, sql, desc } from '@repo/database';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import path from 'path';

const checkQueueName = 'check-queue';

async function main() {
    console.log('\n🚀 --- OpsGlass Worker Health Check ---');

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // 1. Check DB Connection and Counts
    try {
        console.log('\n📊 1. Database Status');
        const [componentsCount] = await db.select({ value: count() }).from(components);
        const [checksCount] = await db.select({ value: count() }).from(checks);
        const [resultsCount] = await db.select({ value: count() }).from(checkResults);

        console.log(`   ✅ Components: ${componentsCount?.value}`);
        console.log(`   ✅ Total Checks: ${checksCount?.value}`);
        console.log(`   ✅ Total Results: ${resultsCount?.value}`);

        if (Number(checksCount?.value) === 0) {
            console.warn('   ⚠️ WARNING: No checks found in database.');
        } else {
            // Show recent activity
            console.log('\n🕒 Recent Check Activity (last 5):');
            const recentResults = await db.query.checkResults.findMany({
                limit: 5,
                orderBy: [desc(checkResults.timestamp)],
                with: {
                    check: {
                        with: {
                            component: true
                        }
                    }
                }
            });

            if (recentResults.length === 0) {
                console.log('   (No results yet)');
            } else {
                recentResults.forEach(r => {
                    const statusIcon = r.status === 'operational' ? '✅' : '❌';
                    const compName = (r.check as any)?.component?.name || 'Unknown';
                    console.log(`   ${statusIcon} [${r.timestamp?.toLocaleTimeString()}] ${compName} (${r.latency}ms): ${r.message || 'No message'}`);
                });
            }
        }

    } catch (e) {
        console.error('   ❌ ERROR: Database connection failed:', e);
    }

    // 2. Check Redis and BullMQ
    try {
        console.log('\n🔋 2. Queue & Redis Status');
        const redis = new Redis(redisUrl);
        await redis.ping();
        console.log(`   ✅ Redis connected (${redisUrl})`);

        const queue = new Queue(checkQueueName, { connection: redis as any });
        const workers = await queue.getWorkers();
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

        console.log(`   ✅ Active Workers: ${workers.length}`);
        if (workers.length === 0) {
            console.warn('   ⚠️ WARNING: No active workers listening to the queue!');
        }

        console.log(`   📦 Job Counts:`);
        console.log(`      Waiting:   ${counts.waiting}`);
        console.log(`      Active:    ${counts.active}`);
        console.log(`      Completed: ${counts.completed}`);
        console.log(`      Failed:    ${counts.failed}`);
        console.log(`      Delayed:   ${counts.delayed}`);

        await queue.close();
        redis.disconnect();
    } catch (e) {
        console.error('   ❌ ERROR: Redis or Queue check failed:', e);
    }

    // 3. Check Scheduler Logic Dry Run
    try {
        console.log('\n📅 3. Scheduler Prognosis');
        const now = new Date();
        const dueChecks = await db.select().from(checks)
            .where(
                sql`last_run_at IS NULL OR last_run_at <= ${now}::timestamp - (frequency || ' seconds')::interval`
            );

        console.log(`   ✅ Due Checks: ${dueChecks.length}`);
        if (dueChecks.length > 0) {
            console.log(`   Next check id: ${dueChecks[0]?.id}`);
        }

    } catch (e) {
        console.error('   ❌ ERROR: Scheduler query failed:', e);
    }

    console.log('\n--- Health Check Complete ---\n');
    process.exit(0);
}

main();
