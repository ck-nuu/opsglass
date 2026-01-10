import { MonitoringProvider, CheckResult } from '../types';
import tls from 'tls';

export class SslProvider implements MonitoringProvider {
    type = 'ssl';

    async runCheck(config: { hostname: string; port?: number; warningThresholdDays?: number }): Promise<CheckResult> {
        const start = Date.now();
        const hostname = config.hostname.replace(/^https?:\/\//, '').split('/')[0]; // simple cleanup
        const port = config.port || 443;
        const warningDays = config.warningThresholdDays || 14;

        return new Promise<CheckResult>((resolve) => {
            const socket = tls.connect(port, hostname, { servername: hostname, rejectUnauthorized: false }, () => {
                const latency = Date.now() - start;
                const cert = socket.getPeerCertificate();
                socket.end();

                if (!cert || Object.keys(cert).length === 0) {
                    resolve({ status: 'major_outage', latency, message: 'No certificate found' });
                    return;
                }

                const validTo = new Date(cert.valid_to);
                const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                if (daysRemaining < 0) {
                    resolve({ status: 'major_outage', latency, message: `Certificate expired on ${validTo.toISOString()}` });
                } else if (daysRemaining < warningDays) {
                    resolve({ status: 'degraded', latency, message: `Certificate expires in ${daysRemaining} days` });
                } else {
                    resolve({ status: 'operational', latency, message: `Valid for ${daysRemaining} days` });
                }
            });

            socket.on('error', (err) => {
                resolve({ status: 'major_outage', latency: Date.now() - start, message: err.message });
            });

            socket.setTimeout(10000, () => {
                socket.destroy();
                resolve({ status: 'major_outage', latency: Date.now() - start, message: 'Connection timed out' });
            });
        });
    }

    validateConfig(config: any): boolean {
        return typeof config.hostname === 'string';
    }
}
