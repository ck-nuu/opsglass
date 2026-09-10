'use client';

import { useState, useEffect } from 'react';
import { X, Activity, Globe, Shield, Wifi } from 'lucide-react';

interface CreateCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    componentId: string;
    initialData?: {
        id: string;
        type: string;
        config: any;
        frequency: number | null;
    };
}

const CHECK_TYPES = [
    { value: 'http', label: 'HTTP/HTTPS', icon: Globe, description: 'Monitor endpoint availability' },
    { value: 'dns', label: 'DNS', icon: Wifi, description: 'Check DNS resolution' },
    { value: 'ssl', label: 'SSL Certificate', icon: Shield, description: 'Monitor certificate expiry' },
    { value: 'ping', label: 'Ping', icon: Activity, description: 'Basic connectivity check' },
];

const FREQUENCIES = [
    { value: 30, label: 'Every 30 seconds' },
    { value: 60, label: 'Every minute' },
    { value: 300, label: 'Every 5 minutes' },
    { value: 600, label: 'Every 10 minutes' },
    { value: 1800, label: 'Every 30 minutes' },
    { value: 3600, label: 'Every hour' },
];

export default function CreateCheckModal({ isOpen, onClose, onSuccess, componentId, initialData }: CreateCheckModalProps) {
    const [checkType, setCheckType] = useState(initialData?.type || 'http');
    const [url, setUrl] = useState(initialData?.config?.url || initialData?.config?.hostname || initialData?.config?.host || '');
    const [method, setMethod] = useState(initialData?.config?.method || 'GET');
    const [frequency, setFrequency] = useState(initialData?.frequency || 60);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCheckType(initialData?.type || 'http');
            setUrl(initialData?.config?.url || initialData?.config?.hostname || initialData?.config?.host || '');
            setMethod(initialData?.config?.method || 'GET');
            setFrequency(initialData?.frequency || 60);
            setError(''); // Clear error when opening/re-initializing
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const config: Record<string, any> = {};

        if (checkType === 'http') {
            config.url = url;
            config.method = method;
        } else if (checkType === 'dns' || checkType === 'ssl') {
            config.hostname = url;
        } else if (checkType === 'ping') {
            config.host = url;
        }

        try {
            if (initialData?.id) {
                // Update existing check
                const response = await fetch(`/api/checks/${initialData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: checkType,
                        config,
                        frequency,
                    }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to update check');
                }
            } else {
                // Create new check
                const response = await fetch('/api/checks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        componentId,
                        type: checkType,
                        config,
                        frequency,
                    }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to create check');
                }
            }

            setUrl('');
            setCheckType('http');
            setMethod('GET');
            setFrequency(60);
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{initialData ? 'Edit Health Check' : 'Configure Health Check'}</h2>
                        <p className="text-sm text-muted-foreground">{initialData ? 'Update monitoring settings' : 'Set up monitoring for this component'}</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium mb-3">
                            Check Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {CHECK_TYPES.map(({ value, label, icon: Icon, description }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setCheckType(value)}
                                    className={`p-4 rounded-xl border text-left transition-all ${checkType === value
                                        ? 'border-emerald-500/50 bg-emerald-500/10'
                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 mb-2 ${checkType === value ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                                    <div className="font-medium text-sm">{label}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {checkType === 'http' && (
                        <>
                            <div>
                                <label htmlFor="url" className="block text-sm font-medium mb-2">
                                    URL
                                </label>
                                <input
                                    type="url"
                                    id="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://api.example.com/health"
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-white placeholder:text-muted-foreground"
                                />
                            </div>

                            <div>
                                <label htmlFor="method" className="block text-sm font-medium mb-2">
                                    HTTP Method
                                </label>
                                <select
                                    id="method"
                                    value={method}
                                    onChange={(e) => setMethod(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-white"
                                >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="HEAD">HEAD</option>
                                </select>
                            </div>
                        </>
                    )}

                    {(checkType === 'dns' || checkType === 'ssl') && (
                        <div>
                            <label htmlFor="hostname" className="block text-sm font-medium mb-2">
                                Hostname
                            </label>
                            <input
                                type="text"
                                id="hostname"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="example.com"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-white placeholder:text-muted-foreground"
                            />
                        </div>
                    )}

                    {checkType === 'ping' && (
                        <div>
                            <label htmlFor="host" className="block text-sm font-medium mb-2">
                                Host
                            </label>
                            <input
                                type="text"
                                id="host"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="192.168.1.1 or example.com"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-white placeholder:text-muted-foreground"
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="frequency" className="block text-sm font-medium mb-2">
                            Check Frequency
                        </label>
                        <select
                            id="frequency"
                            value={frequency}
                            onChange={(e) => setFrequency(Number(e.target.value))}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-white"
                        >
                            {FREQUENCIES.map(({ value, label }) => (
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
                            disabled={isLoading || !url}
                            className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (initialData ? 'Saving...' : 'Creating...') : (initialData ? 'Save Changes' : 'Create Check')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
