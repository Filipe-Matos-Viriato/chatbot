import React from 'react';
import MetricCard from '../MetricCard';

const NewHotLeadsMetric = () => {
    // This value will eventually come from Supabase
    const value = '3'; 
    const label = 'New Hot Leads (70+ Pts)';

    return (
        <MetricCard value={value} label={label} />
    );
};

export default NewHotLeadsMetric;