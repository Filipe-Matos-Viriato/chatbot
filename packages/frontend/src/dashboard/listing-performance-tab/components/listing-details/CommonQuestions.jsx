import React from 'react';

const CommonQuestions = ({ questions }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Common Questions about this Listing</h3>
            {questions && questions.length > 0 ? (
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                    {questions.map((q, index) => (
                        <li key={index}>{q.question_text} ({q.count} times)</li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500">No common questions available.</p>
            )}
        </div>
    );
};

export default CommonQuestions;