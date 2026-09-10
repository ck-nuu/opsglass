import { db, checks, components } from '@repo/database';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/checks/[id]/trigger - Manually trigger a check
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        // Get check details
        const [check] = await db.select().from(checks)
            .where(eq(checks.id, id));

        if (!check) {
            return NextResponse.json({ error: 'Check not found' }, { status: 404 });
        }

        // Get component for this check
        const [component] = await db.select().from(components)
            .where(eq(components.id, check.componentId));

        if (!component) {
            return NextResponse.json({ error: 'Component not found' }, { status: 404 });
        }

        // In a real implementation, this would add to the BullMQ queue
        // For now, we'll return success indicating the check would be queued
        return NextResponse.json({
            message: 'Check queued for execution',
            check: {
                id: check.id,
                type: check.type,
                componentId: check.componentId,
                componentName: component.name,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
