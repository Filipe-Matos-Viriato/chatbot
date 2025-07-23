import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';
import MetricCard from '../MetricCard';

const TotalConversionsMetric = () => {
    const [totalConversions, setTotalConversions] = useState(0);

    useEffect(() => {
        const fetchTotalConversions = async () => {
            const { data, error } = await supabase
                .from('listing_metrics')
                .select('total_conversions');

            if (error) {
                console.error('Error fetching total conversions:', error);
            } else {
                const sumTotalConversions = data.reduce((sum, metric) => sum + metric.total_conversions, 0);
                setTotalConversions(sumTotalConversions);
            }
        };

        fetchTotalConversions();
    }, []);

    return (
        <MetricCard
            title="Total Conversions"
            value={totalConversions}
            description="Sum of all conversion actions across all listings."
        />
    );
};

export default TotalConversionsMetric;