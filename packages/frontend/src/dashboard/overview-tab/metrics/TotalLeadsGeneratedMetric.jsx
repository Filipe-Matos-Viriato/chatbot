import React from 'react';
import MetricCard from '../MetricCard';

const TotalLeadsGeneratedMetric = () => {
    // This value will eventually come from Supabase
    const value = '6'; 
    const label = 'Total Leads Generated';

    return (
        <MetricCard value={value} label={label} />
    );
};

export default TotalLeadsGeneratedMetric;