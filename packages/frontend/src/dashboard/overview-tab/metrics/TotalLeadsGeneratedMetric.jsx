import React, { useState, useEffect } from 'react';
import MetricCard from '../MetricCard';
import { getLeadDistributionMetrics } from '../../../config/supabaseClient';
import { useClient } from '../../../context/ClientContext'; // Import useClient

const TotalLeadsGeneratedMetric = () => {
    const { selectedClientId } = useClient(); // Get selectedClientId from context
    const [totalLeads, setTotalLeads] = useState('Loading...');
    const label = 'Total Leads Generated';

    useEffect(() => {
        const fetchTotalLeads = async () => {
            if (!selectedClientId) return; // Don't fetch if no client is selected
            const metrics = await getLeadDistributionMetrics(selectedClientId);
            if (metrics) {
                setTotalLeads(metrics.total.toString());
            } else {
                setTotalLeads('N/A');
            }
        };

        fetchTotalLeads();
    }, [selectedClientId]);

    return (
        <MetricCard value={totalLeads} label={label} />
    );
};

export default TotalLeadsGeneratedMetric;