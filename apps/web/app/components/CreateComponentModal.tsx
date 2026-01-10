'use client';

import { useState } from 'react';
import { X, Box, Database, Zap, Globe } from 'lucide-react';

interface CreateComponentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    projectId: string;
}

const COMPONENT_TYPES = [
    { value: 'application', label: 'Application', icon: Box, description: 'Web app, API, or service' },
    { value: 'database', label: 'Database', icon: Database, description: 'PostgreSQL, MySQL, Redis, etc.' },
    { value: 'service', label: 'Service', icon: Zap, description: 'Background worker, queue, etc.' },
    { value: 'dependency', label: 'Dependency', icon: Globe, description: 'External API or service' },
];

const PROVIDERS = [
    { value: 'vercel', label: 'Vercel' },
    { value: 'aws', label: 'AWS' },
    { value: 'gcp', label: 'Google Cloud' },
    { value: 'azure', label: 'Azure' },
    { value: 'supabase', label: 'Supabase' },
    { value: 'firebase', label: 'Firebase' },
    { value: 'stripe', label: 'Stripe' },
    { value: 'github', label: 'GitHub' },
    { value: 'cloudflare', label: 'Cloudflare' },
    { value: 'custom', label: 'Custom / Other' },
];

export default function CreateComponentModal({ isOpen, onClose, onSuccess, projectId }: CreateComponentModalProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState('application');
    const [provider, setProvider] = useState('');
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/components', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    type,
                    provider: provider || null,
                    projectId,
                    url: url || null,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create component');
            }

            setName('');
            setType('application');
            setProvider('');
            setUrl('');
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="glass-card relative w-full max-w-lg mx-4 p-6 rounded-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Box className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Add Component</h2>
                        <p className="text-sm text-muted-foreground">Configure a new monitored component</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-2">
                            Component Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="API Server"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white placeholder:text-muted-foreground"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-3">
                            Component Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {COMPONENT_TYPES.map(({ value, label, icon: Icon, description }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setType(value)}
                                    className={`p-4 rounded-xl border text-left transition-all ${type === value
                                        ? 'border-blue-500/50 bg-blue-500/10'
                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 mb-2 ${type === value ? 'text-blue-400' : 'text-muted-foreground'}`} />
                                    <div className="font-medium text-sm">{label}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="provider" className="block text-sm font-medium mb-2">
                            Provider (Optional)
                        </label>
                        <select
                            id="provider"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white"
                        >
                            <option value="">Select provider...</option>
                            {PROVIDERS.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !name}
                            className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Adding...' : 'Add Component'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
