// packages/frontend/src/dashboard/unanswered-questions-tab/components/ReplyModal.jsx
// Modal component for composing and sending replies to unanswered questions
// Includes AI-powered reply suggestions and channel selection
// relevant files: UnansweredQuestionsPage.jsx, apiClient.js
import React, { useState } from 'react';
import { apiRequest } from '../../../config/apiClient';

const ReplyModal = ({ question, onClose, onSendReply, clientId }) => {
  const [channel, setChannel] = useState('email');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Determine available channels based on contact info
  const availableChannels = [];
  if (question.visitorEmail) availableChannels.push('email');
  if (question.visitorPhone) availableChannels.push('sms', 'whatsapp');

  // Set default channel to first available
  React.useEffect(() => {
    if (availableChannels.length > 0 && !availableChannels.includes(channel)) {
      setChannel(availableChannels[0]);
    }
  }, [availableChannels, channel]);

  const handleSuggestReply = async () => {
    try {
      setAiLoading(true);
      const response = await apiRequest('/api/ai/suggest-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
        },
        body: JSON.stringify({
          question: question.question,
          chatHistory: '' // Could be enhanced to include chat history
        })
      });
      setMessage(response.suggestedReply);
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      // Could show error toast here
    } finally {
      setAiLoading(false);
    }
  };

  const handleImproveReply = async () => {
    if (!message.trim()) return;

    try {
      setAiLoading(true);
      const response = await apiRequest('/api/ai/improve-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
        },
        body: JSON.stringify({
          draftReply: message,
          question: question.question
        })
      });
      setMessage(response.improvedReply);
    } catch (error) {
      console.error('Error improving reply:', error);
      // Could show error toast here
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!message.trim()) return;

    try {
      setLoading(true);
      await onSendReply(question.id, channel, message.trim());
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channelType) => {
    switch (channelType) {
      case 'email':
        return '📧';
      case 'sms':
        return '📱';
      case 'whatsapp':
        return '💬';
      default:
        return '📤';
    }
  };

  const getChannelLabel = (channelType) => {
    switch (channelType) {
      case 'email':
        return 'Email';
      case 'sms':
        return 'SMS';
      case 'whatsapp':
        return 'WhatsApp';
      default:
        return channelType;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Reply to Question
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>

          {/* Question Display */}
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Question:</h4>
            <p className="text-gray-900">{question.question}</p>
            <div className="mt-2 text-sm text-gray-600">
              From: {question.listingName} • {new Date(question.timestamp).toLocaleDateString()}
            </div>
          </div>

          {/* Contact Info */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Contact Information:</h4>
            <div className="text-sm text-gray-600">
              {question.visitorEmail && (
                <div>Email: {question.visitorEmail}</div>
              )}
              {question.visitorPhone && (
                <div>Phone: {question.visitorPhone}</div>
              )}
            </div>
          </div>

          {/* Channel Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reply Channel
            </label>
            <div className="flex space-x-2">
              {availableChannels.map((channelType) => (
                <button
                  key={channelType}
                  onClick={() => setChannel(channelType)}
                  className={`flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                    channel === channelType
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{getChannelIcon(channelType)}</span>
                  {getChannelLabel(channelType)}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Message
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={handleSuggestReply}
                  disabled={aiLoading}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  {aiLoading ? '...' : '🤖 Suggest'}
                </button>
                <button
                  onClick={handleImproveReply}
                  disabled={aiLoading || !message.trim()}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  {aiLoading ? '...' : '✨ Improve'}
                </button>
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type your reply here..."
            />
            <div className="mt-1 text-xs text-gray-500">
              {channel === 'sms' && 'SMS messages are limited to 160 characters.'}
              {channel === 'whatsapp' && 'WhatsApp messages support rich formatting.'}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSendReply}
              disabled={loading || !message.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Sending...' : `Send via ${getChannelLabel(channel)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplyModal;