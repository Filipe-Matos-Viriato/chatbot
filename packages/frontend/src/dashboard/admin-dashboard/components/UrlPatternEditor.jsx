import React from 'react';

const UrlPatternEditor = ({ value, onChange }) => {
  return (
    <div className="md:col-span-3">
      <label htmlFor="edit_url_pattern" className="block text-sm font-medium text-gray-700">URL Pattern</label>
      <input
        type="text"
        name="url_pattern"
        id="edit_url_pattern"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
      />
    </div>
  );
};

export default UrlPatternEditor;