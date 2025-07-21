import React from 'react';
import MetricCard from '../MetricCard';

const ChatbotResolutionRateMetric = () => {
    // This value will eventually come from Supabase
    const value = '78%'; 
    const label = 'Chatbot Resolution Rate';

    return (
        <MetricCard value={value} label={label} />
    );
};

export default ChatbotResolutionRateMetric;