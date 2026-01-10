import { db, organisations, projects, components, incidents } from '@repo/database';
import { desc, count, isNull, eq } from 'drizzle-orm';
import DashboardClient from './components/DashboardClient';

export const dynamic = 'force-dynamic';

async function getOrganisations() {
  try {
    const rows = await db.select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      status: organisations.status,
      isPublic: organisations.isPublic,
      createdAt: organisations.createdAt,
      projectCount: count(projects.id),
    })
      .from(organisations)
      .leftJoin(projects, eq(organisations.id, projects.organisationId))
      .groupBy(organisations.id)
      .orderBy(desc(organisations.createdAt));

    return rows;
  } catch (e) {
    console.error("DB Error (Docker might be down):", e);
    return [];
  }
}

export default async function Page() {
  const orgs = await getOrganisations();

  // Fetch stats
  const [componentsCount] = await db.select({ value: count() }).from(components);
  const [incidentsCount] = await db.select({ value: count() }).from(incidents).where(isNull(incidents.resolvedAt));

  const stats = {
    services: componentsCount?.value || 0,
    incidents: incidentsCount?.value || 0,
    systemStatus: ((incidentsCount?.value || 0) > 0 ? 'outage' : 'operational') as 'operational' | 'degraded' | 'outage',
  };

  return <DashboardClient organisations={orgs} stats={stats} />;
}
