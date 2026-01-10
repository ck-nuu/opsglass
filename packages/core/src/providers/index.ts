import { MonitoringProvider, CheckResult } from '../types';
import { HttpProvider } from './http';
import { DnsProvider } from './dns';
import { SslProvider } from './ssl';
import { PingProvider } from './ping';

export * from './http';
export * from './dns';
export * from './ssl';
export * from './ping';

export const providers: Record<string, MonitoringProvider> = {
    http: new HttpProvider(),
    dns: new DnsProvider(),
    ssl: new SslProvider(),
    ping: new PingProvider(),
};
