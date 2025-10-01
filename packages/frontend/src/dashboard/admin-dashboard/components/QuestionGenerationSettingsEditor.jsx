import React from 'react';

const QuestionGenerationSettingsEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_question_generation_config" className="block text-sm font-medium text-gray-700">Question Generation Settings (JSON)</label>
      <p className="mt-1 text-xs text-gray-500">
        Configure how suggested questions are generated after each chatbot response. Controls personalization, strategy, and engagement thresholds.
      </p>
      <textarea
        name="question_generation_config"
        id="edit_question_generation_config"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="12"
      ></textarea>
    </div>
  );
};

export default QuestionGenerationSettingsEditor;