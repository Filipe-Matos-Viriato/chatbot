import React from 'react';

const DevelopmentTaggingPromptEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_development_tagging_prompt" className="block text-sm font-medium text-gray-700">Development Tagging Prompt</label>
      <p className="mt-1 text-xs text-gray-500">
        This prompt controls how the AI generates tags from development descriptions.
      </p>
      <textarea
        name="development_tagging_prompt"
        id="edit_development_tagging_prompt"
        value={value || ''}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm"
        rows="15"
        placeholder="Enter the LLM prompt for generating tags from development descriptions..."
      ></textarea>
    </div>
  );
};

export default DevelopmentTaggingPromptEditor;