import { db, organisations, projects, components, incidents } from '@repo/database';
import { desc, count, isNull, eq } from 'drizzle-orm';
import { STATUS_PRIORITY, type Status } from '@repo/core';
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
  const componentsResult = await db.select({ value: count() }).from(components);
  const incidentsResult = await db.select({ value: count() }).from(incidents).where(isNull(incidents.resolvedAt));

  const activeIncidents = Number(incidentsResult[0]?.value || 0);
  const worstOrgStatus = orgs.reduce((worst, org) => {
    const currentStatus = (org.status || 'unknown') as Status;
    return (STATUS_PRIORITY[currentStatus] > STATUS_PRIORITY[worst]) ? currentStatus : worst;
  }, 'operational' as Status);

  const systemStatus: 'operational' | 'degraded' | 'outage' =
    (activeIncidents > 0 || worstOrgStatus === 'major_outage' || worstOrgStatus === 'partial_outage') ? 'outage' :
      (worstOrgStatus === 'degraded' ? 'degraded' : 'operational');

  const stats = {
    services: Number(componentsResult[0]?.value || 0),
    incidents: activeIncidents,
    systemStatus,
  };

  return <DashboardClient organisations={orgs} stats={stats} />;
}
