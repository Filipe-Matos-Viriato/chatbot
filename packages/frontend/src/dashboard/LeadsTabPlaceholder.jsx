// File location: packages/frontend/src/dashboard/LeadsTabPlaceholder.jsx
// Description: This is a placeholder component for the new "Leads" tab in the client-specific dashboard.
// Why this file exists: To provide a dedicated component for the "Leads" section, allowing for future expansion with lead-specific metrics and functionalities, separate from the general Lead Performance tab.
// Relevant files: packages/frontend/src/dashboard/DashboardUpInvestments.jsx

import React from 'react';

const LeadsTabPlaceholder = () => {
    return (
        <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-600">
                Conteúdo da aba "Leads" em desenvolvimento
            </h3>
            <p className="text-sm text-gray-500 mt-2">
                Esta seção exibirá métricas e informações detalhadas sobre leads.
            </p>
        </div>
    );
};

export default LeadsTabPlaceholder;