import React from 'react';

const QuestionGenerationStrategiesInfo = () => {
  return (
    <div className="md:col-span-3">
      <label className="block text-sm font-medium text-gray-700">Question Generation Strategies</label>
      <div className="mt-1 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <strong className="text-blue-800">"llm_only":</strong> Uses AI to generate all questions. Most intelligent but may fail occasionally.
          </div>
          <div>
            <strong className="text-blue-800">"template_only":</strong> Uses predefined templates. Reliable but less personalized.
          </div>
          <div>
            <strong className="text-blue-800">"hybrid" (recommended):</strong> AI-generated with template fallback. Best balance of intelligence and reliability.
          </div>
          <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-gray-600">
            <strong>Template Location:</strong> Fallback templates are defined in <code className="bg-gray-100 px-1 rounded">packages/backend/src/utils/question-strategies.js</code>
          </div>
          <div className="text-xs text-gray-600">
            <strong>Tip:</strong> Start with "hybrid" strategy for optimal performance and user experience.
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionGenerationStrategiesInfo;