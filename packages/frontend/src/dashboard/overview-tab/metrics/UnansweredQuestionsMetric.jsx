import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClient } from '../../../context/ClientContext';
import { apiRequest } from '../../../config/apiClient';
import MetricCard from '../MetricCard';

const UnansweredQuestionsMetric = () => {
    const navigate = useNavigate();
    const { selectedClientId } = useClient();
    const [value, setValue] = useState('0');
    const [loading, setLoading] = useState(true);
    const label = 'Unanswered Questions';

    useEffect(() => {
        const fetchUnansweredQuestionsCount = async () => {
            if (!selectedClientId) {
                setLoading(false);
                return;
            }

            try {
                // Fetch with pageSize=1 to get just the total count without loading all questions
                const response = await apiRequest('/api/unanswered-questions?pageSize=1', {
                    method: 'GET',
                    headers: {
                        'X-Client-Id': selectedClientId,
                    },
                });

                setValue(response.total?.toString() || '0');
            } catch (error) {
                console.error('Error fetching unanswered questions count:', error);
                setValue('0');
            } finally {
                setLoading(false);
            }
        };

        fetchUnansweredQuestionsCount();
    }, [selectedClientId]);

    const handleClick = () => {
        navigate('/dashboard/unanswered-questions');
    };

    return (
        <MetricCard
            value={loading ? '...' : value}
            label={label}
            onClick={handleClick}
        />
    );
};

export default UnansweredQuestionsMetric;