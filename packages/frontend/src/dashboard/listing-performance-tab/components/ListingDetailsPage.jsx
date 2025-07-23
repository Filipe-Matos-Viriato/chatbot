import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getListingLeadDistributionMetrics } from '../../../config/supabaseClient';
import ListingMetricsCards from './listing-details/ListingMetricsCards';
import PropertyInformation from './listing-details/PropertyInformation';
import LeadScoreDistributionChart from './listing-details/LeadScoreDistributionChart';
import CommonQuestions from './listing-details/CommonQuestions';
import UnansweredQuestions from './listing-details/UnansweredQuestions';
import ChatHandoffs from './listing-details/ChatHandoffs';
import IndividualLeadsTable from './listing-details/IndividualLeadsTable';

const ListingDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [listingData, setListingData] = useState(null);
    const [listingMetrics, setListingMetrics] = useState(null);
    const [leadDistributionData, setLeadDistributionData] = useState(null);
    const [commonQuestions, setCommonQuestions] = useState([]);
    const [unansweredQuestions, setUnansweredQuestions] = useState([]);
    const [chatHandoffs, setChatHandoffs] = useState([]);

    useEffect(() => {
        const fetchListingDetails = async () => {
            try {
                const [listingResponse, commonQuestionsResponse] = await Promise.all([
                    fetch(`http://localhost:3006/api/listing/${id}`),
                    fetch(`http://localhost:3006/api/common-questions?listingId=${id}&clientId=client-abc`) // Assuming client-abc for now
                ]);

                if (!listingResponse.ok) {
                    throw new Error(`HTTP error! status: ${listingResponse.status}`);
                }
                const listingData = await listingResponse.json();
                setListingData(listingData.listing);
                setListingMetrics(listingData.metrics);
                setUnansweredQuestions(listingData.unansweredQuestions);
                setChatHandoffs(listingData.chatHandoffs);

                if (!commonQuestionsResponse.ok) {
                    console.warn(`Failed to fetch common questions: ${commonQuestionsResponse.status}`);
                    setCommonQuestions([]); // Set to empty array on error
                } else {
                    const commonQuestionsData = await commonQuestionsResponse.json();
                    setCommonQuestions(commonQuestionsData.commonQuestions);
                }

                const leadMetrics = await getListingLeadDistributionMetrics(id);
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
                setUnansweredQuestions([]);
                setChatHandoffs([]);
            }
        };

        fetchListingDetails();
    }, [id]);

    if (!listingData || !listingMetrics) {
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
                    <UnansweredQuestions questions={unansweredQuestions} />
                </div>

                <ChatHandoffs handoffs={chatHandoffs} />

                <IndividualLeadsTable listingName={listingData.name} />
            </div>
        </div>
    );
};

export default ListingDetailsPage;