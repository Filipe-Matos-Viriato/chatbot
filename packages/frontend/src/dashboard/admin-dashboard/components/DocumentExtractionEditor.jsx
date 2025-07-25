import React from 'react';

const DocumentExtractionEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_document_extraction" className="block text-sm font-medium text-gray-700">Document Extraction (JSON)</label>
      <textarea
        name="document_extraction"
        id="edit_document_extraction"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono"
        rows="10"
      ></textarea>
    </div>
  );
};

export default DocumentExtractionEditor;