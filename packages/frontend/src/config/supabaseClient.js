import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getLeadDistributionMetrics() {
    const { data, error } = await supabase
        .from('listing_metrics')
        .select('lead_score_distribution_hot, lead_score_distribution_warm, lead_score_distribution_cold');

    if (error) {
        console.error('Error fetching lead distribution metrics:', error);
        return null;
    }

    if (data && data.length > 0) {
        // Assuming we want to sum up all distributions across all listings for a global view
        const totalHot = data.reduce((sum, item) => sum + item.lead_score_distribution_hot, 0);
        const totalWarm = data.reduce((sum, item) => sum + item.lead_score_distribution_warm, 0);
        const totalCold = data.reduce((sum, item) => sum + item.lead_score_distribution_cold, 0);

        const totalLeads = totalHot + totalWarm + totalCold;

        return {
            hot: (totalHot / totalLeads) * 100,
            warm: (totalWarm / totalLeads) * 100,
            cold: (totalCold / totalLeads) * 100,
            total: totalLeads,
        };
    }

    return { hot: 0, warm: 0, cold: 0, total: 0 };
}

export async function getListingLeadDistributionMetrics(listingId) {
    const { data, error } = await supabase
        .from('listing_metrics')
        .select('lead_score_distribution_hot, lead_score_distribution_warm, lead_score_distribution_cold')
        .eq('listing_id', listingId)
        .single(); // Use .single() as we expect one row per listing_id

    if (error) {
        console.error(`Error fetching lead distribution metrics for listing ${listingId}:`, error);
        return null;
    }

    if (data) {
        const totalHot = data.lead_score_distribution_hot || 0;
        const totalWarm = data.lead_score_distribution_warm || 0;
        const totalCold = data.lead_score_distribution_cold || 0;

        const totalLeads = totalHot + totalWarm + totalCold;

        if (totalLeads === 0) {
            return { hot: 0, warm: 0, cold: 0, total: 0 };
        }

        return {
            hot: (totalHot / totalLeads) * 100,
            warm: (totalWarm / totalLeads) * 100,
            cold: (totalCold / totalLeads) * 100,
            total: totalLeads,
        };
    }

    return { hot: 0, warm: 0, cold: 0, total: 0 };
}