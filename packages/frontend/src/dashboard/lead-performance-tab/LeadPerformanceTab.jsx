import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import { useClient } from '../../context/ClientContext';
import LeadTypeFilters from './components/LeadTypeFilters';
import LeadScoreDistribution from './components/LeadScoreDistribution';
import ConversionRateThreshold from './components/ConversionRateThreshold';
import LeadQualificationMetrics from './components/LeadQualificationMetrics';
import IndividualLeadProgression from './components/IndividualLeadProgression';
import CustomCriteriaPopup from './components/CustomCriteriaPopup';

const LeadPerformanceTab = ({ clientId, onOpenChatHistory }) => {
    const [listings, setListings] = useState([]);
    const [listingMetrics, setListingMetrics] = useState([]);
    const [clientConfig, setClientConfig] = useState(null);
    const [customCriteria, setCustomCriteria] = useState(() => {
        const saved = localStorage.getItem('customLeadCriteria');
        return saved ? JSON.parse(saved) : {
            minimalLeadScore: 40,
            selectedConversionActions: []
        };
    });
    const [dataFreshness, setDataFreshness] = useState('stale');
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const [searchParams] = useSearchParams();
    const [activeFilter, setActiveFilter] = useState('all');
    const [newHotFromUrl, setNewHotFromUrl] = useState(false);
    const [isCustomCriteriaPopupOpen, setIsCustomCriteriaPopupOpen] = useState(false);
    const [visitors, setVisitors] = useState([]);
    const [visitorsLoading, setVisitorsLoading] = useState(true);
    const [visitorsError, setVisitorsError] = useState(null);
    const individualLeadRef = useRef(null);

    // Data refresh functions
    const refreshVisitorsData = async () => {
        if (!clientId) return;
        try {
            const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:3007' : `${window.location.origin}/api`;
            const response = await fetch(`${apiBaseUrl}/api/dashboard/visitors-with-events/${clientId}?page=1&limit=1000&sortBy=lead_score&sortOrder=desc`);

            if (response.ok) {
                const data = await response.json();
                setVisitors(data.visitors || []);
                setLastUpdate(Date.now());
                setDataFreshness('fresh');
            }
        } catch (error) {
            console.error('[LeadPerformanceTab] Error refreshing visitors:', error);
        }
    };

    const updateMetricsFromEvent = async (eventData) => {
        // For now, trigger a full refresh when events change
        // In production, this could be optimized to update metrics incrementally
        setDataFreshness('needs-refresh');
        setTimeout(() => refreshCriticalData(), 1000); // Debounce updates
    };

    const refreshCriticalData = async () => {
        if (!clientId) return;
        console.log('[LeadPerformanceTab] Refreshing critical data');
        await refreshVisitorsData();
    };

    // Fetch data for this component
    useEffect(() => {
        const fetchData = async () => {
            if (!clientId) return;

            console.log('[LeadPerformanceTab] Fetching data for client:', clientId);
            setDataFreshness('loading');

            try {
                // Fetch listings and metrics in parallel
                const [listingsResult, metricsResult, configResult] = await Promise.all([
                    supabase.from('listings').select('*').eq('client_id', clientId),
                    supabase.from('listing_metrics').select('*').eq('client_id', clientId),
                    supabase.from('clients').select('lead_scoring_rules').eq('client_id', clientId).single()
                ]);

                if (listingsResult.error) console.error('Listings fetch error:', listingsResult.error);
                else setListings(listingsResult.data || []);

                if (metricsResult.error) console.error('Metrics fetch error:', metricsResult.error);
                else setListingMetrics(metricsResult.data || []);

                if (configResult.error) console.error('Config fetch error:', configResult.error);
                else setClientConfig(configResult.data?.lead_scoring_rules || null);

                setDataFreshness('fresh');
                setLastUpdate(Date.now());

            } catch (error) {
                console.error('[LeadPerformanceTab] Data fetch error:', error);
                setDataFreshness('error');
            }
        };

        fetchData();
    }, [clientId]);

    // Real-time subscriptions for data freshness
    useEffect(() => {
        if (!clientId) return;

        console.log('[LeadPerformanceTab] Setting up real-time subscriptions for client:', clientId);

        // Subscribe to visitors table changes
        const visitorsSubscription = supabase
            .channel(`visitors_${clientId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'visitors',
                filter: `client_id=eq.${clientId}`
            }, (payload) => {
                console.log('[LeadPerformanceTab] Visitors table changed:', payload.eventType);
                setDataFreshness('updating');
                // Trigger selective refresh for visitors data
                refreshVisitorsData();
            })
            .subscribe();

        // Subscribe to events table changes
        const eventsSubscription = supabase
            .channel(`events_${clientId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'events',
                filter: `client_id=eq.${clientId}`
            }, (payload) => {
                console.log('[LeadPerformanceTab] New event logged:', payload.new.event_type);
                setDataFreshness('updating');
                // Update metrics without full refresh
                updateMetricsFromEvent(payload.new);
            })
            .subscribe();

        // Fallback polling if real-time fails
        const pollInterval = setInterval(() => {
            const timeSinceUpdate = Date.now() - lastUpdate;
            if (timeSinceUpdate > 60000 && dataFreshness === 'fresh') { // Poll every minute if no real-time updates
                console.log('[LeadPerformanceTab] Fallback polling for data freshness');
                refreshCriticalData();
            }
        }, 30000); // Check every 30 seconds

        return () => {
            visitorsSubscription.unsubscribe();
            eventsSubscription.unsubscribe();
            clearInterval(pollInterval);
        };
    }, [clientId, lastUpdate, dataFreshness]);

    // Set initial filter from URL params
    useEffect(() => {
        const filterParam = searchParams.get('filter');
        if (filterParam && ['all', 'hot', 'warm', 'cold', 'new-hot', 'custom-qualified'].includes(filterParam)) {
            setActiveFilter(filterParam);
            // Track if new-hot came from URL
            setNewHotFromUrl(filterParam === 'new-hot');
        } else {
            setNewHotFromUrl(false);
        }
    }, [searchParams]);

    // Scroll to Individual Lead Progression table only when coming from overview tab (newHotFromUrl is true)
    useEffect(() => {
        if (activeFilter === 'new-hot' && newHotFromUrl && individualLeadRef.current) {
            setTimeout(() => {
                individualLeadRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 100); // Small delay to ensure component is rendered
        }
    }, [activeFilter, newHotFromUrl]);

    // Fetch visitors on component mount
    useEffect(() => {
        const fetchVisitors = async () => {
            if (!clientId) return;

            try {
                setVisitorsLoading(true);
                setVisitorsError(null);

                console.log('[LeadPerformanceTab] Fetching visitors for client:', clientId);

                // Use the correct API base URL for backend calls
                const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:3007' : `${window.location.origin}/api`;
                const response = await fetch(`${apiBaseUrl}/api/dashboard/visitors-with-events/${clientId}?page=1&limit=1000&sortBy=lead_score&sortOrder=desc`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch visitors: ${response.status}`);
                }

                const data = await response.json();
                console.log(`[LeadPerformanceTab] Fetched ${data.visitors?.length || 0} visitors`);

                setVisitors(data.visitors || []);
            } catch (error) {
                console.error('[LeadPerformanceTab] Error fetching visitors:', error);
                setVisitorsError(error.message);
                setVisitors([]);
            } finally {
                setVisitorsLoading(false);
            }
        };

        fetchVisitors();
    }, [clientId]);

    // Filter visitors based on active filter
    const filteredVisitors = useMemo(() => {
        if (activeFilter === 'all') return visitors;

        return visitors.filter(visitor => {
            const score = visitor.lead_score;
            switch (activeFilter) {
                case 'hot':
                    return score >= 70;
                case 'warm':
                    return score >= 40 && score < 70;
                case 'cold':
                    return score < 40;
                case 'custom-qualified':
                    // Check minimal lead score
                    if (score < customCriteria.minimalLeadScore) return false;

                    // Check if visitor has at least one of the selected conversion actions
                    if (customCriteria.selectedConversionActions.length > 0) {
                        const visitorEventTypes = visitor.events?.map(event => event.event_type) || [];
                        return customCriteria.selectedConversionActions.some(action =>
                            visitorEventTypes.includes(action)
                        );
                    }

                    return true;
                default:
                    return true;
            }
        });
    }, [visitors, activeFilter, customCriteria]);

    // Calculate Qualified Leads based on custom criteria (persistent once set)
    const qualifiedLeads = useMemo(() => {
        // Check if custom criteria have been modified from defaults
        const hasCustomCriteria = customCriteria.minimalLeadScore !== 40 ||
                                 customCriteria.selectedConversionActions.length > 0;

        if (hasCustomCriteria) {
            return visitors.filter(visitor => {
                const score = visitor.lead_score;
                // Check minimal lead score
                if (score < customCriteria.minimalLeadScore) return false;

                // Check if visitor has at least one of the selected conversion actions
                if (customCriteria.selectedConversionActions.length > 0) {
                    const visitorEventTypes = visitor.events?.map(event => event.event_type) || [];
                    return customCriteria.selectedConversionActions.some(action =>
                        visitorEventTypes.includes(action)
                    );
                }

                return true;
            }).length;
        } else {
            // Default: score >= 40
            return visitors.filter(visitor => visitor.lead_score >= 40).length;
        }
    }, [visitors, customCriteria]);

    // Calculate Hot Leads (score >= 70)
    const hotLeads = visitors.filter(visitor => visitor.lead_score >= 70).length;

    // Avg. Time to Qualify is now calculated in real-time by the component

    const handleFilterChange = (filter) => {
        setActiveFilter(filter);
        // Reset the URL flag when user manually changes filter
        if (filter !== 'new-hot') {
            setNewHotFromUrl(false);
        }
    };

    const handleOpenCustomCriteriaPopup = () => {
        setIsCustomCriteriaPopupOpen(true);
    };

    const handleCloseCustomCriteriaPopup = () => {
        setIsCustomCriteriaPopupOpen(false);
    };

    const handleSaveCustomCriteria = (criteria) => {
        setCustomCriteria(criteria);
        setActiveFilter('custom-qualified');
        setNewHotFromUrl(false);
    };

    // Show loading state while fetching visitors
    if (visitorsLoading) {
        return (
            <div className="space-y-8 w-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800">Lead Performance Analysis</h2>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm px-2 py-1 rounded-full ${
                            dataFreshness === 'fresh' ? 'bg-green-100 text-green-800' :
                            dataFreshness === 'updating' ? 'bg-yellow-100 text-yellow-800' :
                            dataFreshness === 'loading' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                            {dataFreshness === 'fresh' ? '● Data Fresh' :
                             dataFreshness === 'updating' ? '● Updating...' :
                             dataFreshness === 'loading' ? '● Loading...' :
                             '● Needs Refresh'}
                        </span>
                        {dataFreshness !== 'fresh' && (
                            <button
                                onClick={refreshCriticalData}
                                className="text-sm text-blue-600 hover:text-blue-800 underline"
                            >
                                Refresh
                            </button>
                        )}
                    </div>
                </div>
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="mt-2 text-gray-600">Loading visitor data...</p>
                </div>
            </div>
        );
    }

    // Show error state if visitors failed to load
    if (visitorsError) {
        return (
            <div className="space-y-8 w-full">
                <h2 className="text-2xl font-bold text-gray-800">Lead Performance Analysis</h2>
                <div className="text-center py-8">
                    <div className="text-red-600">
                        <p className="font-semibold">Error loading visitor data</p>
                        <p className="text-sm mt-1">{visitorsError}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 w-full">
            <h2 className="text-2xl font-bold text-gray-800">Lead Performance Analysis</h2>

            {/* Metrics and Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <LeadScoreDistribution />
                <ConversionRateThreshold />
            </div>

            <LeadQualificationMetrics
                qualifiedLeads={qualifiedLeads}
                hotLeads={hotLeads}
                onOpenCustomCriteriaPopup={handleOpenCustomCriteriaPopup}
                customCriteria={customCriteria}
            />

            <div ref={individualLeadRef}>
                <IndividualLeadProgression
                    visitors={visitors}
                    clientConfig={clientConfig}
                    onOpenChatHistory={onOpenChatHistory}
                    activeFilter={activeFilter}
                    onFilterChange={handleFilterChange}
                    newHotFromUrl={newHotFromUrl}
                    customCriteria={customCriteria}
                />
            </div>

            <CustomCriteriaPopup
                isOpen={isCustomCriteriaPopupOpen}
                onClose={handleCloseCustomCriteriaPopup}
                onSave={handleSaveCustomCriteria}
                initialCriteria={customCriteria}
            />
        </div>
    );
};

export default LeadPerformanceTab;