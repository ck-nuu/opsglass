'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, Server, Shield, Plus, ChevronRight } from 'lucide-react';
import { getStatusLabel, type Status as CoreStatus } from '@repo/core';
import CreateOrganisationModal from './CreateOrganisationModal';

interface Organisation {
    id: string;
    name: string;
    slug: string;
    status: string | null;
    createdAt: Date | null;
    projectCount: number;
}

interface DashboardClientProps {
    organisations: Organisation[];
    stats: {
        services: number;
        incidents: number;
        systemStatus: 'operational' | 'degraded' | 'outage';
    };
}

const getStatusDotClass = (status: string | null) => {
    switch (status) {
        case 'operational':
            return 'status-dot-operational';
        case 'degraded':
            return 'status-dot-degraded';
        case 'major_outage':
        case 'partial_outage':
        case 'outage':
            return 'status-dot-outage';
        default:
            return '';
    }
};

const getStatusBadgeClass = (status: string | null) => {
    switch (status) {
        case 'operational':
            return 'status-badge-operational';
        case 'degraded':
            return 'status-badge-degraded';
        case 'outage':
        case 'major_outage':
        case 'partial_outage':
            return 'status-badge-outage';
        default:
            return '';
    }
};

export default function DashboardClient({ organisations, stats }: DashboardClientProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 30000); // 30s polling
        return () => clearInterval(interval);
    }, [router]);

    const handleSuccess = () => {
        router.refresh();
    };

    return (
        <>
            <main className="min-h-screen">
                {/* Navigation Header */}
                <header className="glass-panel sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gradient">OpsGlass</h1>
                                <p className="text-xs text-muted-foreground -mt-0.5">Unified Monitoring Platform</p>
                            </div>
                        </div>
                        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                            <Plus size={16} />
                            <span>New Organisation</span>
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Status Overview Cards */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in">
                        {/* System Status */}
                        <div className="glass-card glass-card-status p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <Activity className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <span className="font-medium text-sm text-muted-foreground">System Status</span>
                                </div>
                                <div className={`status-dot ${getStatusDotClass(stats.systemStatus)}`} />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold">
                                    {stats.systemStatus === 'operational' ? 'All Operational' :
                                        stats.systemStatus === 'degraded' ? 'Degraded Performance' : 'System Outage'}
                                </span>
                            </div>
                            <div className="mt-3">
                                <span className={`status-badge ${getStatusBadgeClass(stats.systemStatus)}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    {stats.systemStatus === 'operational' ? 'Healthy' :
                                        stats.systemStatus === 'degraded' ? 'Degraded' : 'Issue Detected'}
                                </span>
                            </div>
                        </div>

                        {/* Monitored Services */}
                        <div className="glass-card p-6 rounded-2xl animate-fade-in-delay-1">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <Server className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <span className="font-medium text-sm text-muted-foreground">Monitored Services</span>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-gradient-primary">{stats.services}</span>
                                <span className="text-muted-foreground text-sm">services</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                                {stats.services === 0 ? 'Add your first project to start monitoring' : 'Monitored across all projects'}
                            </p>
                        </div>

                        {/* Active Incidents */}
                        <div className="glass-card p-6 rounded-2xl animate-fade-in-delay-2">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <span className="font-medium text-sm text-muted-foreground">Active Incidents</span>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold">{stats.incidents}</span>
                                <span className="text-muted-foreground text-sm">incidents</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                                {stats.incidents === 0 ? 'No active incidents at this time' : `${stats.incidents} unresolved incidents`}
                            </p>
                        </div>
                    </section>

                    {/* Organisations Section */}
                    <section className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">Organisations</h2>
                            <button className="btn-secondary text-sm">
                                View All
                                <ChevronRight className="w-4 h-4 ml-1 inline" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {organisations.length === 0 ? (
                                <div className="col-span-full glass-card empty-state p-12 text-center rounded-2xl">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                                        <Plus className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium mb-2">No organisations yet</h3>
                                    <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                                        Create your first organisation to start monitoring your projects and dependencies.
                                    </p>
                                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                                        <Plus size={16} />
                                        <span>Create Organisation</span>
                                    </button>
                                </div>
                            ) : (
                                organisations.map(org => (
                                    <Link
                                        key={org.id}
                                        href={`/organisations/${org.slug}`}
                                        className="glass-card interactive-card p-6 rounded-2xl group cursor-pointer block"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                                                <span className="text-lg font-bold text-gradient">
                                                    {org.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className={`status-dot ${getStatusDotClass(org.status)}`} />
                                        </div>
                                        <h3 className="text-lg font-semibold mb-1 group-hover:text-gradient transition-all">
                                            {org.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{org.slug}</p>
                                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">{org.projectCount} projects</span>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <footer className="mt-20 border-t border-white/5">
                    <div className="max-w-7xl mx-auto px-6 py-8">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Activity className="w-4 h-4" />
                                <span>OpsGlass Monitoring Platform</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                © 2026 OpsGlass. All systems operational.
                            </p>
                        </div>
                    </div>
                </footer>
            </main>

            <CreateOrganisationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
            />
        </>
    );
}
