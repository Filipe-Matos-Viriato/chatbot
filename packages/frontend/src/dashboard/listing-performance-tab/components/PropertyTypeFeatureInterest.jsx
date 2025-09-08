import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

const PropertyTypeFeatureInterest = ({ listings, listingMetrics, clusteredQuestions }) => {
    // Chart styling constants
    const BAR_BORDER_RADIUS = 4; // Adjust this value to change corner rounding

    // Features to search for
    const features = ['pool', 'garden', 'parking', 'terrace', 'garage', 'gym', 'sauna', 'concierge', 'elevator', 'balcony'];

    // Process bar chart data
    const barChartData = useMemo(() => {
        if (!listings || !listingMetrics) return null;

        const combined = listings.map(listing => {
            const metrics = listingMetrics.find(m => m.listing_id === listing.id);
            return {
                ...listing,
                inquiries: metrics ? metrics.inquiries : 0
            };
        });

        const typeGroups = combined.reduce((acc, listing) => {
            const type = listing.type || 'Unknown';
            if (!acc[type]) acc[type] = 0;
            acc[type] += listing.inquiries;
            return acc;
        }, {});

        const totalInquiries = Object.values(typeGroups).reduce((sum, val) => sum + val, 0);
        const sortedTypes = Object.entries(typeGroups).sort((a, b) => b[1] - a[1]);
        const labels = sortedTypes.map(([type]) => type);
        const data = sortedTypes.map(([, inquiries]) => totalInquiries > 0 ? (inquiries / totalInquiries * 100).toFixed(1) : 0);

        return {
            labels,
            datasets: [{
                label: 'Interest (%)',
                data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                borderRadius: BAR_BORDER_RADIUS
            }]
        };
    }, [listings, listingMetrics]);

    // Process word cloud data
    const wordCloudData = useMemo(() => {
        if (!clusteredQuestions) return [];

        const featureCounts = features.reduce((acc, feature) => {
            acc[feature] = 0;
            return acc;
        }, {});

        clusteredQuestions.forEach(question => {
            const text = question.question_text.toLowerCase();
            features.forEach(feature => {
                if (text.includes(feature)) {
                    featureCounts[feature] += question.count || 1;
                }
            });
        });

        return Object.entries(featureCounts)
            .filter(([_, count]) => count > 0)
            .map(([word, count]) => ({ text: word, value: count }))
            .sort((a, b) => b.value - a.value);
    }, [clusteredQuestions]);

    // Simple word cloud component
    const WordCloud = ({ words }) => {
        const maxValue = Math.max(...words.map(w => w.value), 1);
        return (
            <div className="flex flex-wrap justify-center items-center h-64 p-4">
                {words.map((word, index) => {
                    const size = Math.max(12, (word.value / maxValue) * 36);
                    return (
                        <span
                            key={index}
                            className="inline-block m-1 font-semibold text-blue-600"
                            style={{ fontSize: `${size}px` }}
                        >
                            {word.text}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="card-standard">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Property Type</h3>
            <div className="space-y-6">
                {/* Bar Chart */}
                <div>
                    <h4 className="text-md font-medium text-gray-700 mb-8">Interest by Property Type</h4>
                    {barChartData ? (
                        <div className="h-84">
                            <Bar
                                data={barChartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            callbacks: {
                                                label: (context) => `${context.parsed.y}%`
                                            }
                                        },
                                        datalabels: {
                                            color: 'black',
                                            anchor: 'end',
                                            align: 'top',
                                            offset: 3,
                                            formatter: (value) => `${value}%`,
                                            font: {
                                                weight: 'regular',
                                                size: 12
                                            }
                                        }
                                    },
                                    scales: {
                                        x: {
                                            grid: { display: false }
                                        },
                                        y: {
                                            display: false,
                                            grid: { display: false }
                                        }
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div className="h-64 bg-gray-100 flex items-center justify-center text-gray-400">
                            No data available
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default PropertyTypeFeatureInterest;