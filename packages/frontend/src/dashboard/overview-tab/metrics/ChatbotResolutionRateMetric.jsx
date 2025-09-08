import React, { useState, useEffect } from 'react';
import MetricCard from '../MetricCard';
import { useClient } from '../../../context/ClientContext';
import { API_BASE_URL } from '../../../config/apiClient';

const ChatbotResolutionRateMetric = () => {
    const { selectedClientId } = useClient();
    const [value, setValue] = useState('Loading...');
    const label = 'Chatbot Resolution Rate';

    useEffect(() => {
        const fetchResolutionRate = async () => {
            if (!selectedClientId) return;

            try {
                const response = await fetch(`${API_BASE_URL}/api/metrics/chatbot-resolution-rate?clientId=${selectedClientId}`);
                if (response.ok) {
                    const data = await response.json();
                    setValue(`${data.rate}%`);
                } else {
                    setValue('N/A');
                }
            } catch (error) {
                console.error('Error fetching chatbot resolution rate:', error);
                setValue('N/A');
            }
        };

        fetchResolutionRate();
    }, [selectedClientId]);

    return (
        <MetricCard value={value} label={label} />
    );
};

export default ChatbotResolutionRateMetric;