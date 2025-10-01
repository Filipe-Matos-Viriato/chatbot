import React from 'react';

const QuestionTemplatesObservations = () => {
  return (
    <div className="md:col-span-3">
      <label className="block text-sm font-medium text-gray-700">Question Templates Organization</label>
      <div className="mt-1 p-4 bg-green-50 border border-green-200 rounded-md">
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <strong className="text-green-800">Context Types:</strong>
          </div>
          <ul className="ml-4 space-y-1">
            <li><strong>LISTING_SPECIFIC:</strong> Questions when user is viewing a specific property</li>
            <li><strong>GENERAL_INQUIRY:</strong> Questions for general conversations</li>
            <li><strong>DEVELOPMENT_SPECIFIC:</strong> Questions when user is viewing a development</li>
            <li><strong>FEATURE_INQUIRY:</strong> Follow-up questions based on specific features (price, location, amenities)</li>
          </ul>

          <div className="mt-3">
            <strong className="text-green-800">Engagement Levels:</strong>
          </div>
          <ul className="ml-4 space-y-1">
            <li><strong>HIGH_ENGAGEMENT:</strong> Users with lead score ≥70 (ready for conversion)</li>
            <li><strong>MEDIUM_ENGAGEMENT:</strong> Users with lead score 40-69 (building interest)</li>
            <li><strong>LOW_ENGAGEMENT:</strong> Users with lead score {"<"} 40 (early exploration)</li>
          </ul>

          <div className="mt-3 pt-2 border-t border-green-200 text-xs text-gray-600">
            <strong>Note:</strong> Each context type has 3 engagement levels, and each level contains 3 personalized questions that guide users toward your business goals.
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionTemplatesObservations;