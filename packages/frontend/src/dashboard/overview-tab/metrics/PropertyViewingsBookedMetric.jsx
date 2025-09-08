import React, { useState, useEffect } from 'react';
import MetricCard from '../MetricCard';
import { useClient } from '../../../context/ClientContext';
import { API_BASE_URL } from '../../../config/apiClient';

const PropertyViewingsBookedMetric = () => {
    const { selectedClientId } = useClient();
    const [value, setValue] = useState('Loading...');
    const label = 'Property Viewings Booked';

    useEffect(() => {
        const fetchPropertyViewings = async () => {
            if (!selectedClientId) return;

            try {
                const response = await fetch(`${API_BASE_URL}/api/metrics/property-viewings-booked?clientId=${selectedClientId}`);
                if (response.ok) {
                    const data = await response.json();
                    setValue(data.count.toString());
                } else {
                    setValue('0');
                }
            } catch (error) {
                console.error('Error fetching property viewings booked:', error);
                setValue('0');
            }
        };

        fetchPropertyViewings();
    }, [selectedClientId]);

    return (
        <MetricCard value={value} label={label} />
    );
};

export default PropertyViewingsBookedMetric;