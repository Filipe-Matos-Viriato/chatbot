import React, { useState, useEffect } from 'react';
import HotLeadsAlert from './HotLeadsAlert';
import ChartPlaceholder from './ChartPlaceholder';
import TopListings from './TopListings';
import VisitorsWithEventsTable from './VisitorsWithEventsTable';
import TotalLeadsGeneratedMetric from './metrics/TotalLeadsGeneratedMetric';
import ChatbotResolutionRateMetric from './metrics/ChatbotResolutionRateMetric';
import NewHotLeadsMetric from './metrics/NewHotLeadsMetric';
import AvgChatDurationMetric from './metrics/AvgChatDurationMetric';
import PropertyViewingsBookedMetric from './metrics/PropertyViewingsBookedMetric';
import UnansweredQuestionsMetric from './metrics/UnansweredQuestionsMetric';
import { API_BASE_URL } from '../../config/apiClient';
import { supabase, getLeadDistributionMetrics } from '../../config/supabaseClient';
import { useClient } from '../../context/ClientContext'; // Import useClient


const OverviewTab = ({ clientId, onViewHotLeads, hiddenMetrics = [] }) => {
    const [leadDistributionData, setLeadDistributionData] = useState(null);
    const [newHotLeadsCount, setNewHotLeadsCount] = useState(0);
    const [newHotLeadVisitorIds, setNewHotLeadVisitorIds] = useState([]);
    const [topInquiredListings, setTopInquiredListings] = useState([]);

    useEffect(() => {
        const fetchOverviewData = async () => {
            if (!clientId) return;

            // Fetch lead distribution data
            const metrics = await getLeadDistributionMetrics(clientId);
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

            // Fetch new hot leads
            const { data, count, error } = await supabase
                .from('visitors')
                .select('visitor_id', { count: 'exact' })
                .eq('client_id', clientId)
                .gte('lead_score', 70)
                .eq('is_acknowledged', false);

            if (error) {
                console.error('Error fetching new hot leads:', error);
                setNewHotLeadsCount(0);
                setNewHotLeadVisitorIds([]);
            } else {
                console.log('Fetched new hot leads count:', count);
                setNewHotLeadsCount(count);
                setNewHotLeadVisitorIds(data.map(v => v.visitor_id));
            }

            // Fetch top inquired listings
            const [listingsResult, metricsResult] = await Promise.all([
                supabase.from('listings').select('*').eq('client_id', clientId),
                supabase.from('listing_metrics').select('*').eq('client_id', clientId)
            ]);

            if (listingsResult.data && metricsResult.data) {
                const combinedListings = listingsResult.data.map(listing => {
                    const metrics = metricsResult.data.find(m => m.listing_id === listing.id);
                    return {
                        ...listing,
                        inquiries: metrics ? metrics.inquiries : 0,
                        engaged_users: metrics ? metrics.engaged_users : 0,
                        total_conversions: metrics ? metrics.total_conversions : 0,
                        conversion_rate: metrics ? metrics.conversion_rate : 0
                    };
                });

                const sortedListings = combinedListings.sort((a, b) => b.inquiries - a.inquiries);
                setTopInquiredListings(sortedListings.slice(0, 5));
            }
        };

        fetchOverviewData();
    }, [clientId]);

    const handleAcknowledgeHotLeads = async () => {
        if (newHotLeadVisitorIds.length > 0) {
            try {
                const response = await fetch(`${API_BASE_URL}/v1/leads/acknowledge`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ visitorIds: newHotLeadVisitorIds, clientId }), // Pass clientId
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
            },
            datalabels: {
                display: false
            }
        }
    };

    return (
        <div className="space-y-6 w-full">
            <h2 className="text-xl font-semibold text-gray-800">Dashboard Overview</h2>

            <HotLeadsAlert newHotLeadsCount={newHotLeadsCount} onViewHotLeads={() => onViewHotLeads('new-hot')} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                <TotalLeadsGeneratedMetric />
                {!hiddenMetrics.includes('chatbot-resolution-rate') && <ChatbotResolutionRateMetric />}
                <NewHotLeadsMetric newHotLeadsCount={newHotLeadsCount} />
                {!hiddenMetrics.includes('avg-chat-duration') && <AvgChatDurationMetric />}
                {!hiddenMetrics.includes('property-viewings-booked') && <PropertyViewingsBookedMetric />}
                <UnansweredQuestionsMetric />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartPlaceholder
                    title="Lead Score Distribution"
                    description="Shows the percentage of leads in Hot, Warm, and Cold categories."
                    chartData={leadDistributionData}
                    chartOptions={chartOptions}
                />
                <TopListings listings={topInquiredListings} clientId={clientId} />
            </div>

            <VisitorsWithEventsTable />
        </div>
    );
};

export default OverviewTab;
