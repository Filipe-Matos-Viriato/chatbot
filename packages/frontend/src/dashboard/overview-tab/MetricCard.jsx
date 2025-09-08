import React from 'react';

const MetricCard = ({ value, label, description, className = '', onClick }) => {
    const clickableClass = onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '';

    return (
        <div
            className={`card-standard text-center ${className} ${clickableClass}`}
            onClick={onClick}
        >
            <div className="text-4xl font-bold text-gray-900 mb-2">{value}</div>
            <div className="text-sm text-gray-600">{label}</div>
            {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
    );
};

export default MetricCard;