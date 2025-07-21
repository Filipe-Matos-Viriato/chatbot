import React from 'react';
import ChatbotPerformanceOverTime from './components/ChatbotPerformanceOverTime';
import UnansweredQuestionsAnalysis from './components/UnansweredQuestionsAnalysis';
import CommonUserIntentionsTopics from './components/CommonUserIntentionsTopics';
import ChatHandoffsToHumanAgents from './components/ChatHandoffsToHumanAgents';

const ChatbotAnalyticsTab = () => {
    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">Chatbot Analytics</h2>

            {/* Chatbot Performance Over Time and Unanswered Questions Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChatbotPerformanceOverTime />
                <UnansweredQuestionsAnalysis />
            </div>

            {/* Common User Intentions / Topics and Chat Handoffs to Human Agents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CommonUserIntentionsTopics />
                <ChatHandoffsToHumanAgents />
            </div>
        </div>
    );
};

export default ChatbotAnalyticsTab;