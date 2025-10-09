import React, { useState, useEffect, useRef } from 'react';
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
import ChatHistoryPage from './listing-details/ChatHistoryPage'; // Import ChatHistoryPage for modal

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
    const [individualLeads, setIndividualLeads] = useState([]); // New state for individual leads
    const [currentView, setCurrentView] = useState('listing'); // 'listing' or 'chat-history'
    const [selectedVisitorId, setSelectedVisitorId] = useState(null); // Selected visitor ID for chat history view

    // Use ref to store the function to ensure it's stable
    const handleOpenChatHistoryRef = useRef();

    // Debug state changes
    useEffect(() => {
        console.log('ListingDetailsPage state changed - currentView:', currentView, 'selectedVisitorId:', selectedVisitorId);
    }, [currentView, selectedVisitorId]);

    useEffect(() => {
        const fetchListingDetails = async () => {
            if (!clientId) { // Don't fetch if no clientId is available from URL
                console.warn("No clientId found in URL, cannot fetch listing details.");
                return;
            }

            try {
                const [listingResponse, commonQuestionsResponse, individualLeadsResponse] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/listing/${id}?clientId=${clientId}`),
                    fetch(`${API_BASE_URL}/api/common-questions?listingId=${id}&clientId=${clientId}`),
                    fetch(`${API_BASE_URL}/api/listing/${id}/leads?clientId=${clientId}`) // Fetch individual leads
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
                console.log("Frontend: Parsed listingData (including fullChatHistory after backend mapping):", listingData);
                
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

                if (!individualLeadsResponse.ok) {
                    console.warn(`Failed to fetch individual leads: ${individualLeadsResponse.status}`);
                    setIndividualLeads([]); // Set to empty array on error
                } else {
                    const individualLeadsData = await individualLeadsResponse.json();
                    console.log("Fetched individual leads data:", individualLeadsData);
                    setIndividualLeads(individualLeadsData.leads);
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
                setIndividualLeads([]); // Reset individual leads
            }
        };

        fetchListingDetails();
    }, [id, clientId, navigate]); // Add navigate to dependency array

    // Assign function to ref to ensure stability
    useEffect(() => {
        handleOpenChatHistoryRef.current = (visitorId) => {
            console.log('handleOpenChatHistory called with visitorId:', visitorId);
            console.log('Current state before update - currentView:', currentView, 'selectedVisitorId:', selectedVisitorId);
            setSelectedVisitorId(visitorId);
            setCurrentView('chat-history');
            console.log('State updated - should now show chat history');
        };
        console.log('ListingDetailsPage - function assigned to ref');
    }, [currentView, selectedVisitorId]);

    console.log('ListingDetailsPage render - handleOpenChatHistoryRef.current defined:', !!handleOpenChatHistoryRef.current);

    const handleBackToListing = () => {
        setCurrentView('listing');
        setSelectedVisitorId(null);
    };

    if (!listingData) { // Only check for listingData, allow metrics to be null
        return <div className="text-center py-8">Loading listing details...</div>;
    }

    if (currentView === 'chat-history' && selectedVisitorId) {
        console.log('Rendering chat history view for visitor:', selectedVisitorId);
        // Find visitor contact information
        const visitorData = individualLeads.find(lead => lead.visitor_id === selectedVisitorId);
        const hasContactInfo = visitorData && (visitorData.email || visitorData.phone);

        console.log('ListingDetailsPage - about to render main content, currentView:', currentView);
        return (
            <div className="space-y-8 w-full">
                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">
                            Chat History for Visitor: {visitorData?.name || selectedVisitorId}
                        </h2>
                        <button
                            onClick={handleBackToListing}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none"
                        >
                            Back to Listing Details
                        </button>
                    </div>
                    <div className="mb-4 text-gray-600">
                        {hasContactInfo ? (
                            <div>
                                {visitorData.email && <span>Email: {visitorData.email}</span>}
                                {visitorData.email && visitorData.phone && <span> • </span>}
                                {visitorData.phone && <span>Phone: {visitorData.phone}</span>}
                            </div>
                        ) : (
                            <div>No contact information available</div>
                        )}
                    </div>
                    <div className="mb-4 text-gray-600">
                        Listing: {listingData.name} ({listingData.propId})
                    </div>
                    <ChatHistoryPage visitorId={selectedVisitorId} onClose={handleBackToListing} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 w-full">
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Listing Details: {listingData.name} ({listingData.propId})
                    </h2>
                    <button
                        onClick={() => window.history.back()}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none"
                    >
                        Back to All Listings
                    </button>
                </div>

                <ListingMetricsCards listingMetrics={listingMetrics} />
                {/* The ListingMetricsCards component is responsible for rendering the individual metric cards.
                    The label "Chatbot Views" is likely rendered within that component, not directly in ListingDetailsPage.jsx.
                    However, the prompt specifically asks to change the label in this file.
                    I will assume the label is passed as a prop or derived from a structure that is passed to ListingMetricsCards.
                    Since I don't have the content of ListingMetricsCards.jsx, I will search for "Chatbot Views" in this file
                    and if not found, I will inform the user.
                    Upon reviewing the provided file content, "Chatbot Views" is not present.
                    Therefore, I need to inform the user that the change needs to be made in ListingMetricsCards.jsx.
                    However, the prompt explicitly states "in the 'packages/frontend/src/dashboard/listing-performance-tab/components/ListingDetailsPage.jsx' (see below for file content) there is a metric that has the label "Chatbot Views".
                    This implies the label is directly in this file.
                    Given the file content, the label "Chatbot Views" is not directly present. It's highly probable that the `ListingMetricsCards` component is responsible for rendering this label.
                    I need to read the `ListingMetricsCards.jsx` file to make the change.
                    I will update the todo list to reflect this.
                */}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <PropertyInformation listing={listingData} />
                    <LeadScoreDistributionChart leadDistributionData={leadDistributionData} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <CommonQuestions questions={commonQuestions} />
                    <UnansweredQuestions questions={unansweredQuestions} listingId={id} /> {/* Keep UnansweredQuestions */}
                </div>

                <div className="mt-8"> {/* New div for ChatHistory */}
                    <ChatHistory chatHistory={chatHistory} />
                </div>

                <div className="mt-8">
                    {(() => {
                        console.log('About to render IndividualLeadsTable - currentView:', currentView, 'hasLeads:', !!individualLeads);
                        console.log('handleOpenChatHistoryRef.current exists:', !!handleOpenChatHistoryRef.current);
                        console.log('handleOpenChatHistoryRef.current type:', typeof handleOpenChatHistoryRef.current);
                        console.log('individualLeads data:', individualLeads);
                        return (
                            <IndividualLeadsTable
                                listingName={listingData.name}
                                leads={individualLeads}
                                onOpenChatHistory={handleOpenChatHistoryRef.current}
                            />
                        );
                    })()}
                </div>

                <div className="mt-8">
                    <ChatHandoffs handoffs={chatHandoffs} />
                </div>
            </div>

        </div>
    );
};

export default ListingDetailsPage;