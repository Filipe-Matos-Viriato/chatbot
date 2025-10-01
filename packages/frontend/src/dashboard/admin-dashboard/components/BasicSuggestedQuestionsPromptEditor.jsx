import React, { useState, useEffect } from 'react';

const BasicSuggestedQuestionsPromptEditor = ({ value, onChange }) => {
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
        name: 'basic_suggested_questions_prompt',
        value: newValue
      }
    };
    onChange(syntheticEvent);
  };

  return (
    <div className="md:col-span-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Basic Suggested Questions Prompt
      </label>
      <div className="text-xs text-gray-500 mb-2">
        Simple prompt for standalone question generation in API endpoints (when no user data is available)
      </div>
      <textarea
        value={promptText}
        onChange={handlePromptChange}
        className="w-full border border-gray-300 rounded-md shadow-sm p-3 font-mono text-sm"
        rows="8"
        placeholder="Enter the basic suggested questions prompt..."
      />
    </div>
  );
};

export default BasicSuggestedQuestionsPromptEditor;