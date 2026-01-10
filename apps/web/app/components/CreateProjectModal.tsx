'use client';

import { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    organisationId: string;
}

export default function CreateProjectModal({ isOpen, onClose, onSuccess, organisationId }: CreateProjectModalProps) {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleNameChange = (value: string) => {
        setName(value);
        // Auto-generate slug from name
        const generatedSlug = value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        setSlug(generatedSlug);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, slug, organisationId }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create project');
            }

            setName('');
            setSlug('');
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
            <div className="glass-card relative w-full max-w-md mx-4 p-6 rounded-2xl animate-fade-in">
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
                        <FolderPlus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Create Project</h2>
                        <p className="text-sm text-muted-foreground">Add a new project to monitor</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-2">
                            Project Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="My Web App"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white placeholder:text-muted-foreground"
                        />
                    </div>

                    <div>
                        <label htmlFor="slug" className="block text-sm font-medium mb-2">
                            Slug
                        </label>
                        <input
                            type="text"
                            id="slug"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder="my-web-app"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white placeholder:text-muted-foreground font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Used in URLs: /projects/{slug || 'slug'}
                        </p>
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
                            disabled={isLoading || !name || !slug}
                            className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
