import React from 'react';
import MetricCard from '../MetricCard';

const AvgChatDurationMetric = () => {
    // This value will eventually come from Supabase
    const value = '5.2 min'; 
    const label = 'Avg. Chat Duration';

    return (
        <MetricCard value={value} label={label} />
    );
};

export default AvgChatDurationMetric;