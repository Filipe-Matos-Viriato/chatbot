import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useClient } from '../../../context/ClientContext';
import { API_BASE_URL } from '../../../config/apiClient';

ChartJS.register(ArcElement, Tooltip, Legend);

const NewVsReturningUsers = () => {
    const { selectedClientId } = useClient();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timePeriod, setTimePeriod] = useState('7 days');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const timePeriodOptions = [
        { value: '7 days', label: 'Last 7 days' },
        { value: '1 month', label: 'Last month' },
        { value: '3 months', label: 'Last 3 months' },
        { value: '6 months', label: 'Last 6 months' },
        { value: '1 year', label: 'Last year' },
        { value: 'custom', label: 'Custom Range' }
    ];

    const calculateDates = (period) => {
        const now = new Date();
        let start = new Date();

        switch (period) {
            case '7 days':
                start.setDate(now.getDate() - 7);
                break;
            case '1 month':
                start.setMonth(now.getMonth() - 1);
                break;
            case '3 months':
                start.setMonth(now.getMonth() - 3);
                break;
            case '6 months':
                start.setMonth(now.getMonth() - 6);
                break;
            case '1 year':
                start.setFullYear(now.getFullYear() - 1);
                break;
            case 'custom':
                // For custom, use the current startDate and endDate values
                return {
                    start: startDate || now.toISOString().split('T')[0],
                    end: endDate || now.toISOString().split('T')[0]
                };
            default:
                start.setDate(now.getDate() - 7);
        }

        const result = {
            start: start.toISOString().split('T')[0],
            end: now.toISOString().split('T')[0]
        };

        console.log(`[NewVsReturningUsers] Calculated dates for ${period}:`, result);
        return result;
    };

    const fetchData = async () => {
        if (!selectedClientId) return;

        setLoading(true);
        setError(null);

        try {
            let apiStartDate = startDate;
            let apiEndDate = endDate;

            if (!apiStartDate || !apiEndDate) {
                const dates = calculateDates(timePeriod);
                apiStartDate = dates.start;
                apiEndDate = dates.end;
            }

            const response = await fetch(`${API_BASE_URL}/api/metrics/new-vs-returning-users?startDate=${apiStartDate}&endDate=${apiEndDate}`, {
                headers: {
                    'x-client-id': selectedClientId
                }
            });

            if (response.ok) {
                const data = await response.json();
                setData(data);
            } else {
                throw new Error('Failed to fetch data');
            }
        } catch (err) {
            console.error('Error fetching new vs returning users data:', err);
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedClientId, timePeriod, startDate, endDate]);

    const handleTimePeriodChange = (e) => {
        const selectedPeriod = e.target.value;
        console.log(`[NewVsReturningUsers] Time period changed to: ${selectedPeriod}`);
        setTimePeriod(selectedPeriod);
        // Reset custom dates when selecting predefined period
        if (selectedPeriod !== 'custom') {
            setStartDate('');
            setEndDate('');
        } else {
            // Set default dates for custom range if not already set
            if (!startDate || !endDate) {
                const dates = calculateDates('1 month'); // Default to 1 month
                setStartDate(dates.start);
                setEndDate(dates.end);
            }
        }
    };

    const chartData = data ? {
        labels: ['New Users', 'Returning Users'],
        datasets: [{
            data: [data.newUsers, data.returningUsers],
            backgroundColor: [
                'rgba(59, 130, 246, 0.8)', // Blue for new
                'rgba(16, 185, 129, 0.8)'  // Green for returning
            ],
            borderColor: [
                'rgba(59, 130, 246, 1)',
                'rgba(16, 185, 129, 1)'
            ],
            borderWidth: 2
        }]
    } : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const percentage = data ? Math.round((value / (data.newUsers + data.returningUsers)) * 100) : 0;
                        return `${label}: ${value} (${percentage}%)`;
                    }
                }
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800">New vs. Returning Users</h3>
            <p className="text-sm text-gray-500 mt-1">Understanding user loyalty and engagement patterns based on chatbot interactions.</p>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Filters Section */}
                <div className="lg:col-span-1 flex flex-col">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Time Period
                        </label>
                        <select
                            value={timePeriod}
                            onChange={handleTimePeriodChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {timePeriodOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {timePeriod === 'custom' && (
                        <div className="mb-4">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex-1 flex flex-col justify-end">
                        {data ? (
                            <div className="p-4 bg-gray-50 rounded-md">
                                {console.log(`[NewVsReturningUsers] Rendering summary for ${timePeriod}:`, data)}
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span>New Users:</span>
                                        <span className="font-medium">{data.newUsers} ({data.newPercentage}%)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Returning Users:</span>
                                        <span className="font-medium">{data.returningUsers} ({data.returningPercentage}%)</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-1">
                                        <span>Total:</span>
                                        <span className="font-medium">{data.totalUsers}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-gray-100 rounded-md text-center text-gray-500 text-sm">
                                {timePeriod === 'custom' ? 'Select date range to view data' : `No data available for ${timePeriodOptions.find(opt => opt.value === timePeriod)?.label || timePeriod}`}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chart Section */}
                <div className="lg:col-span-2">
                    {loading && (
                        <div className="h-64 flex items-center justify-center">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    )}

                    {error && (
                        <div className="h-64 flex items-center justify-center">
                            <div className="text-red-500">{error}</div>
                        </div>
                    )}

                    {!loading && !error && chartData && data && data.totalUsers > 0 && (
                        <div className="h-64">
                            <Pie data={chartData} options={chartOptions} />
                        </div>
                    )}

                    {!loading && !error && (!chartData || !data || data.totalUsers === 0) && (
                        <div className="h-64 flex items-center justify-center text-gray-400">
                            No data available for the selected period
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewVsReturningUsers;