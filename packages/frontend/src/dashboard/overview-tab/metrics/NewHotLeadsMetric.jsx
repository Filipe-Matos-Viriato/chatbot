import React, { useState, useEffect } from 'react';
import MetricCard from '../MetricCard';
import { supabase } from '../../../config/supabaseClient';

const NewHotLeadsMetric = ({ newHotLeadsCount }) => {
    const label = 'New Hot Leads (70+ Pts)';

    return (
        <MetricCard value={newHotLeadsCount} label={label} />
    );
};

export default NewHotLeadsMetric;