import React from 'react';

const UnansweredQuestions = ({ questions }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Unanswered Questions for this Listing</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
                {questions.map((q, index) => (
                    <li key={index}>{q}</li>
                ))}
            </ul>
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Review All Unanswered Questions
            </button>
        </div>
    );
};

export default UnansweredQuestions;