// packages/frontend/src/dashboard/unanswered-questions-tab/components/FilterSidebar.jsx
// Sidebar component for filtering unanswered questions
// Provides date range picker, search input, and status filters
// relevant files: UnansweredQuestionsPage.jsx, apiClient.js
import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../../config/apiClient';

const FilterSidebar = ({ filters, onFilterChange, showListingFilter = true, clientId }) => {
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Debug: Track dropdown state changes
  const debugSetIsDropdownOpen = (value) => {
    console.log('[FilterSidebar] setIsDropdownOpen called with:', value);
    setIsDropdownOpen(value);
  };
  const dropdownRef = useRef(null);
  const pendingDropdownState = useRef(null);

  // Fetch listings for the dropdown
  useEffect(() => {
    if (showListingFilter && clientId) {
      fetchListings();
    }
  }, [showListingFilter, clientId]);

  // Apply pending dropdown state after filter changes
  useEffect(() => {
    console.log('[FilterSidebar] useEffect triggered by filters change:', filters);
    if (pendingDropdownState.current !== null) {
      console.log('[FilterSidebar] Applying pending dropdown state:', pendingDropdownState.current);
      debugSetIsDropdownOpen(pendingDropdownState.current);
      pendingDropdownState.current = null;
    }
  }, [filters]);


  const fetchListings = async () => {
    if (!clientId) return;

    try {
      setLoadingListings(true);
      const response = await apiRequest(`/v1/clients/${clientId}/listings`, {
        method: 'GET',
        headers: {
          'X-Client-Id': clientId,
        },
      });
      setListings(response || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      setListings([]);
    } finally {
      setLoadingListings(false);
    }
  };

  const handleFilterChange = (key, value) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  const handleDateRangeChange = (startDate, endDate) => {
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;
    handleFilterChange('dateRange', dateRange);
  };

  const clearFilters = () => {
    console.log('[FilterSidebar] clearFilters called');
    onFilterChange({
      listingId: '',
      dateRange: null,
      searchQuery: '',
      status: ''
    });
    debugSetIsDropdownOpen(false);
  };

  const handleListingSelect = (listingId) => {
    console.log('[FilterSidebar] handleListingSelect called with:', listingId);
    handleFilterChange('listingId', listingId);
    pendingDropdownState.current = false; // Close immediately after selection
    console.log('[FilterSidebar] Set pendingDropdownState to false');
  };

  const toggleDropdown = () => {
    console.log('[FilterSidebar] toggleDropdown called, current state:', isDropdownOpen, 'new state will be:', !isDropdownOpen);
    debugSetIsDropdownOpen(!isDropdownOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        console.log('[FilterSidebar] Click outside detected, closing dropdown');
        debugSetIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="card-standard">
      <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>

        {/* Search Query */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Questions
          </label>
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            placeholder="Search in questions..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Listing Filter */}
        {showListingFilter && (
          <div className="mb-4" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listing
            </label>
            <div className="relative">
              {/* Custom Dropdown Button */}
              <button
                type="button"
                onClick={toggleDropdown}
                className="w-full px-3 py-2 text-left border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white flex items-center"
                disabled={loadingListings}
              >
                <span className={`flex-1 truncate ${filters.listingId ? 'text-gray-900' : 'text-gray-500'}`}>
                  {(() => {
                    const displayText = loadingListings
                      ? 'Loading...'
                      : filters.listingId
                        ? (listings.find(l => l.id === filters.listingId)?.name
                            ? `${filters.listingId} - ${listings.find(l => l.id === filters.listingId)?.name}`
                            : filters.listingId)
                        : 'All Listings';
                    console.log('[FilterSidebar] Button display text:', displayText, 'filters.listingId:', filters.listingId);
                    return displayText;
                  })()}
                </span>
                <div className="flex-shrink-0 ml-2">
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Custom Dropdown Options */}
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  <div
                    className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      handleFilterChange('listingId', '');
                      pendingDropdownState.current = false; // Close when clearing selection
                    }}
                  >
                    All Listings
                  </div>
                  {listings.map((listing) => (
                    <div
                      key={listing.id}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                        filters.listingId === listing.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-900'
                      }`}
                      onClick={() => handleListingSelect(listing.id)}
                    >
                      {listing.name ? `${listing.id} - ${listing.name}` : listing.id}
                      {filters.listingId === listing.id && (
                        <span className="ml-2 text-blue-600">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Date Range */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.dateRange?.start || ''}
              onChange={(e) => handleDateRangeChange(e.target.value, filters.dateRange?.end)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="date"
              value={filters.dateRange?.end || ''}
              onChange={(e) => handleDateRangeChange(filters.dateRange?.start, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="kb_update_needed">KB Update Needed</option>
          </select>
        </div>

        {/* Clear Filters */}
        <button
          onClick={clearFilters}
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Clear All Filters
        </button>
      </div>

      {/* Filter Summary */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Active Filters</h4>
        <div className="space-y-1">
          {filters.searchQuery && (
            <div className="text-sm text-gray-600">
              Search: "{filters.searchQuery}"
            </div>
          )}
          {filters.listingId && (
            <div className="text-sm text-gray-600">
              Listing: {listings.find(l => l.id === filters.listingId)?.name || filters.listingId}
            </div>
          )}
          {filters.dateRange && (
            <div className="text-sm text-gray-600">
              Date: {new Date(filters.dateRange.start).toLocaleDateString()} - {new Date(filters.dateRange.end).toLocaleDateString()}
            </div>
          )}
          {filters.status && (
            <div className="text-sm text-gray-600">
              Status: {filters.status.replace('_', ' ')}
            </div>
          )}
          {!filters.searchQuery && !filters.listingId && !filters.dateRange && !filters.status && (
            <div className="text-sm text-gray-500">No active filters</div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default FilterSidebar;