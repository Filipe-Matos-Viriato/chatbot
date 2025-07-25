import React from 'react';

const PromptsEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_prompts" className="block text-sm font-medium text-gray-700">Prompts (JSON)</label>
      <textarea
        name="prompts"
        id="edit_prompts"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="10"
      ></textarea>
    </div>
  );
};

export default PromptsEditor;