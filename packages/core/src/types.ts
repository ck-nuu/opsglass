export interface CheckResult {
    status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance' | 'unknown';
    latency?: number;
    message?: string;
    metadata?: Record<string, any>;
}

export interface ProviderConfig {
    type: string;
    config: Record<string, any>; // e.g. { url: "https://..." }
}

export interface MonitoringProvider {
    type: string;
    runCheck(config: Record<string, any>): Promise<CheckResult>;
    validateConfig(config: Record<string, any>): boolean;
}
