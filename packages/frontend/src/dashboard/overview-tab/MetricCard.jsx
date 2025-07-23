import React from 'react';

const MetricCard = ({ value, label, description, className = '' }) => (
    <div className={`bg-white rounded-lg border shadow-sm p-6 text-center ${className}`}>
        <div className="text-4xl font-bold text-gray-900 mb-2">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
);

export default MetricCard;