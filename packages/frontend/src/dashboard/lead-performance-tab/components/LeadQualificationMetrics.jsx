import React from 'react';

const LeadQualificationMetrics = ({ qualifiedLeads, hotLeads, avgTimeToQualify }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800">Lead Qualification Metrics</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                    <p className="text-3xl font-bold text-blue-600">{qualifiedLeads}</p>
                    <p className="text-sm text-gray-500">Qualified Leads (Custom Criteria)</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-blue-600">{hotLeads}</p>
                    <p className="text-sm text-gray-500">"Hot" Leads (70+ Pts)</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-blue-600">{avgTimeToQualify}</p>
                    <p className="text-sm text-gray-500">Avg. Time to Qualify</p>
                </div>
            </div>
            <div className="mt-6 border-t border-gray-200 pt-6">
                <p className="text-sm font-medium text-gray-700">Define Custom Qualification Criteria:</p>
                <p className="text-sm text-gray-500 mt-1">Example: Budget &gt; €500k AND Location = Lisbon AND Property Type = Apartment</p>
                <button className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow hover:bg-gray-300 transition-colors">
                    Manage Criteria
                </button>
            </div>
        </div>
    );
};

export default LeadQualificationMetrics;