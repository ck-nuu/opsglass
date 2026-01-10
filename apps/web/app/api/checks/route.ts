import { db, checks, components } from '@repo/database';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const componentId = searchParams.get('componentId');

        if (componentId) {
            const result = await db.select().from(checks)
                .where(eq(checks.componentId, componentId))
                .orderBy(desc(checks.createdAt));
            return NextResponse.json(result);
        }

        const result = await db.select().from(checks)
            .orderBy(desc(checks.createdAt));
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { componentId, type, config, frequency } = body;

        if (!componentId || !type || !config) {
            return NextResponse.json(
                { error: 'componentId, type, and config are required' },
                { status: 400 }
            );
        }

        // Verify component exists
        const [component] = await db.select().from(components)
            .where(eq(components.id, componentId));

        if (!component) {
            return NextResponse.json(
                { error: 'Component not found' },
                { status: 404 }
            );
        }

        const [check] = await db.insert(checks).values({
            componentId,
            type,
            config,
            frequency: frequency || 60,
        }).returning();

        return NextResponse.json(check, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
