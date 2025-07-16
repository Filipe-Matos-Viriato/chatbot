import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [externalContext, setExternalContext] = useState(null);
  const contextRef = useRef(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [visitorId, setVisitorId] = useState(null);

  // Visitor ID Management
  useEffect(() => {
    const initializeVisitor = async () => {
      let currentVisitorId = localStorage.getItem('visitor_id');

      // Check URL for visitor_id (e.g., from cross-domain navigation)
      const urlParams = new URLSearchParams(window.location.search);
      const urlVisitorId = urlParams.get('visitor_id');
      if (urlVisitorId) {
        currentVisitorId = urlVisitorId;
        localStorage.setItem('visitor_id', urlVisitorId);
      }

      if (!currentVisitorId) {
        try {
          // Replace with your actual backend URL
          const response = await fetch('http://localhost:3006/v1/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clientId: 'client-abc' }), // Hardcoded for now, will be dynamic
          });
          const data = await response.json();
          currentVisitorId = data.visitor_id;
          localStorage.setItem('visitor_id', currentVisitorId);
        } catch (error) {
          console.error('Failed to create visitor session:', error);
        }
      }
      setVisitorId(currentVisitorId);
      console.log('Initialized Visitor ID:', currentVisitorId);
    };

    initializeVisitor();
  }, []);

  // Listen for messages from the parent window
  useEffect(() => {
    const handleMessage = (event) => {
      // Ensure the message is from a trusted origin in a production environment
      // if (event.origin !== "http://your-parent-domain.com") return;
      console.log('Message received in iframe:', event); // Debugging log
      if (event.data && event.data.type === 'SET_CHATBOT_CONTEXT') {
        console.log('Received context from parent:', event.data.payload);
        setExternalContext(event.data.payload);
        contextRef.current = event.data.payload; // Update the ref
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);
  
  // // Fetch suggested questions - Temporarily disabled to avoid quota issues
  // useEffect(() => {
  //   const fetchSuggestions = async () => {
  //     try {
  //       const response = await fetch('http://localhost:3006/api/suggested-questions', {
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/json',
  //           'x-client-id': 'client-abc'
  //         },
  //         body: JSON.stringify({
  //           context: contextRef.current,
  //           chatHistory: chatHistory,
  //         }),
  //       });
  //       const data = await response.json();
  //       setSuggestedQuestions(data.questions || []);
  //     } catch (error) {
  //       console.error('Failed to fetch suggested questions:', error);
  //       setSuggestedQuestions([]);
  //     }
  //   };
  
  //   fetchSuggestions();
  // }, [chatHistory, externalContext]); // Re-fetch when history or context changes

  const trackEvent = async (eventType) => {
    if (!visitorId) {
      console.warn('Visitor ID not available, cannot track event:', eventType);
      return;
    }
    try {
      await fetch('http://localhost:3006/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': 'client-abc' // Hardcoded for now, will be dynamic
        },
        body: JSON.stringify({ visitorId, eventType }),
      });
      console.log(`Event '${eventType}' tracked for visitor ${visitorId}`);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  };
  
  const sendMessage = async (e, msg) => {
    if (e) e.preventDefault();
    const messageToSend = msg || message;
    if (!messageToSend.trim()) return;
  
    console.log('sendMessage called with:', messageToSend, 'Visitor ID:', visitorId); // Debugging log
  
    const userMessage = { sender: 'user', text: messageToSend };
    setChatHistory(prev => [...prev, userMessage]);
    setMessage(''); // Clear input immediately
    // setSuggestedQuestions([]); // Clear suggestions while waiting for a response - Commented out as suggestions are disabled

    // Example: Track a 'MESSAGE_SENT' event
    if (visitorId) { // Ensure visitorId is available before tracking
      trackEvent('MESSAGE_SENT', 1); // Assign a score impact for sending a message
    } else {
      console.warn('Visitor ID not available when sending message, event not tracked.');
    }
  
    try {
      const response = await fetch('http://localhost:3006/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': 'client-abc'
        },
        body: JSON.stringify({ query: messageToSend, context: contextRef.current }),
      });
      console.log('Response from /api/chat:', response); // Debugging log
      const data = await response.json();
      console.log('Data from /api/chat:', data); // Debugging log
      const botMessage = { sender: 'bot', text: data.response };
      setChatHistory(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Failed to send message (catch block):', error); // Debugging log
      const errorMessage = { sender: 'bot', text: 'Sorry, I am having trouble connecting.' };
      setChatHistory(prev => [...prev, errorMessage]);
    }
  };
  
  // const handleSuggestionClick = (question) => { // Commented out as suggestions are disabled
  //   sendMessage(null, question);
  // };
  
  return (
    <div className="chat-widget">
      <div className="chat-history">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
      </div>
      {/* Suggested questions are temporarily disabled to avoid quota issues */}
      {/* <div className="suggested-questions">
        {suggestedQuestions.map((q, i) => (
          <button key={i} onClick={() => handleSuggestionClick(q)} className="suggestion-btn">
            {q}
          </button>
        ))}
      </div> */}
      <form onSubmit={sendMessage} className="chat-input-form">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              sendMessage(e);
            }
          }}
          placeholder="Ask a question..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default App;