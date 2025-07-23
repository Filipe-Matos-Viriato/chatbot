import React, { useState, useEffect } from 'react';
import MetricCard from '../MetricCard';
import { getLeadDistributionMetrics } from '../../../config/supabaseClient';

const TotalLeadsGeneratedMetric = () => {
    const [totalLeads, setTotalLeads] = useState('Loading...');
    const label = 'Total Leads Generated';

    useEffect(() => {
        const fetchTotalLeads = async () => {
            const metrics = await getLeadDistributionMetrics();
            if (metrics) {
                setTotalLeads(metrics.total.toString());
            } else {
                setTotalLeads('N/A');
            }
        };

        fetchTotalLeads();
    }, []);

    return (
        <MetricCard value={totalLeads} label={label} />
    );
};

export default TotalLeadsGeneratedMetric;