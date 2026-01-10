'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Plus, ChevronRight, Activity, Server, Box,
    Database, Globe, Zap, Settings, RefreshCw
} from 'lucide-react';
import { getStatusLabel, type Status as CoreStatus } from '@repo/core';
import CreateComponentModal from '@/app/components/CreateComponentModal';
import CreateCheckModal from '@/app/components/CreateCheckModal';

interface Organisation {
    id: string;
    name: string;
    slug: string;
}

interface Project {
    id: string;
    name: string;
    slug: string;
    status: string | null;
}

interface Component {
    id: string;
    name: string;
    type: string;
    provider: string | null;
    status: string | null;
}

interface Check {
    id: string;
    componentId: string;
    type: string;
    config: any;
    frequency: number | null;
    lastRunAt: Date | null;
}

interface ProjectClientProps {
    organisation: Organisation;
    project: Project;
    components: Component[];
    checks: Check[];
}

const getStatusDotClass = (status: string | null) => {
    switch (status) {
        case 'operational':
            return 'status-dot-operational';
        case 'degraded':
            return 'status-dot-degraded';
        case 'major_outage':
        case 'partial_outage':
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
        case 'major_outage':
        case 'partial_outage':
            return 'status-badge-outage';
        default:
            return '';
    }
};

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'database':
            return <Database className="w-5 h-5" />;
        case 'service':
            return <Zap className="w-5 h-5" />;
        case 'dependency':
            return <Globe className="w-5 h-5" />;
        default:
            return <Box className="w-5 h-5" />;
    }
};

const getProviderColor = (provider: string | null) => {
    const colors: Record<string, string> = {
        vercel: 'from-black to-gray-700',
        aws: 'from-orange-500 to-yellow-500',
        stripe: 'from-indigo-500 to-purple-600',
        supabase: 'from-emerald-500 to-green-400',
        firebase: 'from-yellow-500 to-orange-500',
        github: 'from-gray-700 to-gray-900',
    };
    return colors[provider?.toLowerCase() || ''] || 'from-blue-500/20 to-purple-600/20';
};

export default function ProjectClient({ organisation, project, components, checks }: ProjectClientProps) {
    const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
    const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
    const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        const interval = setInterval(() => {
            router.refresh();
        }, 15000); // 15s polling
        return () => clearInterval(interval);
    }, [router]);

    const activeChecksCount = checks.filter(c => c.id).length; // Filter basic valid checks, essentially all loaded checks

    const handleSuccess = () => {
        router.refresh();
    };

    const openCheckModal = (componentId: string) => {
        setSelectedComponentId(componentId);
        setIsCheckModalOpen(true);
    };

    return (
        <>
            <main className="min-h-screen">
                {/* Navigation Header */}
                <header className="glass-panel sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Link href={`/organisations/${organisation.slug}`} className="btn-secondary p-2">
                                <ArrowLeft className="w-4 h-4" />
                            </Link>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{organisation.name}</span>
                                <ChevronRight className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <Server className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gradient">{project.name}</h1>
                                    <p className="text-xs text-muted-foreground -mt-0.5">{project.slug}</p>
                                </div>
                            </div>
                        </div>
                        <button className="btn-primary" onClick={() => setIsComponentModalOpen(true)}>
                            <Plus size={16} />
                            <span>Add Component</span>
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Project Status Overview */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in">
                        <div className="glass-card glass-card-status p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <Activity className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <span className="font-medium text-sm text-muted-foreground">Project Status</span>
                                </div>
                                <div className={`status-dot ${getStatusDotClass(project.status)}`} />
                            </div>
                            <span className="text-2xl font-bold">
                                {project.status ? getStatusLabel(project.status as any) : 'Unknown'}
                            </span>
                        </div>

                        <div className="glass-card p-6 rounded-2xl animate-fade-in-delay-1">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Box className="w-5 h-5 text-blue-400" />
                                </div>
                                <span className="font-medium text-sm text-muted-foreground">Components</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-gradient-primary">{components.length}</span>
                                <span className="text-muted-foreground text-sm">monitored</span>
                            </div>
                        </div>

                        <div className="glass-card p-6 rounded-2xl animate-fade-in-delay-2">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                    <RefreshCw className="w-5 h-5 text-purple-400" />
                                </div>
                                <span className="font-medium text-sm text-muted-foreground">Active Checks</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold">{activeChecksCount}</span>
                                <span className="text-muted-foreground text-sm">running</span>
                            </div>
                        </div>
                    </section>

                    {/* Components Grid */}
                    <section className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">Components</h2>
                        </div>

                        <div className="space-y-4">
                            {components.length === 0 ? (
                                <div className="glass-card empty-state p-12 text-center rounded-2xl">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                                        <Box className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium mb-2">No components yet</h3>
                                    <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                                        Add components to monitor your applications, databases, and dependencies.
                                    </p>
                                    <button className="btn-primary" onClick={() => setIsComponentModalOpen(true)}>
                                        <Plus size={16} />
                                        <span>Add Component</span>
                                    </button>
                                </div>
                            ) : (
                                components.map(component => (
                                    <div key={component.id} className="glass-card p-6 rounded-2xl">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getProviderColor(component.provider)} flex items-center justify-center`}>
                                                    {getTypeIcon(component.type)}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold">{component.name}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <span className="capitalize">{component.type}</span>
                                                        {component.provider && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="capitalize">{component.provider}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className={`status-dot ${getStatusDotClass(component.status)}`} />
                                                <span className={`status-badge ${getStatusBadgeClass(component.status)}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                    {component.status === 'operational' ? 'Healthy' :
                                                        component.status === 'unknown' ? 'No checks' :
                                                            component.status?.replace('_', ' ')}
                                                </span>
                                                <button
                                                    onClick={() => openCheckModal(component.id)}
                                                    className="btn-secondary p-2"
                                                    title="Configure Checks"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        {/* Check Details */}
                                        {checks.find(c => c.componentId === component.id) && (
                                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <RefreshCw className="w-3 h-3" />
                                                    <span>
                                                        Last check: {mounted && checks.find(c => c.componentId === component.id)?.lastRunAt
                                                            ? new Date(checks.find(c => c.componentId === component.id)!.lastRunAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                            : 'Pending...'}
                                                    </span>
                                                </div>
                                                <div>
                                                    Every {checks.find(c => c.componentId === component.id)?.frequency}s
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </main>

            <CreateComponentModal
                isOpen={isComponentModalOpen}
                onClose={() => setIsComponentModalOpen(false)}
                onSuccess={handleSuccess}
                projectId={project.id}
            />

            <CreateCheckModal
                isOpen={isCheckModalOpen}
                onClose={() => {
                    setIsCheckModalOpen(false);
                    setSelectedComponentId(null);
                }}
                onSuccess={handleSuccess}
                componentId={selectedComponentId || ''}
                initialData={selectedComponentId ? checks.find(c => c.componentId === selectedComponentId) : undefined}
            />
        </>
    );
}
