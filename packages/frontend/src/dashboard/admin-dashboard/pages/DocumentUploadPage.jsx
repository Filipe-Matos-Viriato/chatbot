import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const DocumentUploadPage = () => {
  const { clientId } = useParams();
  const [selectedCategory, setSelectedCategory] = useState('Client Info');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [developments, setDevelopments] = useState([]);
  const [selectedDevelopmentId, setSelectedDevelopmentId] = useState('');
  const [showCreateDevelopmentModal, setShowCreateDevelopmentModal] = useState(false);
  const [newDevelopmentName, setNewDevelopmentName] = useState('');
  const [newDevelopmentLocation, setNewDevelopmentLocation] = useState('');
  const [newDevelopmentAmenities, setNewDevelopmentAmenities] = useState('');
  const [listingName, setListingName] = useState('');
  const [numBedrooms, setNumBedrooms] = useState('');
  const [totalAreaSqm, setTotalAreaSqm] = useState('');
  const [priceEur, setPriceEur] = useState('');
  const [listingStatus, setListingStatus] = useState('');
  const [currentState, setCurrentState] = useState('');
  const [showAddEditListingModal, setShowAddEditListingModal] = useState(false);

  const handleFileChange = (event) => {
    setSelectedFiles(Array.from(event.target.files));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadStatus('Please select files to upload.');
      return;
    }

    setUploadStatus('Uploading...');

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('clientId', clientId);

    // Placeholder for actual API call
    console.log('Preparing to upload:', { files: selectedFiles.map(file => file.name), clientId });
    // In a real application, you would send formData to your backend API
    // Example:
    // try {
    //   const response = await fetch(`/api/upload/${selectedCategory.toLowerCase().replace(' ', '-')}`, {
    //     method: 'POST',
    //     body: formData,
    //   });
    //   if (response.ok) {
    //     setUploadStatus('Upload successful!');
    //     setSelectedFiles([]);
    //   } else {
    //     setUploadStatus('Upload failed.');
    //   }
    // } catch (error) {
    //   console.error('Upload error:', error);
    //   setUploadStatus('Upload error.');
    // }

    setUploadStatus('Files prepared for upload (API call simulated).');
  };

  useEffect(() => {
    const fetchDevelopments = async () => {
      try {
        const response = await fetch(`/v1/clients/${clientId}/developments`);
        if (response.ok) {
          const data = await response.json();
          setDevelopments(data);
        } else {
          console.error('Failed to fetch developments:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching developments:', error);
      }
    };

    if (selectedCategory === 'Development Info' || selectedCategory === 'Listing Info') {
      fetchDevelopments();
    }
  }, [clientId, selectedCategory]);

  const handleSubmitListing = async () => {
    if (!listingName || !numBedrooms || !totalAreaSqm || !priceEur || !listingStatus || !currentState) {
      alert('Please fill all required fields for the listing.');
      return;
    }

    try {
      const response = await fetch('/v1/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: listingName,
          num_bedrooms: parseInt(numBedrooms),
          total_area_sqm: parseFloat(totalAreaSqm),
          price_eur: parseFloat(priceEur),
          listing_status: listingStatus,
          current_state: currentState,
          client_id: clientId,
          development_id: selectedDevelopmentId || null, // Use null if no development is selected
        }),
      });

      if (response.ok) {
        alert('Listing created/updated successfully!');
        setShowAddEditListingModal(false);
        // Clear form fields
        setListingName('');
        setNumBedrooms('');
        setTotalAreaSqm('');
        setPriceEur('');
        setListingStatus('');
        setCurrentState('');
        setSelectedDevelopmentId(''); // Clear selected development for next listing
      } else {
        alert('Failed to create/update listing.');
        console.error('Failed to create/update listing:', response.statusText);
      }
    } catch (error) {
      console.error('Error creating/updating listing:', error);
      alert('Error creating/updating listing.');
    }
  };

  const handleCreateDevelopment = async () => {
    if (!newDevelopmentName || !newDevelopmentLocation || !newDevelopmentAmenities) {
      alert('Please fill all fields for new development.');
      return;
    }

    try {
      const response = await fetch('/v1/developments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newDevelopmentName,
          location: newDevelopmentLocation,
          amenities: newDevelopmentAmenities,
          clientId: clientId, // Associate with the current client
        }),
      });

      if (response.ok) {
        const newDev = await response.json();
        setDevelopments(prev => [...prev, newDev]);
        setSelectedDevelopmentId(newDev.development_id); // Assuming the backend returns development_id
        setShowCreateDevelopmentModal(false);
        setNewDevelopmentName('');
        setNewDevelopmentLocation('');
        setNewDevelopmentAmenities('');
        alert('Development created successfully!');
      } else {
        alert('Failed to create development.');
        console.error('Failed to create development:', response.statusText);
      }
    } catch (error) {
      console.error('Error creating development:', error);
      alert('Error creating development.');
    }
  };

  const renderCategorySpecificFields = () => {
    switch (selectedCategory) {
      case 'Client Info':
        return (
          <div>
            <p className="text-gray-600">No additional fields are required for Client Info documents. Files will be associated directly with the client ID.</p>
          </div>
        );
      case 'Development Info':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-2">Development Information</h3>
            <div className="mb-4">
              <label htmlFor="development-select" className="block text-sm font-medium text-gray-700">Select Existing Development:</label>
              <select
                id="development-select"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={selectedDevelopmentId}
                onChange={(e) => setSelectedDevelopmentId(e.target.value)}
              >
                <option value="">-- Select a Development --</option>
                {developments.map((dev) => (
                  <option key={dev.development_id} value={dev.development_id}>{dev.name}</option>
                ))}
              </select>
            </div>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              onClick={() => setShowCreateDevelopmentModal(true)}
            >
              Create New Development
            </button>

            {showCreateDevelopmentModal && (
              <div className="mt-4 p-4 border rounded-md bg-gray-50">
                <h4 className="text-md font-semibold mb-2">New Development Details</h4>
                <div className="mb-2">
                  <label htmlFor="new-dev-name" className="block text-sm font-medium text-gray-700">Name:</label>
                  <input
                    type="text"
                    id="new-dev-name"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={newDevelopmentName}
                    onChange={(e) => setNewDevelopmentName(e.target.value)}
                  />
                </div>
                <div className="mb-2">
                  <label htmlFor="new-dev-location" className="block text-sm font-medium text-gray-700">Location:</label>
                  <input
                    type="text"
                    id="new-dev-location"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={newDevelopmentLocation}
                    onChange={(e) => setNewDevelopmentLocation(e.target.value)}
                  />
                </div>
                <div className="mb-2">
                  <label htmlFor="new-dev-amenities" className="block text-sm font-medium text-gray-700">Amenities:</label>
                  <textarea
                    id="new-dev-amenities"
                    rows="3"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={newDevelopmentAmenities}
                    onChange={(e) => setNewDevelopmentAmenities(e.target.value)}
                  ></textarea>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400"
                    onClick={() => setShowCreateDevelopmentModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    onClick={handleCreateDevelopment}
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      case 'Listing Info':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-2">Listing Information</h3>
            <div className="mb-4">
              <label htmlFor="listing-development-select" className="block text-sm font-medium text-gray-700">Select Associated Development (Optional):</label>
              <select
                id="listing-development-select"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={selectedDevelopmentId}
                onChange={(e) => setSelectedDevelopmentId(e.target.value)}
              >
                <option value="">-- Select a Development --</option>
                {developments.map((dev) => (
                  <option key={dev.development_id} value={dev.development_id}>{dev.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="listing-files" className="block text-sm font-medium text-gray-700">Upload Listing Documents:</label>
              <input
                type="file"
                id="listing-files"
                multiple
                onChange={handleFileChange}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {selectedFiles.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected files: {selectedFiles.map(file => file.name).join(', ')}
                </div>
              )}
            </div>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              onClick={() => setShowAddEditListingModal(true)}
            >
              Add/Edit Individual Listing
            </button>

            {showAddEditListingModal && (
              <div className="mt-4 p-4 border rounded-md bg-gray-50">
                <h4 className="text-md font-semibold mb-2">Listing Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="listing-name" className="block text-sm font-medium text-gray-700">Name:</label>
                    <input
                      type="text"
                      id="listing-name"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                      value={listingName}
                      onChange={(e) => setListingName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="num-bedrooms" className="block text-sm font-medium text-gray-700">Number of Bedrooms:</label>
                    <input
                      type="number"
                      id="num-bedrooms"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                      value={numBedrooms}
                      onChange={(e) => setNumBedrooms(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="total-area" className="block text-sm font-medium text-gray-700">Total Area (sqm):</label>
                    <input
                      type="number"
                      id="total-area"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                      value={totalAreaSqm}
                      onChange={(e) => setTotalAreaSqm(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="price-eur" className="block text-sm font-medium text-gray-700">Price (EUR):</label>
                    <input
                      type="number"
                      id="price-eur"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                      value={priceEur}
                      onChange={(e) => setPriceEur(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="listing-status" className="block text-sm font-medium text-gray-700">Listing Status:</label>
                    <select
                      id="listing-status"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md"
                      value={listingStatus}
                      onChange={(e) => setListingStatus(e.target.value)}
                    >
                      <option value="">-- Select Status --</option>
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="sold">Sold</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="current-state" className="block text-sm font-medium text-gray-700">Current State:</label>
                    <select
                      id="current-state"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md"
                      value={currentState}
                      onChange={(e) => setCurrentState(e.target.value)}
                    >
                      <option value="">-- Select State --</option>
                      <option value="project">Project</option>
                      <option value="building">Building</option>
                      <option value="finished">Finished</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400"
                    onClick={() => setShowAddEditListingModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    onClick={handleSubmitListing}
                  >
                    Submit Listing
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Document Upload for Client ID: {clientId}</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Select Document Category</h2>
        <div className="flex space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio"
              name="documentCategory"
              value="Client Info"
              checked={selectedCategory === 'Client Info'}
              onChange={() => setSelectedCategory('Client Info')}
            />
            <span className="ml-2">Client Info</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio"
              name="documentCategory"
              value="Development Info"
              checked={selectedCategory === 'Development Info'}
              onChange={() => setSelectedCategory('Development Info')}
            />
            <span className="ml-2">Development Info</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio"
              name="documentCategory"
              value="Listing Info"
              checked={selectedCategory === 'Listing Info'}
              onChange={() => setSelectedCategory('Listing Info')}
            />
            <span className="ml-2">Listing Info</span>
          </label>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Upload Files</h2>
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {selectedFiles.length > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            Selected files: {selectedFiles.map(file => file.name).join(', ')}
          </div>
        )}
      </div>

      {renderCategorySpecificFields()}

      <button
        className="mt-6 bg-green-600 text-white px-6 py-3 rounded-md text-lg font-semibold hover:bg-green-700"
        onClick={handleUpload}
      >
        Upload Documents
      </button>
    </div>
  );
};

export default DocumentUploadPage;