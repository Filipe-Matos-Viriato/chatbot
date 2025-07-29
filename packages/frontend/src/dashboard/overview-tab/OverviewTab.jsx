import React, { useState, useEffect } from 'react';
import HotLeadsAlert from './HotLeadsAlert';
import ChartPlaceholder from './ChartPlaceholder';
import TopListings from './TopListings';
import TotalLeadsGeneratedMetric from './metrics/TotalLeadsGeneratedMetric';
import ChatbotResolutionRateMetric from './metrics/ChatbotResolutionRateMetric';
import NewHotLeadsMetric from './metrics/NewHotLeadsMetric';
import AvgChatDurationMetric from './metrics/AvgChatDurationMetric';
import PropertyViewingsBookedMetric from './metrics/PropertyViewingsBookedMetric';
import UnansweredQuestionsMetric from './metrics/UnansweredQuestionsMetric';
import { API_BASE_URL } from '../../config/apiClient';
import { supabase, getLeadDistributionMetrics } from '../../config/supabaseClient';


const OverviewTab = ({ onViewHotLeads, topInquiredListings }) => {
    const [leadDistributionData, setLeadDistributionData] = useState(null);
    const [newHotLeadsCount, setNewHotLeadsCount] = useState(0);
    const [newHotLeadVisitorIds, setNewHotLeadVisitorIds] = useState([]);

    useEffect(() => {
        const fetchLeadData = async () => {
            const metrics = await getLeadDistributionMetrics();
            if (metrics) {
                setLeadDistributionData({
                    labels: ['Hot Leads', 'Warm Leads', 'Cold Leads'],
                    datasets: [
                        {
                            data: [metrics.hot, metrics.warm, metrics.cold],
                            backgroundColor: ['#FF6384', '#FFCE56', '#36A2EB'],
                            hoverBackgroundColor: ['#FF6384', '#FFCE56', '#36A2EB'],
                        },
                    ],
                });
            }
        };

        const fetchNewHotLeads = async () => {
            const { data, count, error } = await supabase
                .from('visitors')
                .select('visitor_id', { count: 'exact' })
                .gte('lead_score', 70)
                .eq('is_acknowledged', false);

            if (error) {
                console.error('Error fetching new hot leads:', error);
                setNewHotLeadsCount(0);
                setNewHotLeadVisitorIds([]);
            } else {
                console.log('Fetched new hot leads count:', count);
                console.log('Fetched new hot leads data:', data);
                setNewHotLeadsCount(count);
                setNewHotLeadVisitorIds(data.map(v => v.visitor_id));
            }
        };

        fetchLeadData();
        fetchNewHotLeads();
    }, []);

    const handleAcknowledgeHotLeads = async () => {
        if (newHotLeadVisitorIds.length > 0) {
            try {
                const response = await fetch(`${API_BASE_URL}/v1/leads/acknowledge`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ visitorIds: newHotLeadVisitorIds }),
                });

                if (response.ok) {
                    console.log('Hot leads acknowledged successfully.');
                    setNewHotLeadsCount(0); // Reset count after acknowledgment
                    setNewHotLeadVisitorIds([]);
                    // Optionally, re-fetch all dashboard data to reflect changes
                    // fetchLeadData();
                } else {
                    console.error('Failed to acknowledge hot leads:', response.statusText);
                }
            } catch (error) {
                console.error('Error acknowledging hot leads:', error);
            }
        }
    };

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
                                    hidden: false, // Ensure legend items are not struck out
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
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Dashboard Overview</h2>

            <HotLeadsAlert newHotLeadsCount={newHotLeadsCount} onAcknowledgeLeads={handleAcknowledgeHotLeads} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <TotalLeadsGeneratedMetric />
                <ChatbotResolutionRateMetric />
                <NewHotLeadsMetric newHotLeadsCount={newHotLeadsCount} />
                <AvgChatDurationMetric />
                <PropertyViewingsBookedMetric />
                <UnansweredQuestionsMetric />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartPlaceholder
                    title="Lead Score Distribution"
                    description="Shows the percentage of leads in Hot, Warm, and Cold categories."
                    chartData={leadDistributionData}
                    chartOptions={chartOptions}
                />
                <TopListings listings={topInquiredListings} />
            </div>
        </div>
    );
};

export default OverviewTab;
