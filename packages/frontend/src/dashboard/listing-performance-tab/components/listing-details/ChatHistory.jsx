import React from 'react';

const ChatHistory = ({ chatHistory }) => {
    if (!chatHistory || chatHistory.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Chat History</h3>
                <p className="text-gray-600">No chat history available for this listing.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Chat History</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
                {chatHistory.map((entry, index) => (
                    <div key={index} className="border-b pb-2">
                        <p className="text-gray-700 font-medium">User: {entry.question_text}</p>
                        {entry.chatbot_response && (
                            <p className="text-gray-600 ml-4">Chatbot: {entry.chatbot_response}</p>
                        )}
                        <p className="text-gray-500 text-sm mt-1">
                            {new Date(entry.asked_at).toLocaleString()}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChatHistory;