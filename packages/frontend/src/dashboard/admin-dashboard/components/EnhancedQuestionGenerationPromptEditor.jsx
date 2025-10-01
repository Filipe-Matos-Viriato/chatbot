import React, { useState, useEffect } from 'react';

const EnhancedQuestionGenerationPromptEditor = ({ value, onChange }) => {
  const [promptText, setPromptText] = useState('');

  // Initialize with value
  useEffect(() => {
    if (value) {
      setPromptText(typeof value === 'string' ? value : '');
    } else {
      setPromptText('');
    }
  }, [value]);

  const handlePromptChange = (e) => {
    const newValue = e.target.value;
    setPromptText(newValue);

    // Create synthetic event to match expected onChange format
    const syntheticEvent = {
      target: {
        name: 'enhanced_question_generation_prompt',
        value: newValue
      }
    };
    onChange(syntheticEvent);
  };

  return (
    <div className="md:col-span-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Enhanced Question Generation Prompt
      </label>
      <div className="text-xs text-gray-500 mb-2">
        Advanced prompt for personalized question generation in main chat flow with user context and engagement data
      </div>
      <textarea
        value={promptText}
        onChange={handlePromptChange}
        className="w-full border border-gray-300 rounded-md shadow-sm p-3 font-mono text-sm"
        rows="12"
        placeholder="Enter the enhanced question generation prompt..."
      />
    </div>
  );
};

export default EnhancedQuestionGenerationPromptEditor;