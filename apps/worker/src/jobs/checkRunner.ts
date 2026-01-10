import { Job } from 'bullmq';
import { providers, calculateProjectStatus, Status } from '@repo/core';
import { db, checkResults, components, projects, organisations, incidents, incidentUpdates, dailyStats, eq, and, isNull } from '@repo/database';
import { sql } from 'drizzle-orm';

export const checkRunner = async (job: Job) => {
    const { checkId, componentId, type, config } = job.data;
    console.log(`Running check ${checkId} for ${type}`);

    const provider = providers[type];
    if (!provider) {
        throw new Error(`Unknown provider type: ${type}`);
    }

    // Fetch component first to get project ID and name
    const [component] = await db.select().from(components)
        .where(eq(components.id, componentId));

    if (!component) {
        throw new Error(`Component ${componentId} not found`);
    }

    const result = await provider.runCheck(config);

    // Save result
    await db.insert(checkResults).values({
        checkId,
        status: result.status,
        latency: result.latency || 0,
        message: result.message,
    });

    // Update Daily Stats
    const today = new Date().toISOString().split('T')[0];
    const isOperational = result.status === 'operational';

    await db.insert(dailyStats).values({
        componentId: component!.id,
        date: today,
        totalChecks: 1,
        passedChecks: isOperational ? 1 : 0,
        failedChecks: isOperational ? 0 : 1,
    } as any).onConflictDoUpdate({
        target: [dailyStats.componentId, dailyStats.date],
        set: {
            totalChecks: sql`${dailyStats.totalChecks} + 1`,
            passedChecks: sql`${dailyStats.passedChecks} + ${isOperational ? 1 : 0}`,
            failedChecks: sql`${dailyStats.failedChecks} + ${isOperational ? 0 : 1}`,
        }
    });

    // Update component status
    await db.update(components)
        .set({ status: result.status })
        .where(eq(components.id, componentId));

    // Auto-Incident Management
    /*
     * If status is major_outage -> create incident if not exists
     * If status is operational -> resolve incident if exists
     */
    if (result.status === 'major_outage') {
        const existingIncidents = await db.select().from(incidents)
            .where(and(
                eq(incidents.componentId, componentId),
                isNull(incidents.resolvedAt)
            ));

        if (existingIncidents.length === 0) {
            console.log(`Creating incident for component ${componentId}`);
            const [newIncident] = await db.insert(incidents).values({
                projectId: component?.projectId, // We need component object here, but it's fetched later in original code. Moving fetch up.
                componentId: componentId,
                title: `Service Outage: ${component?.name || 'Unknown Component'}`,
                description: result.message || 'Automatic incident created by health check failure',
                status: 'major_outage',
            }).returning();

            if (newIncident) {
                await db.insert(incidentUpdates).values({
                    incidentId: newIncident.id,
                    message: 'Incident started detected by health check',
                    status: 'major_outage',
                });
            }
        }
    } else if (result.status === 'operational') {
        const existingIncidents = await db.select().from(incidents)
            .where(and(
                eq(incidents.componentId, componentId),
                isNull(incidents.resolvedAt)
            ));

        if (existingIncidents.length > 0) {
            const incident = existingIncidents[0];
            if (incident) {
                console.log(`Resolving incident ${incident.id}`);

                await db.update(incidents)
                    .set({ resolvedAt: new Date() }) // Keep original status as record of what happened? Or set to operational? resolving usually means it's over.
                    .where(eq(incidents.id, incident.id));

                await db.insert(incidentUpdates).values({
                    incidentId: incident.id,
                    message: 'Service recovered - check passing',
                    status: 'operational',
                });
            }
        }
    }

    // Rollup to project level
    // Component already fetched above
    if (component) {
        // Get all components for this project
        const projectComponents = await db.select().from(components)
            .where(eq(components.projectId, component.projectId));

        const componentStatuses = projectComponents.map(c => c.status as Status || 'unknown');
        const projectStatus = calculateProjectStatus(componentStatuses);

        // Update project status
        await db.update(projects)
            .set({ status: projectStatus })
            .where(eq(projects.id, component.projectId));

        // Get project to find organisation
        const [project] = await db.select().from(projects)
            .where(eq(projects.id, component.projectId));

        if (project) {
            // Get all projects for this organisation
            const orgProjects = await db.select().from(projects)
                .where(eq(projects.organisationId, project.organisationId));

            const projectStatuses = orgProjects.map(p => p.status as Status || 'unknown');
            const orgStatus = calculateProjectStatus(projectStatuses);

            // Update organisation status
            await db.update(organisations)
                .set({ status: orgStatus } as any) // Cast to any if status field is missing in type definition, or ensure it exists
                .where(eq(organisations.id, project.organisationId));

            console.log(`Status rollup: Component ${result.status} -> Project ${projectStatus} -> Org ${orgStatus}`);
        }
    }

    console.log(`Check ${checkId} finished: ${result.status}`);
};

