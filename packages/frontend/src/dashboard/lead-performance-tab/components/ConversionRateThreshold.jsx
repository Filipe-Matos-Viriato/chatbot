import React, { useState, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useClient } from '../../../context/ClientContext';
import { apiRequest } from '../../../config/apiClient';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels
);

const ConversionRateThreshold = () => {
    const { selectedClientId } = useClient();
    const [conversionMetric, setConversionMetric] = useState('BOOKED_VIEWING');
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Mapping from dropdown values to event_type values
    const metricMapping = {
        'Booked Viewing': 'BOOKED_VIEWING',
        'Submitted Contact Info': 'SUBMITTED_CONTACT',
        'Asked to be Contacted': 'ASKED_CONTACT_AGENT',
        'Requested Brochure': 'REQUESTED_BROCHURE'
    };

    const fetchChartData = async () => {
        if (!selectedClientId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await apiRequest(
                `/api/metrics/conversion-rate-by-score-threshold?conversionMetric=${conversionMetric}`,
                {
                    headers: {
                        'x-client-id': selectedClientId
                    }
                }
            );

            if (response.data) {
                const labels = response.data.map(item => item.scoreRange);
                const conversionRates = response.data.map(item => item.conversionRate);

                setChartData({
                    labels,
                    datasets: [
                        {
                            label: 'Conversion Rate (%)',
                            data: conversionRates,
                            borderColor: 'rgb(59, 130, 246)',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                            pointBackgroundColor: 'rgb(59, 130, 246)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            pointHoverRadius: 8,
                        }
                    ]
                });
            }
        } catch (err) {
            console.error('Error fetching conversion rate data:', err);
            setError('Failed to load chart data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChartData();
    }, [selectedClientId, conversionMetric]);

    const handleMetricChange = (event) => {
        const selectedValue = event.target.value;
        setConversionMetric(metricMapping[selectedValue]);
    };

    const options = {   //defines the padding of the chart
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                top: 25,
                bottom: 0,
                left: 10,
                right: 10
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
                    },
                    generateLabels: function(chart) {
                        const datasets = chart.data.datasets;
                        return datasets.map(function(dataset, i) {
                            return {
                                text: dataset.label,
                                fillStyle: 'rgb(59, 130, 246)', // Same blue as chart line
                                strokeStyle: 'rgb(59, 130, 246)',
                                lineWidth: 0,
                                hidden: !chart.isDatasetVisible(i),
                                index: i,
                                fontColor: '#666666' // Match LeadScoreDistribution default color
                            };
                        });
                    }
                }
            },
            title: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const dataIndex = context.dataIndex;
                        const item = chartData ? chartData.datasets[0].data[dataIndex] : null;
                        return `Conversion Rate: ${item}%`;
                    }
                }
            },
            datalabels: {
                display: true,
                color: '#374151',
                anchor: 'end',
                align: 'top',
                offset: 8,
                formatter: function(value) {
                    return value + '%';
                },
                font: {
                    size: 11,
                    weight: 'bold'
                }
            }
        },
        scales: {
            y: {
                display: false
            },
            x: {
                title: {
                    display: true,
                    text: 'Lead Score Range'
                },
                grid: {
                    display: false
                }
            }
        }
    };

    return (
        <div className="card-standard flex flex-col min-h-0">
            <div className="flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800">Conversion Rate by Lead Score Threshold</h3>
                
                <p className="text-sm text-gray-500 mt-1">Shows how higher lead scores correlate with conversion success.</p>
                <div className="mt-4">
                    <label htmlFor="conversion-metric" className="block text-sm font-medium text-gray-700">Select Conversion Metric:</label>
                    <select
                        id="conversion-metric"
                        name="conversion-metric"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={Object.keys(metricMapping).find(key => metricMapping[key] === conversionMetric)}
                        onChange={handleMetricChange}
                    >
                        <option>Booked Viewing</option>
                        <option>Submitted Contact Info</option>
                        <option>Asked to be Contacted</option>
                        <option>Requested Brochure</option>
                    </select>
                </div>
            </div>
            <div className="mt-4 flex flex-col justify-end">
                <div className="h-80 pt-4">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            Loading chart data...
                        </div>
                    ) : error ? (
                        <div className="h-full flex items-center justify-center text-red-500">
                            {error}
                        </div>
                    ) : chartData ? (
                        <Line data={chartData} options={options} />
                    ) : (
                        <div className="h-full bg-gray-100 flex items-center justify-center text-gray-400">
                            No data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConversionRateThreshold;