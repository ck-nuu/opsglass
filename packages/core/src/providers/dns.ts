import { MonitoringProvider, CheckResult } from '../types';
import dns from 'dns/promises';

export class DnsProvider implements MonitoringProvider {
    type = 'dns';

    async runCheck(config: { hostname: string; recordType?: string; expectedValue?: string }): Promise<CheckResult> {
        const start = Date.now();
        try {
            const hostname = config.hostname.replace(/^https?:\/\//, '').split('/')[0] || config.hostname;
            const recordType = (config.recordType || 'A') as string;

            // Basic resolution check
            // Note: node:dns resolve method selection based on type is a bit manual if we want full type safety
            // For now, we'll generic resolve or specific ones. 
            // dns.resolve(hostname, rrtype)

            // dns.resolve returns Promise<string[] | RecordWithTtl[] | ...>
            // We cast strictly for now or use specific resolves if needed.
            const addresses = await dns.resolve(hostname, recordType);

            const latency = Date.now() - start;

            if (!addresses || (Array.isArray(addresses) && addresses.length === 0)) {
                return { status: 'major_outage', latency, message: `DNS resolution failed for ${hostname} (${recordType})` };
            }

            if (config.expectedValue) {
                // addresses can be string[] or object[]
                const found = (addresses as any[]).some((addr: any) =>
                    typeof addr === 'string' ? addr.includes(config.expectedValue!) : JSON.stringify(addr).includes(config.expectedValue!)
                );

                if (!found) {
                    return { status: 'major_outage', latency, message: `DNS records do not match expected value: ${config.expectedValue}` };
                }
            }

            return {
                status: 'operational',
                latency,
                message: `Resolved ${Array.isArray(addresses) ? addresses.length : 1} records`,
                metadata: { records: addresses }
            };

        } catch (err: any) {
            return { status: 'major_outage', latency: Date.now() - start, message: err.message };
        }
    }

    validateConfig(config: any): boolean {
        return typeof config.hostname === 'string';
    }
}
