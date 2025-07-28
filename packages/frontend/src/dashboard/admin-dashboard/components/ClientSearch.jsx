import React, { useState } from 'react';

const ClientSearch = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchClick = () => {
    onSearch(searchTerm);
  };

  const handleResetClick = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <div className="mb-8 p-4 border rounded shadow-sm bg-white">
      <h3 className="text-xl font-semibold mb-4">Search Clients</h3>
      <div className="flex items-center space-x-4">
        <label htmlFor="client_search" className="block text-sm font-medium text-gray-700">Search by Client Name</label>
        <input
          type="text"
          name="client_search"
          id="client_search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearchClick();
            }
          }}
          className="block w-full max-w-md border border-gray-300 rounded-md shadow-sm p-2 h-10"
        />
        <button
          type="button"
          onClick={handleSearchClick}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 h-10"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleResetClick}
          className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 h-10"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default ClientSearch;