// packages/frontend/src/dashboard/portuguese-fine-tuning-tab/components/TerminologyAnalytics.jsx
// Component for displaying Portuguese terminology usage analytics.
// To show administrators how terminology mappings are performing in production.
// Relevant files: PortugueseFineTuningTab.jsx, supabaseClient.js

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';

const TerminologyAnalytics = ({ clientId }) => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('7d');

    useEffect(() => {
        loadAnalytics();
    }, [clientId, timeRange]);

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);

            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();
            switch (timeRange) {
                case '1d':
                    startDate.setDate(endDate.getDate() - 1);
                    break;
                case '7d':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                default:
                    startDate.setDate(endDate.getDate() - 7);
            }

            // Load terminology analytics
            const { data: analyticsData, error: analyticsError } = await supabase
                .from('terminology_analytics')
                .select('*')
                .eq('client_id', clientId)
                .gte('timestamp', startDate.toISOString())
                .lte('timestamp', endDate.toISOString())
                .order('timestamp', { ascending: false });

            if (analyticsError) throw analyticsError;

            // Load terminology effectiveness data
            const { data: effectivenessData, error: effectivenessError } = await supabase
                .from('terminology_effectiveness')
                .select('*')
                .eq('client_id', clientId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            if (effectivenessError) throw effectivenessError;

            // Process analytics data
            const processedAnalytics = processAnalyticsData(analyticsData || [], effectivenessData || []);
            setAnalytics(processedAnalytics);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const processAnalyticsData = (analyticsData, effectivenessData) => {
        // Group replacements by term
        const termStats = {};
        analyticsData.forEach(item => {
            const key = `${item.original_term}->${item.replaced_term}`;
            if (!termStats[key]) {
                termStats[key] = {
                    originalTerm: item.original_term,
                    replacedTerm: item.replaced_term,
                    count: 0,
                    contexts: new Set()
                };
            }
            termStats[key].count++;
            if (item.context) termStats[key].contexts.add(item.context);
        });

        // Calculate effectiveness metrics
        const effectivenessStats = {
            totalResponses: effectivenessData.length,
            averageProcessingTime: effectivenessData.length > 0
                ? effectivenessData.reduce((sum, item) => sum + item.processing_time_ms, 0) / effectivenessData.length
                : 0,
            averageTermsCorrected: effectivenessData.length > 0
                ? effectivenessData.reduce((sum, item) => sum + item.terms_corrected, 0) / effectivenessData.length
                : 0,
            promptStrategies: {}
        };

        // Group by prompt strategy
        effectivenessData.forEach(item => {
            const strategy = item.prompt_strategy || 'unknown';
            if (!effectivenessStats.promptStrategies[strategy]) {
                effectivenessStats.promptStrategies[strategy] = {
                    count: 0,
                    totalProcessingTime: 0,
                    totalTermsCorrected: 0
                };
            }
            effectivenessStats.promptStrategies[strategy].count++;
            effectivenessStats.promptStrategies[strategy].totalProcessingTime += item.processing_time_ms;
            effectivenessStats.promptStrategies[strategy].totalTermsCorrected += item.terms_corrected;
        });

        return {
            termStats: Object.values(termStats).sort((a, b) => b.count - a.count),
            effectivenessStats,
            totalReplacements: analyticsData.length,
            dateRange: timeRange
        };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error loading analytics</h3>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                        <button
                            onClick={loadAnalytics}
                            className="mt-2 text-sm text-red-600 hover:text-red-500"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Time Range Selector */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-medium text-gray-900">Terminology Analytics</h2>
                    <p className="text-sm text-gray-600">Monitor how your terminology mappings perform in production</p>
                </div>
                <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-700">Time Range:</label>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="1d">Last 24 hours</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                    </select>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 border border-gray-200 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{analytics.totalReplacements}</div>
                    <div className="text-sm text-gray-600">Total Replacements</div>
                </div>
                <div className="bg-white p-4 border border-gray-200 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{analytics.termStats.length}</div>
                    <div className="text-sm text-gray-600">Unique Term Pairs</div>
                </div>
                <div className="bg-white p-4 border border-gray-200 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{analytics.effectivenessStats.averageProcessingTime.toFixed(1)}ms</div>
                    <div className="text-sm text-gray-600">Avg Processing Time</div>
                </div>
                <div className="bg-white p-4 border border-gray-200 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{analytics.effectivenessStats.averageTermsCorrected.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">Avg Terms Corrected</div>
                </div>
            </div>

            {/* Most Used Term Mappings */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Most Used Term Mappings</h3>
                {analytics.termStats.length > 0 ? (
                    <div className="space-y-3">
                        {analytics.termStats.slice(0, 10).map((stat, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">
                                            "{stat.originalTerm}" → "{stat.replacedTerm}"
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Contexts: {Array.from(stat.contexts).join(', ') || 'none'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-semibold text-gray-900">{stat.count}</div>
                                    <div className="text-xs text-gray-500">replacements</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <p>No terminology replacements recorded yet.</p>
                        <p className="text-sm">Term replacements will appear here once the system processes responses.</p>
                    </div>
                )}
            </div>

            {/* Effectiveness by Strategy */}
            {Object.keys(analytics.effectivenessStats.promptStrategies).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Effectiveness by Strategy</h3>
                    <div className="space-y-3">
                        {Object.entries(analytics.effectivenessStats.promptStrategies).map(([strategy, stats]) => (
                            <div key={strategy} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <div className="text-sm font-medium text-gray-900 capitalize">
                                        {strategy.replace('_', ' ')}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {stats.count} responses
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-900">
                                        {(stats.totalProcessingTime / stats.count).toFixed(1)}ms avg time
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {(stats.totalTermsCorrected / stats.count).toFixed(1)} terms corrected
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TerminologyAnalytics;