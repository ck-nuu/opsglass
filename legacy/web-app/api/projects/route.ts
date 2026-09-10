import { db, projects, organisations } from '@repo/database';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const organisationId = searchParams.get('organisationId');

        let query = db.select().from(projects).orderBy(desc(projects.createdAt));

        if (organisationId) {
            const result = await db.select().from(projects)
                .where(eq(projects.organisationId, organisationId))
                .orderBy(desc(projects.createdAt));
            return NextResponse.json(result);
        }

        const result = await query;
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, slug, organisationId } = body;

        if (!name || !slug || !organisationId) {
            return NextResponse.json(
                { error: 'name, slug, and organisationId are required' },
                { status: 400 }
            );
        }

        // Verify organisation exists
        const [org] = await db.select().from(organisations)
            .where(eq(organisations.id, organisationId));

        if (!org) {
            return NextResponse.json(
                { error: 'Organisation not found' },
                { status: 404 }
            );
        }

        const [project] = await db.insert(projects).values({
            name,
            slug,
            organisationId,
            status: 'unknown',
        }).returning();

        return NextResponse.json(project, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
