import React, { useState, useEffect } from 'react';
import MetricCard from '../MetricCard';
import { useClient } from '../../../context/ClientContext';
import { API_BASE_URL } from '../../../config/apiClient';

const AvgChatDurationMetric = () => {
    const { selectedClientId } = useClient();
    const [value, setValue] = useState('Loading...');
    const label = 'Avg. Chat Duration';

    useEffect(() => {
        const fetchAvgChatDuration = async () => {
            if (!selectedClientId) return;

            try {
                const response = await fetch(`${API_BASE_URL}/api/metrics/average-chat-duration?clientId=${selectedClientId}`);
                if (response.ok) {
                    const data = await response.json();
                    setValue(`${data.averageDuration} min`);
                } else {
                    setValue('N/A');
                }
            } catch (error) {
                console.error('Error fetching average chat duration:', error);
                setValue('N/A');
            }
        };

        fetchAvgChatDuration();
    }, [selectedClientId]);

    return (
        <MetricCard value={value} label={label} />
    );
};

export default AvgChatDurationMetric;