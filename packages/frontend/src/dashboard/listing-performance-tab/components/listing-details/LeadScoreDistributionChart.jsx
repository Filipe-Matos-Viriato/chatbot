import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import ChartPlaceholder from '../../../overview-tab/ChartPlaceholder'; // Adjust path as needed

ChartJS.register(ArcElement, Tooltip, Legend);

const LeadScoreDistributionChart = ({ leadDistributionData }) => {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    generateLabels: function (chart) {
                        const data = chart.data;
                        if (data.labels.length && data.datasets.length) {
                            const total = data.datasets[0].data.reduce((sum, value) => sum + value, 0);
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
                                return {
                                    text: `${label}: ${percentage}%`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    strokeStyle: data.datasets[0].borderColor ? data.datasets[0].borderColor[i] : data.datasets[0].backgroundColor[i],
                                    lineWidth: 1,
                                    hidden: false,
                                    index: i
                                };
                            });
                        }
                        return [];
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        let label = context.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed !== null) {
                            label += context.parsed.toFixed(1) + '%';
                        }
                        return label;
                    }
                }
            }
        }
    };

    return (
        <ChartPlaceholder
            title="Lead Score Distribution for this Listing"
            description="Shows the percentage of leads in Hot, Warm, and Cold categories for this specific listing."
            chartData={leadDistributionData}
            chartOptions={chartOptions}
        />
    );
};

export default LeadScoreDistributionChart;