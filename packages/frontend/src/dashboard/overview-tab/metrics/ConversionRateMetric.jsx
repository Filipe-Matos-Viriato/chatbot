import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';
import MetricCard from '../MetricCard';

const ConversionRateMetric = () => {
    const [conversionRate, setConversionRate] = useState(0);

    useEffect(() => {
        const fetchConversionRate = async () => {
            const { data, error } = await supabase
                .from('listing_metrics')
                .select('total_conversions, engaged_users');

            if (error) {
                console.error('Error fetching conversion rate metrics:', error);
            } else {
                const totalConversions = data.reduce((sum, metric) => sum + metric.total_conversions, 0);
                const totalEngagedUsers = data.reduce((sum, metric) => sum + metric.engaged_users, 0);

                const calculatedConversionRate = totalEngagedUsers > 0
                    ? ((totalConversions / totalEngagedUsers) * 100).toFixed(2)
                    : 0;
                setConversionRate(calculatedConversionRate);
            }
        };

        fetchConversionRate();
    }, []);

    return (
        <MetricCard
            title="Conversion Rate"
            value={`${conversionRate}%`}
            description="Percentage of engaged users who performed a conversion action."
        />
    );
};

export default ConversionRateMetric;