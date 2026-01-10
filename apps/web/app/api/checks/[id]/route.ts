import { db, checks, checkResults } from '@repo/database';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        const [check] = await db.select().from(checks)
            .where(eq(checks.id, id));

        if (!check) {
            return NextResponse.json({ error: 'Check not found' }, { status: 404 });
        }

        // Get recent results
        const results = await db.select().from(checkResults)
            .where(eq(checkResults.checkId, id))
            .orderBy(desc(checkResults.timestamp))
            .limit(10);

        return NextResponse.json({
            ...check,
            results,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { type, config, frequency } = body;

        const updateData: Record<string, any> = {};
        if (type) updateData.type = type;
        if (config) updateData.config = config;
        if (frequency) updateData.frequency = frequency;

        const [updated] = await db.update(checks)
            .set(updateData)
            .where(eq(checks.id, id))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: 'Check not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        // Delete results first
        await db.delete(checkResults).where(eq(checkResults.checkId, id));

        const [deleted] = await db.delete(checks)
            .where(eq(checks.id, id))
            .returning();

        if (!deleted) {
            return NextResponse.json({ error: 'Check not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Check deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
