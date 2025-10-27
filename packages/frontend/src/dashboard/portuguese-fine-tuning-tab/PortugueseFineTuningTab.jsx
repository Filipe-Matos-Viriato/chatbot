// packages/frontend/src/dashboard/portuguese-fine-tuning-tab/PortugueseFineTuningTab.jsx
// Main component for Portuguese language localization management in the admin dashboard.
// To provide administrators with tools to configure and test Portuguese terminology settings.
// Relevant files: Dashboard.jsx, NavigationTabs.jsx, apiClient.js

import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import TerminologyManager from './components/TerminologyManager';
import TerminologyTester from './components/TerminologyTester';
import TerminologyAnalytics from './components/TerminologyAnalytics';

const PortugueseFineTuningTab = () => {
    const { selectedClientId } = useClient();
    const [activeSection, setActiveSection] = useState('manager');

    const sections = [
        { id: 'manager', label: 'Terminology Manager', icon: '⚙️' },
        { id: 'tester', label: 'Test Terminology', icon: '🧪' },
        { id: 'analytics', label: 'Analytics', icon: '📊' }
    ];

    if (!selectedClientId) {
        return (
            <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-600">
                    Please select a client first
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                    You need to select a client to manage Portuguese terminology settings.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Portuguese Fine Tuning
                </h1>
                <p className="text-gray-600">
                    Configure and test Portuguese language localization settings for European Portuguese terminology.
                    Ensure consistent terminology across all chatbot responses.
                </p>
            </div>

            {/* Section Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6">
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeSection === section.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <span className="mr-2">{section.icon}</span>
                                {section.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Section Content */}
                <div className="p-6">
                    {activeSection === 'manager' && (
                        <TerminologyManager clientId={selectedClientId} />
                    )}
                    {activeSection === 'tester' && (
                        <TerminologyTester clientId={selectedClientId} />
                    )}
                    {activeSection === 'analytics' && (
                        <TerminologyAnalytics clientId={selectedClientId} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PortugueseFineTuningTab;