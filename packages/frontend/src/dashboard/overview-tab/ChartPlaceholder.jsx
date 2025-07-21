import React from 'react';

const ChartPlaceholder = ({ title, description, height = "h-40" }) => (
    <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className={`${height} bg-gray-100 rounded flex items-center justify-center text-gray-500`}>
            Chart Placeholder
        </div>
        <p className="text-sm text-gray-600 mt-4">{description}</p>
    </div>
);

export default ChartPlaceholder;