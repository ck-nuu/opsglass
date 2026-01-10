import { MonitoringProvider, CheckResult } from '../types';
import ping from 'ping';

export class PingProvider implements MonitoringProvider {
    type = 'ping';

    async runCheck(config: { host: string }): Promise<CheckResult> {
        const start = Date.now();
        // Handle cases where user might put http://
        const host = config.host.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] || config.host;

        try {
            const res = await ping.promise.probe(host, {
                timeout: 10,
                extra: ['-c', '3'], // send 3 packets
            });

            const latency = typeof res.time === 'number' ? res.time : (Date.now() - start);

            if (res.alive) {
                return { status: 'operational', latency, message: `Ping successful` };
            } else {
                return { status: 'major_outage', latency, message: 'Host unreachable' };
            }

        } catch (err: any) {
            return { status: 'major_outage', latency: Date.now() - start, message: err.message };
        }
    }

    validateConfig(config: any): boolean {
        return typeof config.host === 'string';
    }
}
