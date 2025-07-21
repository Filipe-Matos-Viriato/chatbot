import React from 'react';

const UnansweredQuestionsAnalysis = () => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800">Unanswered Questions Analysis</h3>
            <p className="text-sm text-gray-500 mt-1">Bar Chart: Top Unanswered Question Categories</p>
            <p className="text-sm text-gray-500 mt-1">Identify common knowledge gaps in the chatbot.</p>
            <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">
                Review Unanswered Questions
            </button>
            <div className="mt-4 h-64 bg-gray-100 flex items-center justify-center text-gray-400">
                [Unanswered Questions Chart Placeholder]
            </div>
        </div>
    );
};

export default UnansweredQuestionsAnalysis;