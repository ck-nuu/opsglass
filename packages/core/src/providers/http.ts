import { MonitoringProvider, CheckResult } from '../types';

export class HttpProvider implements MonitoringProvider {
    type = 'http';

    async runCheck(config: { url: string; method?: string }): Promise<CheckResult> {
        const start = Date.now();
        try {
            // Ensure URL has protocol
            let url = config.url;
            if (!url.startsWith('http')) {
                url = `https://${url}`;
            }

            const res = await fetch(url, {
                method: config.method || 'GET',
                signal: AbortSignal.timeout(10000) // 10s timeout
            });

            const latency = Date.now() - start;

            if (res.ok) {
                return { status: 'operational', latency, message: `Status: ${res.status}` };
            } else {
                return { status: 'major_outage', latency, message: `Status: ${res.status}` };
            }
        } catch (err: any) {
            return { status: 'major_outage', latency: Date.now() - start, message: err.message };
        }
    }

    validateConfig(config: any): boolean {
        return typeof config.url === 'string';
    }
}
