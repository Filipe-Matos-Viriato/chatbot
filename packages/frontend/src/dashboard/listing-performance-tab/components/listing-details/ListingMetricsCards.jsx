import React from 'react';
import MetricCard from '../../../overview-tab/MetricCard'; // Assuming MetricCard is reusable

const ListingMetricsCards = ({ listingMetrics }) => {
    const {
        engaged_users,
        total_conversions,
        unacknowledged_hot_leads,
        conversion_rate
    } = listingMetrics || {};

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
                label="Chatbot Views"
                value={engaged_users || 0}
                description="Total unique users who engaged with the chatbot on this listing."
            />
            <MetricCard
                label="Total Inquiries"
                value={listingMetrics?.inquiries || 0}
                description="Total questions asked about this listing."
            />
            <MetricCard
                label="Hot Leads Generated"
                value={unacknowledged_hot_leads || 0}
                description="New hot leads generated from this listing."
            />
            <MetricCard
                label="Lead Conversion Rate"
                value={`${(conversion_rate !== null && conversion_rate !== undefined) ? conversion_rate.toFixed(2) : '0.00'}%`}
                description="Percentage of engaged users who converted."
            />
        </div>
    );
};

export default ListingMetricsCards;