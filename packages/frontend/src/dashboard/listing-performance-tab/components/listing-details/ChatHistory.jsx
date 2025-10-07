import React from 'react';

const ChatHistory = ({ chatHistory }) => {
    console.log("ChatHistory component received chatHistory (after backend mapping):", chatHistory);
    if (!chatHistory || chatHistory.length === 0) {
        return (
            <div className="card-standard">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Chat History</h3>
                <p className="text-gray-600">No chat history available for this listing.</p>
            </div>
        );
    }

    // Sort chat history from newest to oldest
    const sortedChatHistory = [...chatHistory].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    return (
        <div className="card-standard">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Chat History</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
                {sortedChatHistory.map((entry, index) => {
                    return (
                    <div key={index} className="border-b pb-2">
                        <p className="text-gray-700 font-medium">
                            {entry.visitor_id ? `${entry.visitor_id}:` : 'User:'} Question: {entry.question}
                        </p>
                        {entry.answer && (
                            <p className="text-gray-600 ml-4">Chatbot: {entry.answer}</p>
                        )}
                        <p className="text-gray-500 text-sm mt-1">
                            Date: {new Date(entry.timestamp).toLocaleString()}
                        </p>
                    </div>
                );
                })}
            </div>
        </div>
    );
};

export default ChatHistory;