import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useClient } from '../../../context/ClientContext';
import { getLeadScoresForHistogram } from '../../../config/supabaseClient';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

const LeadScoreDistribution = () => {
    const { selectedClientId } = useClient();
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!selectedClientId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const leadScores = await getLeadScoresForHistogram(selectedClientId);

            // Define bins: 1-10, 11-20, ..., 91-100
            const bins = Array.from({ length: 10 }, (_, i) => ({
                label: `${i * 10 + 1}-${(i + 1) * 10}`,
                min: i * 10 + 1,
                max: (i + 1) * 10,
                count: 0
            }));

            // Bin the scores
            leadScores.forEach(score => {
                if (score === 0) {
                    bins[0].count++; // Put 0 in 1-10
                } else {
                    const binIndex = Math.floor((score - 1) / 10);
                    if (binIndex >= 0 && binIndex < bins.length) {
                        bins[binIndex].count++;
                    }
                }
            });

            const data = {
                labels: bins.map(bin => bin.label),
                datasets: [
                    {
                        label: 'Number of Leads',
                        data: bins.map(bin => bin.count),
                        backgroundColor: '#3B82F6',
                        borderColor: '#2563EB',
                        borderWidth: 1,
                    },
                ],
            };

            setChartData(data);
            setLoading(false);
        };

        fetchData();
    }, [selectedClientId]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                top: 25
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                align: 'start',
                labels: {
                    usePointStyle: false,
                    boxWidth: 12,
                    boxHeight: 12,
                    padding: 10,
                    font: {
                        size: 12
                    }
                }
            },
            title: {
                display: false,
            },
            datalabels: {
                color: 'black',
                anchor: 'end',
                align: 'top',
                offset: 3,
                formatter: (value) => value === 0 ? '' : value.toString(),
                font: {
                    weight: 'regular',
                    size: 12
                }
            }
        },
        scales: {
            y: {
                display: false,
                grid: {
                    display: false,
                },
            },
            x: {
                title: {
                    display: true,
                    text: 'Lead Score Range'
                },
                grid: {
                    display: false,
                },
            },
        },
    };

    return (
        <div className="card-standard flex flex-col min-h-0">
            <div className="flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800">Lead Score Distribution</h3>
                <p className="text-sm text-gray-500 mt-1">Detailed Histogram for Lead Score Ranges</p>
            </div>
            <div className="mt-4 flex-grow flex flex-col justify-end min-h-0">
                <div className="h-96">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
                    ) : chartData ? (
                        <Bar data={chartData} options={options} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadScoreDistribution;