import { db, organisations, projects, components, checks } from '@repo/database';
import { eq, and, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ProjectClient from './ProjectClient';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ slug: string; projectSlug: string }>;
}

async function getOrganisation(slug: string) {
    const [org] = await db.select().from(organisations)
        .where(eq(organisations.slug, slug));
    return org;
}

async function getProject(organisationId: string, projectSlug: string) {
    const [project] = await db.select().from(projects)
        .where(and(
            eq(projects.organisationId, organisationId),
            eq(projects.slug, projectSlug)
        ));
    return project;
}

async function getComponents(projectId: string) {
    return await db.select().from(components)
        .where(eq(components.projectId, projectId));
}

async function getChecks(componentIds: string[]) {
    if (componentIds.length === 0) return [];
    return await db.select().from(checks)
        .where(inArray(checks.componentId, componentIds));
}

export default async function ProjectPage({ params }: PageProps) {
    const { slug, projectSlug } = await params;

    const org = await getOrganisation(slug);
    if (!org) {
        notFound();
    }

    const project = await getProject(org.id, projectSlug);
    if (!project) {
        notFound();
    }

    const projectComponents = await getComponents(project.id);
    const checksList = await getChecks(projectComponents.map(c => c.id));

    return (
        <ProjectClient
            organisation={org}
            project={project}
            components={projectComponents}
            checks={checksList}
        />
    );
}
