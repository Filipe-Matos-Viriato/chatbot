import React from 'react';

const IngestionPipelineEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_ingestion_pipeline" className="block text-sm font-medium text-gray-700">Ingestion Pipeline (JSON)</label>
      <textarea
        name="ingestion_pipeline"
        id="edit_ingestion_pipeline"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="10"
      ></textarea>
    </div>
  );
};

export default IngestionPipelineEditor;