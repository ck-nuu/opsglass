import { db, organisations, projects } from '@repo/database';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, ChevronRight, Activity, Server, FolderOpen } from 'lucide-react';
import OrganisationClient from './OrganisationClient';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ slug: string }>;
}

async function getOrganisation(slug: string) {
    const [org] = await db.select().from(organisations)
        .where(eq(organisations.slug, slug));
    return org;
}

async function getProjects(organisationId: string) {
    return await db.select().from(projects)
        .where(eq(projects.organisationId, organisationId))
        .orderBy(desc(projects.createdAt));
}

export default async function OrganisationPage({ params }: PageProps) {
    const { slug } = await params;
    const org = await getOrganisation(slug);

    if (!org) {
        notFound();
    }

    const orgProjects = await getProjects(org.id);

    return <OrganisationClient organisation={org} projects={orgProjects} />;
}
