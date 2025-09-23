import React, { useState, useMemo, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const IndividualLeadProgression = ({ visitors, clientConfig, onOpenChatHistory, activeFilter, onFilterChange, newHotFromUrl, customCriteria }) => {
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [isAnimating, setIsAnimating] = useState(false);
    const [isBadgeAnimating, setIsBadgeAnimating] = useState(false);
    const [newHotButtonState, setNewHotButtonState] = useState('inactive'); // 'inactive', 'animated', 'pale-red', 'active-red'

    // Calculate new hot leads count
    const newHotLeadsCount = useMemo(() => {
        if (!visitors) return 0;
        return visitors.filter(visitor => visitor.lead_score >= 70 && !visitor.is_acknowledged).length;
    }, [visitors]);

    // Control animation timing and button states
    useEffect(() => {
        if (activeFilter === 'new-hot') {
            if (newHotFromUrl) {
                // Came from overview - start animated, then become pale red
                setNewHotButtonState('animated');
                setIsAnimating(true);
                setIsBadgeAnimating(true);
                const timer = setTimeout(() => {
                    setIsAnimating(false);
                    setIsBadgeAnimating(false);
                    setNewHotButtonState('pale-red');
                }, 5000); // 5 seconds
                return () => clearTimeout(timer);
            } else {
                // Direct click - become active red
                setNewHotButtonState('active-red');
                setIsAnimating(false);
                setIsBadgeAnimating(false);
            }
        } else {
            // Other filter active - become inactive grey
            setNewHotButtonState('inactive');
            setIsAnimating(false);
            setIsBadgeAnimating(false);
        }
    }, [activeFilter, newHotFromUrl]);

    // Icon logic based on score evolution
    const getEvolutionIcon = (currentScore, previousScore, lastUpdate) => {
        // No icon for brand new visitors with 0 score
        if (currentScore === 0 && (!previousScore || previousScore === 0)) return null;

        const daysSinceUpdate = (new Date() - new Date(lastUpdate)) / (1000 * 60 * 60 * 24);
        const stagnationDays = clientConfig?.leadScoringRules?.iconStagnationDays || 3;

        if (currentScore > previousScore) {
            // Last change was positive
            if (daysSinceUpdate <= stagnationDays) {
                return <span className="text-green-500">↑</span>; // Green up arrow
            } else {
                return <span className="text-yellow-500">—</span>; // Yellow dash (stagnant positive)
            }
        } else if (currentScore < previousScore) {
            // Last change was negative (decay or negative event)
            return <span className="text-red-500">↓</span>; // Red down arrow
        } else {
            // Score unchanged
            return <span className="text-yellow-500">—</span>; // Yellow dash (stagnant neutral)
        }
    };

    const sortedVisitors = useMemo(() => {
        if (!visitors) return [];

        // First filter the visitors based on activeFilter
        let filteredVisitors = visitors;
        if (activeFilter && activeFilter !== 'all') {
            filteredVisitors = visitors.filter(visitor => {
                const score = visitor.lead_score;
                switch (activeFilter) {
                    case 'hot':
                        return score >= 70;
                    case 'new-hot':
                        return score >= 70 && !visitor.is_acknowledged;
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
        }

        // Then sort the filtered visitors
        let sortableVisitors = [...filteredVisitors];

        if (sortColumn) {
            sortableVisitors.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];

                // Handle date sorting for updated_at
                if (sortColumn === 'updated_at') {
                    valA = new Date(valA).getTime();
                    valB = new Date(valB).getTime();
                }

                if (valA < valB) {
                    return sortDirection === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortDirection === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableVisitors;
    }, [visitors, sortColumn, sortDirection, activeFilter, customCriteria]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortIndicator = (column) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? ' ↑' : ' ↓';
        }
        return ' ⇅';
    };

    // Helper function to reconstruct score history from events
    const reconstructScoreHistory = (visitor) => {
        if (!visitor.events || visitor.events.length === 0) {
            return null;
        }

        let currentScore = 0;
        const scoreHistory = [];

        // Add initial point at visitor creation (score = 0)
        scoreHistory.push({
            timestamp: visitor.created_at,
            score: 0
        });

        // Sort events by timestamp to ensure chronological order
        const sortedEvents = [...visitor.events].sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        console.log(`🔍 Visitor ${visitor.visitor_id}: Processing ${sortedEvents.length} events`);

        // Add score changes from events
        for (const event of sortedEvents) {
            const impact = event.score_impact || 0;
            currentScore += impact;
            const finalScore = Math.max(0, currentScore);

            console.log(`   📊 Event: ${event.event_type}, impact: ${impact}, cumulative score: ${finalScore}`);

            scoreHistory.push({
                timestamp: event.timestamp,
                score: finalScore
            });
        }

        console.log(`   🎯 Final score history:`, scoreHistory.map(p => p.score));

        return scoreHistory;
    };

    // Helper function to create sparkline data with segment-by-segment coloring
    const createSparklineData = (visitor) => {
        const scoreHistory = reconstructScoreHistory(visitor);

        if (!scoreHistory || scoreHistory.length < 2) {
            return null; // Not enough data for a meaningful sparkline
        }

        const scores = scoreHistory.map(point => point.score);
        const labels = scoreHistory.map((point, index) => index + 1); // Simple index labels

        // Create a single continuous line with segment-based coloring
        const segmentColors = [];
        for (let i = 0; i < scores.length - 1; i++) {
            const isIncreasing = scores[i + 1] > scores[i];
            const color = isIncreasing ? '#10B981' : '#EF4444'; // Green for increase, red for decrease
            segmentColors.push(color);
        }

        // Use Chart.js segment coloring feature
        const datasets = [{
            data: scores,
            borderColor: '#10B981', // Default color
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0, // Hide points
            pointHoverRadius: 0,
            tension: 0.4, // Smooth curve
            fill: false,
            segment: {
                borderColor: (ctx) => {
                    const segmentIndex = ctx.p0DataIndex;
                    return segmentColors[segmentIndex] || '#10B981';
                }
            }
        }];


        return {
            labels,
            datasets
        };
    };

    // Sparkline options for minimal appearance
    const sparklineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: false // Disable tooltips for cleaner look
            },
            datalabels: {
                display: false // Disable data labels that might show numbers
            }
        },
        scales: {
            x: {
                display: false,
                grid: {
                    display: false
                }
            },
            y: {
                display: false,
                grid: {
                    display: false
                }
            }
        },
        elements: {
            point: {
                radius: 0,
                hoverRadius: 0
            }
        },
        layout: {
            padding: 0
        },
        interaction: {
            intersect: false,
            mode: 'nearest'
        },
        hover: {
            mode: null // Disable all hover interactions
        }
    };
    const filters = [
        { key: 'all', label: 'All Leads' },
        { key: 'hot', label: 'Hot Leads' },
        { key: 'new-hot', label: 'New Hot Leads' },
        { key: 'warm', label: 'Warm Leads' },
        { key: 'cold', label: 'Cold Leads' },
        { key: 'custom-qualified', label: 'Custom Qualified Leads' }
    ];

    return (
        <div className="card-standard">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Individual Lead Progression</h3>

            {/* Filter Buttons */}
            <div className="flex space-x-4 mb-6">
                {filters.map((filter) => (
                    <div key={filter.key} className="relative">
                        <button
                            onClick={() => onFilterChange && onFilterChange(filter.key)}
                            className={`px-6 py-2 rounded-lg shadow transition-all duration-300 ${
                                activeFilter === filter.key
                                    ? filter.key === 'hot'
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : filter.key === 'warm'
                                            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                            : filter.key === 'new-hot'
                                                ? newHotButtonState === 'animated'
                                                    ? 'bg-red-600 text-white hover:bg-red-700 transform scale-110 animate-pulse'
                                                    : newHotButtonState === 'pale-red'
                                                        ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                                        : 'bg-red-600 text-white hover:bg-red-700'
                                                : filter.key === 'custom-qualified'
                                                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                    : filter.key === 'new-hot'
                                        ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                        : filter.key === 'custom-qualified'
                                            ? 'bg-gray-200 text-purple-600 hover:bg-gray-300'
                                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                        >
                            {filter.label}
                        </button>
                        {filter.key === 'new-hot' && newHotLeadsCount > 0 && (
                            <span className={`absolute -top-3 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ${isBadgeAnimating ? 'animate-bounce' : ''}`}>
                                {newHotLeadsCount}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('visitor_id')}>
                                Lead ID {getSortIndicator('visitor_id')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('lead_score')}>
                                Current Score {getSortIndicator('lead_score')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('updated_at')}>
                                Last Activity {getSortIndicator('updated_at')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Score Trend
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedVisitors.map((visitor) => (
                            <tr
                                key={visitor.visitor_id}
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => onOpenChatHistory && onOpenChatHistory(visitor.visitor_id)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {visitor.name || visitor.visitor_id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {visitor.lead_score} {getEvolutionIcon(visitor.lead_score, visitor.previous_lead_score, visitor.updated_at)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {visitor.events && visitor.events.length > 0 ? visitor.events[visitor.events.length - 1].event_type : 'N/A'} ({(new Date() - new Date(visitor.updated_at)) / (1000 * 60 * 60 * 24) < 1 ? `${Math.round((new Date() - new Date(visitor.updated_at)) / (1000 * 60 * 60))}h ago` : `${Math.round((new Date() - new Date(visitor.updated_at)) / (1000 * 60 * 60 * 24))}d ago`})
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {visitor.events && visitor.events.length >= 1 ? (
                                        <div style={{ width: '60px', height: '20px' }}>
                                            <Line
                                                data={createSparklineData(visitor)}
                                                options={sparklineOptions}
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-gray-300 text-xs">No data</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center align-middle">
                                    <span className="material-symbols-sharp text-gray-500 relative top-[5px]">forum</span> {/* Chat Info icon */}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IndividualLeadProgression;