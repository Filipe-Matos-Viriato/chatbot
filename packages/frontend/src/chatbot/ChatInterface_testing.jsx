// File location: packages/frontend/src/chatbot/ChatInterface_testing.jsx
// Description: A simplified chatbot interface for testing purposes, without Shadcn UI components.
// Why this file exists: To provide a quick and easy way to test the backend RAG service without UI dependencies.
// Relevant files: packages/frontend/src/chatbot/ChatInterface.jsx, packages/frontend/src/main.jsx, packages/backend/src/index.js, packages/backend/src/rag-service.js

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../config/apiClient';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const ChatInterfaceTesting = () => {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Olá! Sou o seu assistente virtual. Como posso ajudar?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [visitorId, setVisitorId] = useState(null); // Initialize as null, will be fetched dynamically
  const [listings, setListings] = useState([]); // New state for listings
  const [selectedListingId, setSelectedListingId] = useState(''); // New state for selected listing ID
  const messagesEndRef = useRef(null);

  // Hardcode client ID for testing purposes as requested by the user
  const TEST_CLIENT_ID = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';

  useEffect(() => {
    setSessionId(generateUUID());

    // Fetch or create visitor ID
    const initializeVisitor = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ clientId: TEST_CLIENT_ID }),
        });
        const data = await response.json();
        setVisitorId(data.visitor_id);
        console.log("Visitor ID initialized:", data.visitor_id);
      } catch (error) {
        console.error("Failed to initialize visitor session:", error);
        // Set visitorId to null to disable chat input and button
        setVisitorId(null);
      }
    };

    initializeVisitor();
  }, []); // Run once on mount

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/clients/${TEST_CLIENT_ID}/listings`, {
          headers: {
            'x-client-id': TEST_CLIENT_ID,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setListings(data);
        if (data.length > 0) {
          setSelectedListingId(data[0].id); // Select the first listing by default
        }
      } catch (error) {
        console.error("Failed to fetch listings:", error);
      }
    };

    fetchListings();
  }, [TEST_CLIENT_ID]); // Re-run if TEST_CLIENT_ID changes

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (input.trim()) {
      const userMessage = { from: 'user', text: input };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': TEST_CLIENT_ID, // Use hardcoded client ID
          },
          body: JSON.stringify({
            query: input,
            context: selectedListingId !== '' ? { listingId: selectedListingId } : null,
            session_id: sessionId,
            visitor_id: visitorId,
            clientId: TEST_CLIENT_ID // Also pass clientId in body for backend convenience
          }),
        });

        const data = await response.json();
        // Log the debug payload if it exists
        if (data.debug) {
          console.log("🔍 SERVER-SIDE DEBUG PAYLOAD:", data.debug);
        }
        const botMessage = { from: 'bot', text: data.response };
        setMessages(prev => [...prev, botMessage]);
      } catch (error) {
        console.error("Failed to send message:", error);
        const errorMessage = { from: 'bot', text: 'Sorry, I am having trouble connecting.' };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
      <div style={{ width: '440px', height: '700px', display: 'grid', gridTemplateRows: 'auto 1fr auto', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Chatbot (Testing)</h2>
          <div style={{ marginTop: '10px' }}>
            <label htmlFor="listing-select" style={{ marginRight: '5px' }}>Simulate Listing:</label>
            <select
              id="listing-select"
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              style={{ padding: '5px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            >
              <option value="">No Listing Selected</option>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.id}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((message, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: message.from === 'user' ? 'flex-end' : 'flex-start' }}>
              {message.from === 'bot' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#d1d5db', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563', fontWeight: 'bold' }}>CB</div>
              )}
              <div style={{ borderRadius: '8px', padding: '8px 12px', backgroundColor: message.from === 'user' ? '#3b82f6' : '#e5e7eb', color: message.from === 'user' ? '#ffffff' : '#1f2937' }}>
                <div style={{ fontSize: '0.875rem' }}>
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
              </div>
              {message.from === 'user' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#9ca3af', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ffffff', fontWeight: 'bold' }}>YOU</div>
              )}
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#d1d5db', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563', fontWeight: 'bold' }}>CB</div>
              <div style={{ borderRadius: '8px', padding: '8px 12px', backgroundColor: '#e5e7eb', color: '#1f2937' }}>
                <p style={{ fontSize: '0.875rem' }}>...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f9fafb' }}>
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading || !visitorId} // Disable if loading or visitorId is not set
            style={{ flexGrow: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !visitorId} // Disable if loading or visitorId is not set
            style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (isLoading || !visitorId) ? 0.7 : 1 }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterfaceTesting;