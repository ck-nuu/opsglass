import { db, organisations } from '@repo/database';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const orgs = await db.select().from(organisations);
        return NextResponse.json(orgs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, slug } = body;
        const [org] = await db.insert(organisations).values({ name, slug }).returning();
        return NextResponse.json(org);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
