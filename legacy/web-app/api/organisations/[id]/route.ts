import { db, organisations, eq } from '@repo/database';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { isPublic } = body;

        const [org] = await db.update(organisations)
            .set({ isPublic })
            .where(eq(organisations.id, id))
            .returning();

        return NextResponse.json(org);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
