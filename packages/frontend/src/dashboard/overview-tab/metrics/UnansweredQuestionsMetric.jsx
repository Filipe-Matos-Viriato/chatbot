import React from 'react';
import MetricCard from '../MetricCard';

const UnansweredQuestionsMetric = () => {
    // This value will eventually come from Supabase
    const value = '3'; 
    const label = 'Unanswered Questions';

    return (
        <MetricCard value={value} label={label} />
    );
};

export default UnansweredQuestionsMetric;