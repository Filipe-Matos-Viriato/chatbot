import React from 'react';

const ListingSearchInput = ({ searchTerm, onSearchChange, onClearSearch }) => {
    return (
        <div className="relative w-full">
            <input
                type="text"
                placeholder="Search listings by name or ID..."
                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={onSearchChange}
            />
            {searchTerm && (
                <button
                    onClick={onClearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                    X
                </button>
            )}
        </div>
    );
};

export default ListingSearchInput;