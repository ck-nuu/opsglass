'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, CircleCheck, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import Link from 'next/link';


interface StatusPageClientProps {
    organisation: {
        name: string;
        slug: string;
    };
    projects: {
        id: string;
        name: string;
        status: string | null;
    }[];
    incidents: {
        id: string;
        title: string;
        description: string | null;
        status: string;
        createdAt: Date | null;
        componentName?: string;
    }[];
}

const getStatusColor = (status: string | null) => {
    switch (status) {
        case 'operational': return 'bg-emerald-500 text-emerald-500';
        case 'degraded': return 'bg-yellow-500 text-yellow-500';
        case 'partial_outage': return 'bg-orange-500 text-orange-500';
        case 'major_outage': return 'bg-red-500 text-red-500';
        case 'maintenance': return 'bg-blue-500 text-blue-500';
        default: return 'bg-gray-500 text-gray-500';
    }
};

const getStatusIcon = (status: string | null) => {
    switch (status) {
        case 'operational': return CircleCheck;
        case 'degraded': return AlertTriangle;
        case 'partial_outage': return AlertTriangle;
        case 'major_outage': return XCircle;
        case 'maintenance': return Info;
        default: return Info;
    }
};

const getStatusLabel = (status: string | null) => {
    switch (status) {
        case 'operational': return 'Operational';
        case 'degraded': return 'Degraded Performance';
        case 'partial_outage': return 'Partial Outage';
        case 'major_outage': return 'Major Outage';
        case 'maintenance': return 'Maintenance';
        default: return 'Unknown';
    }
}

export default function StatusPageClient({ organisation, projects, incidents }: StatusPageClientProps) {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 60000); // 60s polling
        return () => clearInterval(interval);
    }, [router]);

    const globalStatus = incidents.length > 0 && incidents[0] ? incidents[0].status : (projects.some(p => p.status !== 'operational') ? 'degraded' : 'operational');
    const GlobalIcon = getStatusIcon(globalStatus);
    const globalColor = getStatusColor(globalStatus).split(' ')[1]; // get text color class

    return (
        <main className="min-h-screen bg-black text-white selection:bg-white/20">
            {/* Header */}
            <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-xl font-bold">{organisation.name.charAt(0)}</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">{organisation.name}</h1>
                            <p className="text-sm text-muted-foreground">System Status</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <a href="https://opsglass.com" target="_blank" className="text-xs font-medium text-muted-foreground hover:text-white transition-colors">
                            Powered by OpsGlass
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">

                {/* Global Status Banner */}
                <div className={`p-8 rounded-3xl border border-white/10 flex items-center gap-6 ${globalStatus === 'operational' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${globalStatus === 'operational' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        <GlobalIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-1">{globalStatus === 'operational' ? 'All Systems Operational' : 'Active Incidents'}</h2>
                        <p className="text-muted-foreground">
                            {globalStatus === 'operational'
                                ? 'All services are running normally.'
                                : 'We are currently experiencing issues with some of our services.'}
                        </p>
                    </div>
                </div>

                {/* Active Incidents */}
                {incidents.length > 0 && (
                    <section className="space-y-6">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                            <Activity className="w-5 h-5 text-red-400" />
                            Active Incidents
                        </h3>
                        <div className="space-y-4">
                            {incidents.map(incident => (
                                <div key={incident.id} className="glass-card p-6 rounded-2xl border-l-4 border-l-red-500">
                                    <h4 className="text-lg font-bold mb-2">{incident.title}</h4>
                                    <p className="text-muted-foreground mb-4">{incident.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>Started {new Date(incident.createdAt!).toLocaleString()}</span>
                                        {incident.componentName && (
                                            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                                                Affected: {incident.componentName}
                                            </span>
                                        )}
                                        <span className="uppercase tracking-wider font-semibold text-red-400">{getStatusLabel(incident.status)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* System Metrics (Projects) */}
                <section className="space-y-6">
                    <h3 className="text-xl font-semibold">System Metrics</h3>
                    <div className="grid gap-3">
                        {projects.map(project => {
                            const StatusIcon = getStatusIcon(project.status);
                            const isOperational = project.status === 'operational';

                            return (
                                <div key={project.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors">
                                    <div className="font-medium">{project.name}</div>
                                    <div className={`flex items-center gap-2 text-sm ${isOperational ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                        <StatusIcon className="w-4 h-4" />
                                        <span>{getStatusLabel(project.status)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </main>
    );
}
