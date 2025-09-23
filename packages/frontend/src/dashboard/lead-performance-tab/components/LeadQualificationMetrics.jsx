import React, { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';
import { useClient } from '../../../context/ClientContext';
import { API_BASE_URL } from '../../../config/apiClient';

const LeadQualificationMetrics = ({ qualifiedLeads, hotLeads, avgTimeToQualify = "Loading...", onOpenCustomCriteriaPopup, customCriteria }) => {
  const { selectedClientId } = useClient();
  const [realAvgTimeToQualify, setRealAvgTimeToQualify] = useState(avgTimeToQualify);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQualificationMetrics = async () => {
      if (!selectedClientId) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/metrics/client-qualification?clientId=${selectedClientId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch qualification metrics');
        }

        const data = await response.json();

        if (data.avgQualificationTimeHours !== undefined && data.avgQualificationTimeHours !== null) {
          // Convert hours to a readable format
          const hours = data.avgQualificationTimeHours;
          if (hours < 1) {
            setRealAvgTimeToQualify(`${Math.round(hours * 60)} min`);
          } else if (hours < 24) {
            setRealAvgTimeToQualify(`${hours.toFixed(1)} hrs`);
          } else {
            setRealAvgTimeToQualify(`${(hours / 24).toFixed(1)} days`);
          }
        } else {
          setRealAvgTimeToQualify('No data yet');
        }
      } catch (error) {
        console.error('Error fetching qualification metrics:', error);
        setRealAvgTimeToQualify('Error loading');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQualificationMetrics();
  }, [selectedClientId]);

  const displayAvgTime = isLoading ? 'Loading...' : realAvgTimeToQualify;
    const formatCriteria = (criteria) => {
        const parts = [];
        if (criteria.minimalLeadScore !== 40) {
            parts.push(`Minimal Lead Score: ${criteria.minimalLeadScore}`);
        }
        if (criteria.selectedConversionActions.length > 0) {
            parts.push(`Conversion Actions: ${criteria.selectedConversionActions.join(', ')}`);
        }
        return parts.length > 0 ? parts.join(' AND ') : 'No custom criteria set';
    };

    return (
        <div className="card-standard">
            <h3 className="text-lg font-semibold text-gray-800">Lead Qualification Metrics</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                    <p className="text-3xl font-bold text-purple-600">{qualifiedLeads}</p>
                    <p className="text-sm text-gray-500">Qualified Leads (Custom Criteria)</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-blue-600">{hotLeads}</p>
                    <p className="text-sm text-gray-500">"Hot" Leads (70+ Pts)</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-blue-600">{displayAvgTime}</p>
                    <p className="text-sm text-gray-500">Avg. Time to Qualify</p>
                </div>
            </div>
            <div className="mt-6 border-t border-gray-200 pt-6">
                <p className="text-sm font-medium text-gray-700">Define Custom Qualification Criteria:</p>
                <p className="text-sm text-purple-600 mt-1">Currently: {formatCriteria(customCriteria)}</p>
                <button
                    onClick={onOpenCustomCriteriaPopup}
                    className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow hover:bg-gray-300 transition-colors"
                >
                    Manage Criteria
                </button>
            </div>
        </div>
    );
};

export default LeadQualificationMetrics;