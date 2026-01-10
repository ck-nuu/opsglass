/**
 * Status Engine - Calculates rollup status for components, projects, and organisations
 */

export type Status = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance' | 'unknown';

// Status priority (higher = worse)
const STATUS_PRIORITY: Record<Status, number> = {
    operational: 0,
    maintenance: 1,
    degraded: 2,
    partial_outage: 3,
    major_outage: 4,
    unknown: 5,
};

/**
 * Calculate component status from check results
 * Uses the most recent check result as the source of truth
 */
export function calculateComponentStatus(
    checkStatuses: Status[]
): Status {
    if (checkStatuses.length === 0) {
        return 'unknown';
    }

    // Return the worst status among all checks
    return checkStatuses.reduce((worst, current) => {
        return STATUS_PRIORITY[current] > STATUS_PRIORITY[worst] ? current : worst;
    }, 'operational' as Status);
}

/**
 * Calculate project status from component statuses
 * Any degraded component degrades the project
 */
export function calculateProjectStatus(
    componentStatuses: Status[]
): Status {
    if (componentStatuses.length === 0) {
        return 'unknown';
    }

    const allOperational = componentStatuses.every(s => s === 'operational');
    const anyMajorOutage = componentStatuses.some(s => s === 'major_outage');
    const anyDegraded = componentStatuses.some(s => s === 'degraded' || s === 'partial_outage');
    const anyMaintenance = componentStatuses.some(s => s === 'maintenance');

    if (anyMajorOutage) {
        // Check if more than half are in outage
        const outageCount = componentStatuses.filter(s => s === 'major_outage').length;
        return outageCount > componentStatuses.length / 2 ? 'major_outage' : 'partial_outage';
    }

    if (anyDegraded) {
        return 'degraded';
    }

    if (anyMaintenance) {
        return 'maintenance';
    }

    if (allOperational) {
        return 'operational';
    }

    return 'unknown';
}

/**
 * Calculate organisation status from project statuses
 * Same logic as project rollup
 */
export function calculateOrgStatus(
    projectStatuses: Status[]
): Status {
    return calculateProjectStatus(projectStatuses);
}

/**
 * Calculate global status from organisation statuses
 */
export function calculateGlobalStatus(
    orgStatuses: Status[]
): Status {
    return calculateProjectStatus(orgStatuses);
}

/**
 * Get a human-readable label for a status
 */
export function getStatusLabel(status: Status): string {
    const labels: Record<Status, string> = {
        operational: 'All Operational',
        degraded: 'Degraded Performance',
        partial_outage: 'Partial Outage',
        major_outage: 'Major Outage',
        maintenance: 'Under Maintenance',
        unknown: 'Unknown',
    };
    return labels[status];
}

/**
 * Get CSS class suffix for status styling
 */
export function getStatusClass(status: Status): string {
    const classes: Record<Status, string> = {
        operational: 'operational',
        degraded: 'degraded',
        partial_outage: 'outage',
        major_outage: 'outage',
        maintenance: 'maintenance',
        unknown: 'unknown',
    };
    return classes[status];
}
