import { db, organisations, projects, incidents, components } from '@repo/database';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import StatusPageClient from './StatusPageClient';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ slug: string }>;
}

async function getOrganisation(slug: string) {
    const [org] = await db.select().from(organisations)
        .where(
            and(
                eq(organisations.slug, slug),
                eq(organisations.isPublic, true)
            )
        );
    return org;
}

async function getProjects(organisationId: string) {
    return await db.select().from(projects)
        .where(
            and(
                eq(projects.organisationId, organisationId),
                eq(projects.isPublic, true)
            )
        )
        .orderBy(desc(projects.createdAt));
}

async function getActiveIncidents(organisationId: string) {
    // Get incidents for projects in this org
    // We join projects to filter by organisationId
    const orgIncidents = await db.select({
        id: incidents.id,
        title: incidents.title,
        description: incidents.description,
        status: incidents.status,
        createdAt: incidents.createdAt,
        componentName: components.name
    })
        .from(incidents)
        .innerJoin(projects, eq(incidents.projectId, projects.id))
        .leftJoin(components, eq(incidents.componentId, components.id))
        .where(
            and(
                eq(projects.organisationId, organisationId),
                isNull(incidents.resolvedAt)
            )
        )
        .orderBy(desc(incidents.createdAt));

    return orgIncidents;
}

export default async function StatusPage({ params }: PageProps) {
    const { slug } = await params;
    const org = await getOrganisation(slug);

    if (!org) {
        notFound();
    }

    const orgProjects = await getProjects(org.id);
    const activeIncidents = await getActiveIncidents(org.id);

    // Transform null to undefined for componentName to match component props
    const formattedIncidents = activeIncidents.map(incident => ({
        ...incident,
        componentName: incident.componentName || undefined
    }));

    return <StatusPageClient organisation={org} projects={orgProjects} incidents={formattedIncidents} />;
}
