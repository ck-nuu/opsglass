import { db, projects, components } from '@repo/database';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        const [project] = await db.select().from(projects)
            .where(eq(projects.id, id));

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get components for this project
        const projectComponents = await db.select().from(components)
            .where(eq(components.projectId, id));

        return NextResponse.json({
            ...project,
            components: projectComponents,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, slug, status, isPublic } = body;

        const updateData: Record<string, any> = {};
        if (name) updateData.name = name;
        if (slug) updateData.slug = slug;
        if (status) updateData.status = status;
        if (typeof isPublic === 'boolean') updateData.isPublic = isPublic;

        const [updated] = await db.update(projects)
            .set(updateData)
            .where(eq(projects.id, id))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        // Delete associated components first
        await db.delete(components).where(eq(components.projectId, id));

        const [deleted] = await db.delete(projects)
            .where(eq(projects.id, id))
            .returning();

        if (!deleted) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Project deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
