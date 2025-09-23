// 1. exact file location in database
// packages/frontend/src/dashboard/lead-performance-tab/components/CustomCriteriaPopup.jsx
// 2. clear description of what the file does
// This component provides a popup modal for defining custom lead qualification criteria
// 3. clear description of why this file exists
// To allow users to set custom parameters for what constitutes a qualified lead
// 4. relevant files: comma-separated list of 2-4 most relevant files
// LeadPerformanceTab.jsx, IndividualLeadProgression.jsx, LeadQualificationMetrics.jsx

import React, { useState } from 'react';

const CustomCriteriaPopup = ({ isOpen, onClose, onSave, initialCriteria = {} }) => {
    const [minimalLeadScore, setMinimalLeadScore] = useState(initialCriteria.minimalLeadScore || 40);
    const [selectedConversionActions, setSelectedConversionActions] = useState(initialCriteria.selectedConversionActions || []);

    const conversionActionOptions = [
        { value: 'submitted_contact_info', label: 'Submitted contact info' },
        { value: 'booked_property_viewing', label: 'Booked a property viewing' },
        { value: 'asked_to_be_contacted', label: 'Asked to be contacted by an agent' },
        { value: 'requested_brochure', label: 'Requested a brochure or floor plan' }
    ];

    const handleSave = () => {
        onSave({
            minimalLeadScore: parseInt(minimalLeadScore),
            selectedConversionActions
        });
        onClose();
    };

    const toggleConversionAction = (actionValue) => {
        setSelectedConversionActions(prev =>
            prev.includes(actionValue)
                ? prev.filter(a => a !== actionValue)
                : [...prev, actionValue]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">
                        Define "Your Custom Lead Qualification Rules"
                    </h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Set parameters for what constitutes a "Qualified Lead" for your business.
                    </p>

                    {/* Minimal Lead Score Input */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Lead Score
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={minimalLeadScore}
                            onChange={(e) => setMinimalLeadScore(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Required Conversion Actions Dropdown */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Required Conversion Actions
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                            Select one or more actions a lead must have taken.
                        </p>
                        <div className="border border-gray-300 rounded-md max-h-40 overflow-y-auto">
                            {conversionActionOptions.map((option) => (
                                <label key={option.value} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedConversionActions.includes(option.value)}
                                        onChange={() => toggleConversionAction(option.value)}
                                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="text-sm text-gray-700">{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Save Criteria
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomCriteriaPopup;