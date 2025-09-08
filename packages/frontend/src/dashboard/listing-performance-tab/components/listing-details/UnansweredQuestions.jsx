import React from 'react';
import { useNavigate } from 'react-router-dom';

const UnansweredQuestions = ({ questions, listingId }) => {
    const navigate = useNavigate();
    return (
        <div className="card-standard">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Unanswered Questions for this Listing</h3>
            {questions.length > 0 ? (
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                    {questions.map((q, index) => (
                        <li key={index}>
                            {q.message_text}
                            {q.timestamp && (
                                <span className="text-gray-400 text-sm ml-2">
                                    ({new Date(q.timestamp).toLocaleString()})
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500 italic">There are no unanswered questions.</p>
            )}
            <button
                onClick={() => navigate(`/dashboard/unanswered-questions?listingId=${listingId}`)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
                Review All Unanswered Questions
            </button>
        </div>
    );
};

export default UnansweredQuestions;