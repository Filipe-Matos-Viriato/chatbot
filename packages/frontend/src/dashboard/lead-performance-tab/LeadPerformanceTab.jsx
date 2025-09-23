import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import LeadTypeFilters from './components/LeadTypeFilters';
import LeadScoreDistribution from './components/LeadScoreDistribution';
import ConversionRateThreshold from './components/ConversionRateThreshold';
import LeadQualificationMetrics from './components/LeadQualificationMetrics';
import IndividualLeadProgression from './components/IndividualLeadProgression';
import CustomCriteriaPopup from './components/CustomCriteriaPopup';

const LeadPerformanceTab = ({ visitors, listings, listingMetrics, clientConfig, onOpenChatHistory, customCriteria, setCustomCriteria }) => {
    const [searchParams] = useSearchParams();
    const [activeFilter, setActiveFilter] = useState('all');
    const [newHotFromUrl, setNewHotFromUrl] = useState(false);
    const [isCustomCriteriaPopupOpen, setIsCustomCriteriaPopupOpen] = useState(false);
    const individualLeadRef = useRef(null);

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