'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, ChevronRight, Activity, Server, FolderOpen, Globe, ExternalLink } from 'lucide-react';
import { getStatusLabel, type Status as CoreStatus } from '@repo/core';
import CreateProjectModal from '@/app/components/CreateProjectModal';

interface Organisation {
    id: string;
    name: string;
    slug: string;
    status: string | null;
    isPublic: boolean | null;
    createdAt: Date | null;
}

interface Project {
    id: string;
    name: string;
    slug: string;
    status: string | null;
    createdAt: Date | null;
}

interface Component {
    id: string;
    projectId: string;
    name: string;
}

interface OrganisationClientProps {
    organisation: Organisation;
    projects: Project[];
    components: Component[];
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

export default function OrganisationClient({ organisation, projects, components }: OrganisationClientProps) {
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
                        <div className="flex items-center gap-4">
                            <Link href="/" className="btn-secondary p-2">
                                <ArrowLeft className="w-4 h-4" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <span className="text-lg font-bold text-white">
                                        {organisation.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gradient">{organisation.name}</h1>
                                    <p className="text-xs text-muted-foreground -mt-0.5">{organisation.slug}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className={`btn-secondary ${organisation.isPublic ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-muted-foreground'}`}
                                onClick={async () => {
                                    if (confirm(organisation.isPublic ? 'Disable public status page?' : 'Enable public status page?')) {
                                        try {
                                            await fetch(`/api/organisations/${organisation.id}`, {
                                                method: 'PATCH',
                                                body: JSON.stringify({ isPublic: !organisation.isPublic })
                                            });
                                            router.refresh();
                                        } catch (e) {
                                            console.error(e);
                                            alert('Failed to update settings');
                                        }
                                    }
                                }}
                                title={organisation.isPublic ? "Status Page is Public" : "Make Status Page Public"}
                            >
                                <Globe className="w-4 h-4" />
                                <span className="hidden md:inline text-xs ml-2">
                                    {organisation.isPublic ? 'Public' : 'Private'}
                                </span>
                            </button>
                            {organisation.isPublic && (
                                <Link
                                    href={`/status/${organisation.slug}`}
                                    target="_blank"
                                    className="p-2 hover:text-white text-muted-foreground transition-colors"
                                    title="View Public Page"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </Link>
                            )}
                        </div>
                        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                            <Plus size={16} />
                            <span>New Project</span>
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Stats Overview */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in">
                        <div className="glass-card glass-card-status p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <Activity className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <span className="font-medium text-sm text-muted-foreground">Organisation Status</span>
                                </div>
                                <div className={`status-dot ${getStatusDotClass(organisation.status)}`} />
                            </div>
                            <span className="text-2xl font-bold">
                                {organisation.status ? getStatusLabel(organisation.status as any) : 'Unknown'}
                            </span>
                        </div>

                        <div className="glass-card p-6 rounded-2xl animate-fade-in-delay-1">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <FolderOpen className="w-5 h-5 text-blue-400" />
                                </div>
                                <span className="font-medium text-sm text-muted-foreground">Projects</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-gradient-primary">{projects.length}</span>
                                <span className="text-muted-foreground text-sm">projects</span>
                            </div>
                        </div>

                        <div className="glass-card p-6 rounded-2xl animate-fade-in-delay-2">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                    <Server className="w-5 h-5 text-purple-400" />
                                </div>
                                <span className="font-medium text-sm text-muted-foreground">Components</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold">{components.length}</span>
                                <span className="text-muted-foreground text-sm">monitored</span>
                            </div>
                        </div>
                    </section>

                    {/* Projects Grid */}
                    <section className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">Projects</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.length === 0 ? (
                                <div className="col-span-full glass-card empty-state p-12 text-center rounded-2xl">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                                        <FolderOpen className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                                    <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                                        Create your first project to start monitoring components and services.
                                    </p>
                                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                                        <Plus size={16} />
                                        <span>Create Project</span>
                                    </button>
                                </div>
                            ) : (
                                projects.map(project => (
                                    <Link
                                        key={project.id}
                                        href={`/organisations/${organisation.slug}/projects/${project.slug}`}
                                        className="glass-card interactive-card p-6 rounded-2xl group cursor-pointer block"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                                                <FolderOpen className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <div className={`status-dot ${getStatusDotClass(project.status)}`} />
                                        </div>
                                        <h3 className="text-lg font-semibold mb-1 group-hover:text-gradient transition-all">
                                            {project.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{project.slug}</p>
                                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">
                                                {components.filter(c => c.projectId === project.id).length} components
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </main>

            <CreateProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
                organisationId={organisation.id}
            />
        </>
    );
}
