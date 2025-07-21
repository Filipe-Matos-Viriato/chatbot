import React from 'react';

const ConversionRateThreshold = () => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800">Conversion Rate by Lead Score Threshold</h3>
            <p className="text-sm text-gray-500 mt-1">Line Chart: Conversion Rate vs. Lead Score</p>
            <p className="text-sm text-gray-500 mt-1">Shows how higher lead scores correlate with conversion success.</p>
            <div className="mt-4">
                <label htmlFor="conversion-metric" className="block text-sm font-medium text-gray-700">Select Conversion Metric:</label>
                <select
                    id="conversion-metric"
                    name="conversion-metric"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    defaultValue="Booked Viewing"
                >
                    <option>Booked Viewing</option>
                    <option>Submitted Contact Info</option>
                    <option>Asked to be Contacted</option>
                    <option>Requested Brochure</option>
                </select>
            </div>
            <div className="mt-4 h-64 bg-gray-100 flex items-center justify-center text-gray-400">
                [Conversion Rate Chart Placeholder]
            </div>
        </div>
    );
};

export default ConversionRateThreshold;