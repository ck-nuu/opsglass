import { db, checks, components } from '@repo/database';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// We need to connect to the same Redis queue
// Note: In a real app, maybe share this connection logic code
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

const checkQueue = new Queue('check-queue', { connection: connection as any });

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { checkId } = body;

        if (!checkId) {
            return NextResponse.json(
                { error: 'checkId is required' },
                { status: 400 }
            );
        }

        // Verify check exists
        const [check] = await db.select().from(checks)
            .where(eq(checks.id, checkId));

        if (!check) {
            return NextResponse.json(
                { error: 'Check not found' },
                { status: 404 }
            );
        }

        console.log(`Manually triggering check ${checkId}`);

        // Add to queue
        await checkQueue.add('run-check', {
            checkId: check.id,
            componentId: check.componentId,
            type: check.type,
            config: check.config,
        });

        // Update lastRunAt to avoid immediate re-run by scheduler
        await db.update(checks)
            .set({ lastRunAt: new Date() })
            .where(eq(checks.id, check.id));

        return NextResponse.json({ message: 'Check triggered successfully' }, { status: 200 });
    } catch (error: any) {
        console.error('Trigger error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
