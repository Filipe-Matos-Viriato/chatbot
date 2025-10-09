// packages/frontend/src/dashboard/overview-tab/VisitorsWithEventsTable.jsx
// Description: Displays a paginated, sortable table of all visitors with their events for the selected client.
// Why this file exists: To provide a comprehensive view of visitor interactions across the entire client account.
// Relevant files: packages/frontend/src/dashboard/overview-tab/OverviewTab.jsx, packages/backend/src/index.js

import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../config/apiClient';
import { useClient } from '../../context/ClientContext';

const VisitorsWithEventsTable = () => {
    const { selectedClientId } = useClient();
    const [visitors, setVisitors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState('desc');

    // Simple table implementation - no virtual scrolling needed for 10 items per page

    // PHASE 2: Smart caching implementation
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    const getCacheKey = (clientId, page, sortBy, sortOrder) =>
        `visitors_table_${clientId}_${page}_${sortBy}_${sortOrder}`;

    // PHASE 3: Advanced caching concept (would require backend Redis implementation)
    // const getRedisCacheKey = (clientId, page, sortBy, sortOrder) =>
    //     `visitors:cache:${clientId}:${page}:${sortBy}:${sortOrder}`;
    //
    // const fetchWithRedisCache = async (clientId, page, sortBy, sortOrder) => {
    //     const redisKey = getRedisCacheKey(clientId, page, sortBy, sortOrder);
    //
    //     // Try Redis cache first (sub-millisecond)
    //     const cached = await redis.get(redisKey);
    //     if (cached) {
    //         console.log('[VisitorsWithEventsTable] Redis cache hit');
    //         return JSON.parse(cached);
    //     }
    //
    //     // Fallback to database query
    //     const data = await queryDatabase(clientId, page, sortBy, sortOrder);
    //
    //     // Cache in Redis for 5 minutes
    //     await redis.setex(redisKey, 300, JSON.stringify(data));
    //
    //     return data;
    // };

    // PHASE 3: Background pre-loading for other clients
    const PRELOAD_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for preloaded data

    const preloadClientData = async (clientId) => {
        if (!clientId || clientId === selectedClientId) return;

        const preloadKey = `preload_${clientId}`;
        const lastPreload = sessionStorage.getItem(`${preloadKey}_timestamp`);

        // Only preload if not done recently
        if (lastPreload && Date.now() - parseInt(lastPreload) < PRELOAD_CACHE_DURATION) {
            console.log(`[VisitorsWithEventsTable] Client ${clientId} already preloaded recently`);
            return;
        }

        console.log(`[VisitorsWithEventsTable] Background preloading client: ${clientId}`);

        // Preload in background without blocking UI
        setTimeout(async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/dashboard/visitors-with-events/${clientId}?page=1&limit=10&sortBy=updated_at&sortOrder=desc`
                );

                if (response.ok) {
                    const data = await response.json();
                    const cacheKey = getCacheKey(clientId, 1, 'updated_at', 'desc');
                    setCachedData(cacheKey, data);

                    // Mark as preloaded
                    sessionStorage.setItem(`${preloadKey}_timestamp`, Date.now().toString());
                    console.log(`[VisitorsWithEventsTable] Successfully preloaded client: ${clientId}`);
                }
            } catch (error) {
                console.warn(`[VisitorsWithEventsTable] Background preload failed for ${clientId}:`, error);
            }
        }, 2000); // Delay to not interfere with current operations
    };

    const getCachedData = (cacheKey) => {
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    console.log('[VisitorsWithEventsTable] Using cached data for:', cacheKey);
                    return data;
                } else {
                    localStorage.removeItem(cacheKey); // Remove expired cache
                }
            }
        } catch (error) {
            console.warn('[VisitorsWithEventsTable] Cache read error:', error);
        }
        return null;
    };

    const setCachedData = (cacheKey, data) => {
        try {
            const cacheData = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log('[VisitorsWithEventsTable] Cached data for:', cacheKey);
        } catch (error) {
            console.warn('[VisitorsWithEventsTable] Cache write error:', error);
        }
    };

    const fetchVisitors = async (page = 1, sortByParam = sortBy, sortOrderParam = sortOrder) => {
        if (!selectedClientId) {
            console.log('[VisitorsWithEventsTable] No selectedClientId, skipping fetch');
            return;
        }

        const fetchStart = performance.now();
        console.log(`[TIMING] VisitorsWithEventsTable fetch started for client: ${selectedClientId}, page: ${page}`);

        const cacheKey = getCacheKey(selectedClientId, page, sortByParam, sortOrderParam);

        // PHASE 2: Check cache first
        const cacheCheckStart = performance.now();
        const cachedData = getCachedData(cacheKey);
        const cacheCheckEnd = performance.now();
        console.log(`[TIMING] Cache check completed in ${cacheCheckEnd - cacheCheckStart}ms`);

        if (cachedData) {
            console.log(`[VisitorsWithEventsTable] Using cached data for client: ${selectedClientId}, page: ${page}`);
            setVisitors(cachedData.visitors || []);
            setPagination(cachedData.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
            setLoading(false);
            const fetchEnd = performance.now();
            console.log(`[TIMING] VisitorsWithEventsTable fetch completed (cached) in ${fetchEnd - fetchStart}ms`);
            return;
        }

        console.log(`[VisitorsWithEventsTable] Fetching fresh data for client: ${selectedClientId}, page: ${page}, sort: ${sortByParam} ${sortOrderParam}`);
        setLoading(true);
        setError(null);

        try {
            const apiCallStart = performance.now();
            const response = await fetch(
                `${API_BASE_URL}/api/dashboard/visitors-with-events/${selectedClientId}?page=${page}&limit=${pagination.limit}&sortBy=${sortByParam}&sortOrder=${sortOrderParam}`
            );
            const apiCallEnd = performance.now();
            console.log(`[TIMING] API call completed in ${apiCallEnd - apiCallStart}ms`);

            if (!response.ok) {
                throw new Error(`Failed to fetch visitors: ${response.status}`);
            }

            const parseStart = performance.now();
            const data = await response.json();
            const parseEnd = performance.now();
            console.log(`[TIMING] JSON parsing completed in ${parseEnd - parseStart}ms`);
            console.log(`[VisitorsWithEventsTable] Fetched ${data.visitors?.length || 0} visitors for client ${selectedClientId}`);

            // Cache the response
            const cacheStart = performance.now();
            setCachedData(cacheKey, data);
            const cacheEnd = performance.now();
            console.log(`[TIMING] Caching completed in ${cacheEnd - cacheStart}ms`);

            setVisitors(data.visitors || []);
            setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });

            const fetchEnd = performance.now();
            console.log(`[TIMING] VisitorsWithEventsTable fetch completed (fresh) in ${fetchEnd - fetchStart}ms`);
        } catch (err) {
            console.error('Error fetching visitors with events:', err);
            setError(err.message);
            setVisitors([]);
            const fetchEnd = performance.now();
            console.log(`[TIMING] VisitorsWithEventsTable fetch failed after ${fetchEnd - fetchStart}ms`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('[VisitorsWithEventsTable] Client changed to:', selectedClientId);
        // Reset state when client changes
        setVisitors([]);
        setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
        setSortBy('updated_at');
        setSortOrder('desc');
        setError(null);
        // Fetch data for new client
        if (selectedClientId) {
            fetchVisitors();
        }
    }, [selectedClientId]);

    // PHASE 3: Background pre-loading effect
    useEffect(() => {
        if (!selectedClientId) return;

        // Get all available clients from context (assuming it's available)
        // For now, we'll preload a few common client IDs
        // In a real implementation, you'd get this from your client context
        const commonClientIds = [
            'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', // Current client
            'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c',  // Another client
            // Add more client IDs as needed
        ];

        // Preload other clients in background
        commonClientIds.forEach(clientId => {
            if (clientId !== selectedClientId) {
                preloadClientData(clientId);
            }
        });
    }, [selectedClientId]);

    const handleSort = (column) => {
        const newSortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
        setSortBy(column);
        setSortOrder(newSortOrder);
        fetchVisitors(pagination.page, column, newSortOrder);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchVisitors(newPage, sortBy, sortOrder);
        }
    };

    const getSortIcon = (column) => {
        if (sortBy === column) {
            return sortOrder === 'asc' ? ' ↑' : ' ↓';
        }
        return ' ⇅';
    };

    const formatEventType = (eventType) => {
        return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getLeadScoreColor = (score) => {
        if (score >= 70) return 'text-red-600'; // Hot
        if (score >= 40) return 'text-yellow-600'; // Warm
        return 'text-blue-600'; // Cold
    };

    // PHASE 2: Skeleton loading states
    if (loading && visitors.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Visitors with Events</h3>
                <div className="space-y-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="flex space-x-4">
                                <div className="flex-1">
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                </div>
                                <div className="w-20">
                                    <div className="h-4 bg-gray-200 rounded"></div>
                                </div>
                                <div className="w-24">
                                    <div className="h-4 bg-gray-200 rounded"></div>
                                </div>
                                <div className="w-24">
                                    <div className="h-4 bg-gray-200 rounded"></div>
                                </div>
                                <div className="flex-1">
                                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-1"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Visitors with Events</h3>
                <div className="text-center py-8 text-red-600">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Visitors with Events ({pagination.total} total)
            </h3>

            {visitors.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                    No visitors with events found for this client.
                </div>
            ) : (
                <>
                    {/* Simple table implementation */}
                    <div className="overflow-x-auto border border-gray-200 rounded-md">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Visitor ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                        onClick={() => handleSort('lead_score')}
                                    >
                                        Lead Score {getSortIcon('lead_score')}
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                        onClick={() => handleSort('created_at')}
                                    >
                                        Created {getSortIcon('created_at')}
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                        onClick={() => handleSort('updated_at')}
                                    >
                                        Last Updated {getSortIcon('updated_at')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Recent Events
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {visitors.map((visitor) => (
                                    <tr key={visitor.visitor_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {visitor.visitor_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {visitor.name || 'N/A'}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${getLeadScoreColor(visitor.lead_score)}`}>
                                            {visitor.lead_score}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(visitor.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(visitor.updated_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {visitor.events && visitor.events.length > 0 ? (
                                                <div className="space-y-1">
                                                    {visitor.events.slice(0, 2).map((event, eventIndex) => (
                                                        <div key={eventIndex} className="text-xs">
                                                            <span className="font-medium">{formatEventType(event.event_type)}</span>
                                                            <span className="text-gray-400 ml-2">
                                                                {new Date(event.timestamp).toLocaleDateString()}
                                                            </span>
                                                            {event.score_impact && (
                                                                <span className={`ml-2 px-1 py-0.5 rounded text-xs ${event.score_impact > 0 ? 'bg-green-100 text-green-800' : event.score_impact < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                                    {event.score_impact > 0 ? '+' : ''}{event.score_impact}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {visitor.events.length > 2 && (
                                                        <div className="text-xs text-gray-400">
                                                            +{visitor.events.length - 2} more events
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">No events</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center mt-4">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page === 1 || loading}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">
                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total visitors)
                        </span>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages || loading}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default VisitorsWithEventsTable;