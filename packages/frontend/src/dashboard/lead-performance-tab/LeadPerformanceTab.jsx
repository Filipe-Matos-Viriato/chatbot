import React from 'react';
import LeadTypeFilters from './components/LeadTypeFilters';
import LeadScoreDistribution from './components/LeadScoreDistribution';
import ConversionRateThreshold from './components/ConversionRateThreshold';
import LeadQualificationMetrics from './components/LeadQualificationMetrics';
import IndividualLeadProgression from './components/IndividualLeadProgression';

const LeadPerformanceTab = ({ visitors, listings, listingMetrics }) => {
    // Calculate Qualified Leads (example: score >= 40)
    const qualifiedLeads = visitors.filter(visitor => visitor.lead_score >= 40).length;

    // Calculate Hot Leads (score >= 70)
    const hotLeads = visitors.filter(visitor => visitor.lead_score >= 70).length;

    // Placeholder for Avg. Time to Qualify - requires more complex logic
    const avgTimeToQualify = "1.5 days";

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">Lead Performance Analysis</h2>

            <LeadTypeFilters />

            {/* Metrics and Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <LeadScoreDistribution />
                <ConversionRateThreshold />
            </div>

            <LeadQualificationMetrics qualifiedLeads={qualifiedLeads} hotLeads={hotLeads} avgTimeToQualify={avgTimeToQualify} />

            <IndividualLeadProgression visitors={visitors} />
        </div>
    );
};

export default LeadPerformanceTab;