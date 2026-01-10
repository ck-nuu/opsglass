import { db, components, projects, checks } from '@repo/database';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (projectId) {
            const result = await db.select().from(components)
                .where(eq(components.projectId, projectId))
                .orderBy(desc(components.createdAt));
            return NextResponse.json(result);
        }

        const result = await db.select().from(components)
            .orderBy(desc(components.createdAt));
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, type, provider, projectId, url } = body;

        if (!name || !type || !projectId) {
            return NextResponse.json(
                { error: 'name, type, and projectId are required' },
                { status: 400 }
            );
        }

        // Verify project exists
        const [project] = await db.select().from(projects)
            .where(eq(projects.id, projectId));

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        const [component] = await db.insert(components).values({
            name,
            type,
            provider: provider || null,
            projectId,
            status: 'unknown',
        }).returning();

        // If URL provided, create default HTTP check
        if (url && component) {
            await db.insert(checks).values({
                componentId: component.id,
                type: 'http',
                config: { url, method: 'GET' },
                frequency: 60,
            });
        }

        return NextResponse.json(component, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
