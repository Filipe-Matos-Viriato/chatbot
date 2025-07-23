import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const ChartPlaceholder = ({ title, description, height = "h-40", chartData, chartOptions }) => (
    <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className={`${height} flex items-center justify-center`}>
            {chartData ? (
                <Pie data={chartData} options={chartOptions} />
            ) : (
                <div className="text-gray-500">Loading Chart...</div>
            )}
        </div>
        <p className="text-sm text-gray-600 mt-4">{description}</p>
    </div>
);

export default ChartPlaceholder;