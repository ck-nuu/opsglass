import { db, organisations, projects, components } from '@repo/database';
import { eq, desc, inArray } from 'drizzle-orm';
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

async function getComponents(projectIds: string[]) {
    if (projectIds.length === 0) return [];
    return await db.select().from(components)
        .where(inArray(components.projectId, projectIds));
}

export default async function OrganisationPage({ params }: PageProps) {
    const { slug } = await params;
    const org = await getOrganisation(slug);

    if (!org) {
        notFound();
    }

    const orgProjects = await getProjects(org.id);
    const orgComponents = await getComponents(orgProjects.map(p => p.id));

    return <OrganisationClient organisation={org} projects={orgProjects} components={orgComponents} />;
}
