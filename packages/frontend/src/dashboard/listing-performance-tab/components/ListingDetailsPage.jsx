import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../../../config/apiClient';
import { getListingLeadDistributionMetrics } from '../../../config/supabaseClient';
// import { useClient } from '../../../context/ClientContext'; // No longer needed as clientId comes from URL
import ListingMetricsCards from './listing-details/ListingMetricsCards';
import PropertyInformation from './listing-details/PropertyInformation';
import LeadScoreDistributionChart from './listing-details/LeadScoreDistributionChart';
import CommonQuestions from './listing-details/CommonQuestions';
import UnansweredQuestions from './listing-details/UnansweredQuestions'; // Re-import UnansweredQuestions
import ChatHandoffs from './listing-details/ChatHandoffs';
import IndividualLeadsTable from './listing-details/IndividualLeadsTable';
import ChatHistory from './listing-details/ChatHistory'; // Import the new component

const ListingDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clientId = searchParams.get('clientId'); // Get clientId from URL query parameters
    // const { selectedClientId } = useClient(); // No longer needed as clientId comes from URL
    const [listingData, setListingData] = useState(null);
    const [listingMetrics, setListingMetrics] = useState(null);
    const [leadDistributionData, setLeadDistributionData] = useState(null);
    const [commonQuestions, setCommonQuestions] = useState([]);
    const [unansweredQuestions, setUnansweredQuestions] = useState([]); // Keep unansweredQuestions
    const [chatHistory, setChatHistory] = useState([]); // New state for full chat history
    const [chatHandoffs, setChatHandoffs] = useState([]);

    useEffect(() => {
        const fetchListingDetails = async () => {
            if (!clientId) { // Don't fetch if no clientId is available from URL
                console.warn("No clientId found in URL, cannot fetch listing details.");
                return;
            }

            try {
                const [listingResponse, commonQuestionsResponse] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/listing/${id}?clientId=${clientId}`),
                    fetch(`${API_BASE_URL}/api/common-questions?listingId=${id}&clientId=${clientId}`)
                ]);

                console.log("Frontend: listingResponse.ok:", listingResponse.ok);
                console.log("Frontend: listingResponse.status:", listingResponse.status);
                
                if (!listingResponse.ok) {
                    if (listingResponse.status === 404) {
                        console.warn(`Listing with ID ${id} not found for client ${clientId}. Redirecting.`);
                        navigate('/dashboard/listing-performance');
                        return; // Stop further processing
                    }
                    throw new Error(`HTTP error! status: ${listingResponse.status}`);
                }
                
                const listingData = await listingResponse.json();
                console.log("Frontend: Parsed listingData:", listingData);
                
                setListingData(listingData.listing);
                setListingMetrics(listingData.metrics);
                setUnansweredQuestions(listingData.unansweredQuestions); // Set unanswered questions
                setChatHistory(listingData.fullChatHistory); // Set full chat history
                setChatHandoffs(listingData.chatHandoffs);

                if (!commonQuestionsResponse.ok) {
                    console.warn(`Failed to fetch common questions: ${commonQuestionsResponse.status}`);
                    setCommonQuestions([]); // Set to empty array on error
                } else {
                    const commonQuestionsData = await commonQuestionsResponse.json();
                    console.log("Fetched common questions data:", commonQuestionsData); // Add this line
                    setCommonQuestions(commonQuestionsData.commonQuestions);
                }

                const leadMetrics = await getListingLeadDistributionMetrics(id, clientId);
                if (leadMetrics) {
                    setLeadDistributionData({
                        labels: ['Hot Leads', 'Warm Leads', 'Cold Leads'],
                        datasets: [
                            {
                                data: [leadMetrics.hot, leadMetrics.warm, leadMetrics.cold],
                                backgroundColor: ['#FF6384', '#FFCE56', '#36A2EB'],
                                hoverBackgroundColor: ['#FF6384', '#FFCE56', '#36A2EB'],
                            },
                        ],
                    });
                }
            } catch (error) {
                console.error("Error fetching listing details:", error);
                setListingData(null);
                setListingMetrics(null);
                setLeadDistributionData(null);
                setCommonQuestions([]);
                setUnansweredQuestions([]); // Reset unanswered questions
                setChatHistory([]); // Reset full chat history
                setChatHandoffs([]);
            }
        };

        fetchListingDetails();
    }, [id, clientId, navigate]); // Add navigate to dependency array

    if (!listingData) { // Only check for listingData, allow metrics to be null
        return <div className="text-center py-8">Loading listing details...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Listing Details: {listingData.name} ({listingData.propId})
                    </h2>
                    <button
                        onClick={() => navigate('/dashboard/listing-performance')}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none"
                    >
                        Back to All Listings
                    </button>
                </div>

                <ListingMetricsCards listingMetrics={listingMetrics} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <PropertyInformation listing={listingData} />
                    <LeadScoreDistributionChart leadDistributionData={leadDistributionData} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <CommonQuestions questions={commonQuestions} />
                    <UnansweredQuestions questions={unansweredQuestions} /> {/* Keep UnansweredQuestions */}
                </div>

                <div className="mt-8"> {/* New div for ChatHistory */}
                    <ChatHistory chatHistory={chatHistory} />
                </div>

                <ChatHandoffs handoffs={chatHandoffs} />

                <IndividualLeadsTable listingName={listingData.name} />
            </div>
        </div>
    );
};

export default ListingDetailsPage;