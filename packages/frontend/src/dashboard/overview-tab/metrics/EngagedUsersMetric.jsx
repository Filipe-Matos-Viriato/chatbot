import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';
import MetricCard from '../MetricCard';

const EngagedUsersMetric = () => {
    const [engagedUsers, setEngagedUsers] = useState(0);

    useEffect(() => {
        const fetchEngagedUsers = async () => {
            const { data, error } = await supabase
                .from('listing_metrics')
                .select('engaged_users');

            if (error) {
                console.error('Error fetching engaged users:', error);
            } else {
                const totalEngagedUsers = data.reduce((sum, metric) => sum + metric.engaged_users, 0);
                setEngagedUsers(totalEngagedUsers);
            }
        };

        fetchEngagedUsers();
    }, []);

    return (
        <MetricCard
            title="Engaged Users"
            value={engagedUsers}
            description="Total unique users who interacted with the chatbot across all listings."
        />
    );
};

export default EngagedUsersMetric;