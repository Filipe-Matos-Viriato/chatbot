// packages/frontend/src/dashboard/unanswered-questions-tab/UnansweredQuestionsPage.jsx
// Main page component for managing unanswered questions from the chatbot
// Provides a comprehensive interface for reviewing, filtering, and responding to unanswered user questions
// relevant files: QuestionTable.jsx, FilterSidebar.jsx, ReplyModal.jsx, apiClient.js
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import QuestionTable from './components/QuestionTable';
import FilterSidebar from './components/FilterSidebar';
import ReplyModal from './components/ReplyModal';
import { apiRequest } from '../../config/apiClient';
import { useClient } from '../../context/ClientContext';

const UnansweredQuestionsPage = ({ clientId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [filters, setFilters] = useState({
    listingId: searchParams.get('listingId') || '',
    dateRange: null,
    searchQuery: '',
    status: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });

  // Fetch unanswered questions
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Don't fetch if clientId is not available
      if (!clientId) {
        console.log('Waiting for clientId to be available...');
        setLoading(false);
        return;
      }

      const queryParams = new URLSearchParams({
        page: pagination.page,
        pageSize: pagination.pageSize,
        clientId: clientId,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== null)
        )
      });

      // Convert dateRange object to JSON string for API
      if (filters.dateRange) {
        queryParams.set('dateRange', JSON.stringify(filters.dateRange));
      }

      const response = await apiRequest(`/api/unanswered-questions?${queryParams}`, {
        method: 'GET',
        headers: {
          'X-Client-Id': clientId,
        },
      });
      setQuestions(response.questions || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
        totalPages: response.totalPages || 0
      }));
    } catch (err) {
      console.error('Error fetching unanswered questions:', err);
      setError(err.message || 'Failed to fetch unanswered questions');
    } finally {
      setLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Handle status update
  const handleStatusUpdate = async (questionId, status, notes) => {
    try {
      await apiRequest(`/api/unanswered-questions/${questionId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
        },
        body: JSON.stringify({
          status,
          notes
        })
      });

      // Refresh the questions list
      await fetchQuestions();

      // Show success message (you might want to add a toast notification system)
      console.log('Question status updated successfully');
    } catch (err) {
      console.error('Error updating question status:', err);
      setError(err.message || 'Failed to update question status');
    }
  };

  // Handle reply
  const handleReply = async (questionId, channel, message) => {
    try {
      await apiRequest(`/api/unanswered-questions/${questionId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
        },
        body: JSON.stringify({
          channel,
          message
        })
      });

      // Close modal and refresh questions
      setShowReplyModal(false);
      setSelectedQuestion(null);
      await fetchQuestions();

      console.log('Reply sent successfully');
    } catch (err) {
      console.error('Error sending reply:', err);
      setError(err.message || 'Failed to send reply');
    }
  };

  // Handle opening reply modal
  const handleOpenReplyModal = (question) => {
    setSelectedQuestion(question);
    setShowReplyModal(true);
  };

  // Effect to fetch questions when filters, pagination, or clientId change
  useEffect(() => {
    if (clientId) {
      fetchQuestions();
    }
  }, [filters, pagination.page, pagination.pageSize, clientId]);

  // Effect to update URL when listingId filter changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (filters.listingId) {
      newSearchParams.set('listingId', filters.listingId);
    } else {
      newSearchParams.delete('listingId');
    }
    setSearchParams(newSearchParams);
  }, [filters.listingId, setSearchParams]);

  return (
    <div className="flex flex-row gap-8">
      {/* Sidebar with fixed width */}
      <div className="w-[320px] flex-shrink-0 bg-white border-r border-gray-200 rounded-lg shadow-sm">
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          showListingFilter={true}
          clientId={clientId}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Unanswered Questions
          </h1>
          <p className="text-gray-600 mt-1">
            Review and respond to questions that the chatbot couldn't answer
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Questions Table */}
        <QuestionTable
          questions={questions}
          loading={loading}
          pagination={pagination}
          onPageChange={handlePageChange}
          onStatusUpdate={handleStatusUpdate}
          onReply={handleOpenReplyModal}
        />

        {/* Reply Modal */}
        {showReplyModal && selectedQuestion && (
          <ReplyModal
            question={selectedQuestion}
            onClose={() => {
              setShowReplyModal(false);
              setSelectedQuestion(null);
            }}
            onSendReply={handleReply}
            clientId={clientId}
          />
        )}
      </div>
    </div>
  );
};

export default UnansweredQuestionsPage;