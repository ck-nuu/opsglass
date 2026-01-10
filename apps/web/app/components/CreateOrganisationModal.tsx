'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface CreateOrganisationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateOrganisationModal({
    isOpen,
    onClose,
    onSuccess,
}: CreateOrganisationModalProps) {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Auto-generate slug from name
    const handleNameChange = (value: string) => {
        setName(value);
        setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/organisations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, slug }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create organisation');
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
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative glass-card p-8 rounded-2xl w-full max-w-md mx-4 animate-fade-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold mb-2 text-gradient">Create Organisation</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    Add a new organisation to start monitoring your projects.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-2">
                            Organisation Name
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="My Company"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-muted-foreground"
                        />
                    </div>

                    <div>
                        <label htmlFor="slug" className="block text-sm font-medium mb-2">
                            Slug
                        </label>
                        <input
                            id="slug"
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder="my-company"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-muted-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Auto-generated from name. Used in URLs.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
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
                            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Creating...' : 'Create Organisation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
