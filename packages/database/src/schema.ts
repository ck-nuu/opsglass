import { pgTable, text, timestamp, uuid, jsonb, integer, boolean, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';

// Enums
export const componentTypeEnum = pgEnum('component_type', ['application', 'database', 'service', 'dependency']);
export const statusEnum = pgEnum('status', ['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance', 'unknown']);
export const checkTypeEnum = pgEnum('check_type', ['http', 'dns', 'ssl', 'ping', 'custom']);

// Tables

export const organisations = pgTable('organisations', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    status: statusEnum('status').default('unknown'),
    isPublic: boolean('is_public').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id').references(() => organisations.id).notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: statusEnum('status').default('unknown'),
    isPublic: boolean('is_public').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});

export const components = pgTable('components', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id).notNull(),
    name: text('name').notNull(),
    type: componentTypeEnum('type').notNull(),
    provider: text('provider'), // e.g. "aws", "vercel", "stripe"
    status: statusEnum('status').default('unknown'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const checks = pgTable('checks', {
    id: uuid('id').defaultRandom().primaryKey(),
    componentId: uuid('component_id').references(() => components.id).notNull(),
    type: checkTypeEnum('type').notNull(),
    config: jsonb('config').notNull(), // { url: "...", method: "GET" }
    frequency: integer('frequency').default(60), // seconds
    lastRunAt: timestamp('last_run_at'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const checkResults = pgTable('check_results', {
    id: uuid('id').defaultRandom().primaryKey(),
    checkId: uuid('check_id').references(() => checks.id).notNull(),
    status: statusEnum('status').notNull(),
    latency: integer('latency'), // ms
    message: text('message'),
    timestamp: timestamp('timestamp').defaultNow(),
});

export const incidents = pgTable('incidents', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id).notNull(),
    componentId: uuid('component_id').references(() => components.id),
    title: text('title').notNull(),
    description: text('description'),
    status: statusEnum('status').notNull(), // The status this incident represents (e.g. major_outage)
    createdAt: timestamp('created_at').defaultNow(),
    resolvedAt: timestamp('resolved_at'),
});

export const incidentUpdates = pgTable('incident_updates', {
    id: uuid('id').defaultRandom().primaryKey(),
    incidentId: uuid('incident_id').references(() => incidents.id).notNull(),
    message: text('message').notNull(),
    status: statusEnum('status').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const dailyStats = pgTable('daily_stats', {
    id: uuid('id').defaultRandom().primaryKey(),
    componentId: uuid('component_id').references(() => components.id).notNull(),
    date: text('date').notNull(), // text is safer for 'YYYY-MM-DD'
    totalChecks: integer('total_checks').default(0).notNull(),
    passedChecks: integer('passed_checks').default(0).notNull(),
    failedChecks: integer('failed_checks').default(0).notNull(),
}, (t) => [
    uniqueIndex('component_date_idx').on(t.componentId, t.date)
]);

// Relations
import { relations } from 'drizzle-orm';

export const organisationsRelations = relations(organisations, ({ many }) => ({
    projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
    organisation: one(organisations, {
        fields: [projects.organisationId],
        references: [organisations.id],
    }),
    components: many(components),
    incidents: many(incidents),
}));

export const componentsRelations = relations(components, ({ one, many }) => ({
    project: one(projects, {
        fields: [components.projectId],
        references: [projects.id],
    }),
    checks: many(checks),
    incidents: many(incidents),
    dailyStats: many(dailyStats),
}));

export const checksRelations = relations(checks, ({ one, many }) => ({
    component: one(components, {
        fields: [checks.componentId],
        references: [components.id],
    }),
    results: many(checkResults),
}));

export const checkResultsRelations = relations(checkResults, ({ one }) => ({
    check: one(checks, {
        fields: [checkResults.checkId],
        references: [checks.id],
    }),
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
    project: one(projects, {
        fields: [incidents.projectId],
        references: [projects.id],
    }),
    component: one(components, {
        fields: [incidents.componentId],
        references: [components.id],
    }),
    updates: many(incidentUpdates),
}));

export const incidentUpdatesRelations = relations(incidentUpdates, ({ one }) => ({
    incident: one(incidents, {
        fields: [incidentUpdates.incidentId],
        references: [incidents.id],
    }),
}));

export const dailyStatsRelations = relations(dailyStats, ({ one }) => ({
    component: one(components, {
        fields: [dailyStats.componentId],
        references: [components.id],
    }),
}));
