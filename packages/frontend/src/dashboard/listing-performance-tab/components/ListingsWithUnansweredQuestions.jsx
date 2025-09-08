import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../../config/apiClient';
import { useClient } from '../../../context/ClientContext';
import { useNavigate } from 'react-router-dom';

const ListingsWithUnansweredQuestions = () => {
    const [unansweredSummary, setUnansweredSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { selectedClientId } = useClient();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUnansweredSummary = async () => {
            if (!selectedClientId) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/unanswered-questions-summary?clientId=${selectedClientId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setUnansweredSummary(data.summary);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUnansweredSummary();
    }, [selectedClientId]);

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800">Listings with Unanswered Questions</h3>
                <p className="text-sm text-gray-500 mt-1">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800">Listings with Unanswered Questions</h3>
                <p className="text-sm text-red-500 mt-1">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800">Listings with Unanswered Questions</h3>
            <p className="text-sm text-gray-500 mt-1">Table: Listings with top unanswered questions, allowing direct content updates.</p>
            <div className="mt-4 overflow-x-auto">
                {unansweredSummary.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Listing Name
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Unanswered Questions
                                </th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">View</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {unansweredSummary.map((item) => (
                                <tr key={item.listing_id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {item.listing_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.unanswered_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => navigate(`/dashboard/unanswered-questions?listingId=${item.listing_id}`)}
                                            className="text-blue-600 hover:text-blue-900 hover:cursor-pointer"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        No listings with unanswered questions found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ListingsWithUnansweredQuestions;