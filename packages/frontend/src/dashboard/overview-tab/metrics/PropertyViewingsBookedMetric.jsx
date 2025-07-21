import React from 'react';
import MetricCard from '../MetricCard';

const PropertyViewingsBookedMetric = () => {
    // This value will eventually come from Supabase
    const value = '18'; 
    const label = 'Property Viewings Booked';

    return (
        <MetricCard value={value} label={label} />
    );
};

export default PropertyViewingsBookedMetric;