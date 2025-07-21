import React from 'react';
import HotLeadsAlert from './HotLeadsAlert';
import ChartPlaceholder from './ChartPlaceholder';
import TopListings from './TopListings';
import TotalLeadsGeneratedMetric from './metrics/TotalLeadsGeneratedMetric';
import ChatbotResolutionRateMetric from './metrics/ChatbotResolutionRateMetric';
import NewHotLeadsMetric from './metrics/NewHotLeadsMetric';
import AvgChatDurationMetric from './metrics/AvgChatDurationMetric';
import PropertyViewingsBookedMetric from './metrics/PropertyViewingsBookedMetric';
import UnansweredQuestionsMetric from './metrics/UnansweredQuestionsMetric';

const OverviewTab = ({ onViewHotLeads, topInquiredListings }) => {

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Dashboard Overview</h2>

            <HotLeadsAlert count={3} onViewLeads={onViewHotLeads} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <TotalLeadsGeneratedMetric />
                <ChatbotResolutionRateMetric />
                <NewHotLeadsMetric />
                <AvgChatDurationMetric />
                <PropertyViewingsBookedMetric />
                <UnansweredQuestionsMetric />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartPlaceholder
                    title="Lead Score Distribution"
                    description="Shows the percentage of leads in Hot, Warm, and Cold categories."
                />
                <TopListings listings={topInquiredListings} />
            </div>
        </div>
    );
};

export default OverviewTab;
