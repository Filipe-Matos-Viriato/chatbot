// packages/frontend/src/dashboard/portuguese-fine-tuning-tab/components/TerminologyManager.jsx
// Component for managing Portuguese terminology configurations.
// To allow administrators to view, add, edit, and delete terminology mappings.
// Relevant files: PortugueseFineTuningTab.jsx, apiClient.js

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';

const TerminologyManager = ({ clientId }) => {
    const [terminology, setTerminology] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState(clientId || '');

    useEffect(() => {
        loadClients();
    }, []);

    useEffect(() => {
        if (selectedClientId) {
            loadTerminology();
        }
    }, [selectedClientId]);

    const loadClients = async () => {
        try {
            const response = await fetch('http://localhost:3007/v1/clients');
            if (!response.ok) throw new Error('Failed to load clients');
            const data = await response.json();
            setClients(data);
            if (data.length > 0 && !selectedClientId) {
                setSelectedClientId(data[0].client_id);
            }
        } catch (err) {
            console.error('Error loading clients:', err);
        }
    };

    const loadTerminology = async () => {
        if (!selectedClientId) return;

        try {
            setLoading(true);
            const response = await fetch(`http://localhost:3007/api/admin/terminology/${selectedClientId}`);
            if (!response.ok) throw new Error('Failed to load terminology');
            const data = await response.json();
            setTerminology(data.terminology);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveTerminology = async (updatedTerminology) => {
        try {
            setSaving(true);
            const response = await fetch(`http://localhost:3007/api/admin/terminology/${selectedClientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTerminology)
            });
            if (!response.ok) throw new Error('Failed to save terminology');
            const data = await response.json();
            setTerminology(data.terminology);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const addTermMapping = () => {
        const newMapping = {
            sourceTerm: '',
            targetTerm: '',
            wordBoundary: true,
            caseSensitive: false
        };
        const updatedTerminology = {
            ...terminology,
            termMappings: [...(terminology.termMappings || []), newMapping]
        };
        setTerminology(updatedTerminology);
    };

    const updateTermMapping = (index, field, value) => {
        const updatedMappings = [...terminology.termMappings];
        updatedMappings[index] = { ...updatedMappings[index], [field]: value };
        setTerminology({
            ...terminology,
            termMappings: updatedMappings
        });
    };

    const removeTermMapping = (index) => {
        const updatedMappings = terminology.termMappings.filter((_, i) => i !== index);
        setTerminology({
            ...terminology,
            termMappings: updatedMappings
        });
    };

    const toggleEnabled = () => {
        const updatedTerminology = {
            ...terminology,
            enabled: !terminology.enabled
        };
        setTerminology(updatedTerminology);
        saveTerminology(updatedTerminology);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading terminology...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error loading terminology</h3>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                        <button
                            onClick={loadTerminology}
                            className="mt-2 text-sm text-red-600 hover:text-red-500"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Client Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Client
                </label>
                <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    {clients.map(client => (
                        <option key={client.client_id} value={client.client_id}>
                            {client.client_name}
                        </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                    Choose the client to manage terminology settings for.
                </p>
            </div>

            {/* Status and Controls */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-medium text-gray-900">Terminology Configuration</h2>
                    <p className="text-sm text-gray-600">Manage Portuguese terminology mappings for European Portuguese</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <label className="text-sm font-medium text-gray-700 mr-2">Enabled:</label>
                        <button
                            onClick={toggleEnabled}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                terminology.enabled ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    terminology.enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                    <button
                        onClick={() => saveTerminology(terminology)}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Dialect Selection */}
            <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Dialect
                </label>
                <select
                    value={terminology.primaryDialect}
                    onChange={(e) => setTerminology({...terminology, primaryDialect: e.target.value})}
                    className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="european">European Portuguese</option>
                    <option value="brazilian">Brazilian Portuguese</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                    Choose the primary Portuguese dialect for this client. European Portuguese is recommended for Portugal-based clients.
                </p>
            </div>

            {/* Term Mappings */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-medium text-gray-900">Term Mappings</h3>
                    <button
                        onClick={addTermMapping}
                        className="px-3 py-1 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700"
                    >
                        + Add Mapping
                    </button>
                </div>

                <div className="space-y-3">
                    {terminology.termMappings && terminology.termMappings.length > 0 ? (
                        terminology.termMappings.map((mapping, index) => (
                            <div key={index} className="flex items-center space-x-3 p-4 bg-white border border-gray-200 rounded-lg">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Source Term</label>
                                    <input
                                        type="text"
                                        value={mapping.sourceTerm}
                                        onChange={(e) => updateTermMapping(index, 'sourceTerm', e.target.value)}
                                        placeholder="e.g., banheiros"
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Target Term</label>
                                    <input
                                        type="text"
                                        value={mapping.targetTerm}
                                        onChange={(e) => updateTermMapping(index, 'targetTerm', e.target.value)}
                                        placeholder="e.g., quartos de banho"
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={mapping.wordBoundary}
                                            onChange={(e) => updateTermMapping(index, 'wordBoundary', e.target.checked)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-1 text-xs text-gray-600">Word Boundary</span>
                                    </label>
                                </div>
                                <button
                                    onClick={() => removeTermMapping(index)}
                                    className="p-2 text-red-600 hover:text-red-800"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <p>No term mappings configured yet.</p>
                            <p className="text-sm">Add your first mapping to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TerminologyManager;