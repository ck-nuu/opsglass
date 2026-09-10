import { db, components, checks } from '@repo/database';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        const [component] = await db.select().from(components)
            .where(eq(components.id, id));

        if (!component) {
            return NextResponse.json({ error: 'Component not found' }, { status: 404 });
        }

        // Get checks for this component
        const componentChecks = await db.select().from(checks)
            .where(eq(checks.componentId, id));

        return NextResponse.json({
            ...component,
            checks: componentChecks,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, type, provider, status } = body;

        const updateData: Record<string, any> = {};
        if (name) updateData.name = name;
        if (type) updateData.type = type;
        if (provider !== undefined) updateData.provider = provider;
        if (status) updateData.status = status;

        const [updated] = await db.update(components)
            .set(updateData)
            .where(eq(components.id, id))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: 'Component not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        // Delete associated checks first
        await db.delete(checks).where(eq(checks.componentId, id));

        const [deleted] = await db.delete(components)
            .where(eq(components.id, id))
            .returning();

        if (!deleted) {
            return NextResponse.json({ error: 'Component not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Component deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
