import React from 'react';

const ChunkingRulesEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_chunking_rules" className="block text-sm font-medium text-gray-700">Chunking Rules (JSON)</label>
      <p className="mt-1 text-xs text-gray-500">
        Defines how text content is split into smaller chunks for embedding and retrieval.
      </p>
      <textarea
        name="chunking_rules"
        id="edit_chunking_rules"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="10"
      ></textarea>
    </div>
  );
};

export default ChunkingRulesEditor;