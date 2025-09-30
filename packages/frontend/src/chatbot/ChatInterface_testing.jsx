// File location: packages/frontend/src/chatbot/ChatInterface_testing.jsx
// Description: A simplified chatbot interface for testing purposes, without Shadcn UI components.
// Why this file exists: To provide a quick and easy way to test the backend RAG service without UI dependencies.
// Relevant files: packages/frontend/src/chatbot/ChatInterface.jsx, packages/frontend/src/main.jsx, packages/backend/src/index.js, packages/backend/src/rag-service.js

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../config/apiClient';
import { detectEventType, extractContactInfo, logEvent } from '../utils/eventLogging.js';

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
  const [suggestedQuestions, setSuggestedQuestions] = useState([]); // State for suggested questions at bottom
  const [questionCount, setQuestionCount] = useState(0); // Track number of questions asked
  const [chatStartTime, setChatStartTime] = useState(null); // Track chat start time
  const [currentLeadScore, setCurrentLeadScore] = useState(0); // Track current lead score
  const messagesEndRef = useRef(null);

  // Onboarding state
  const [onboarding, setOnboarding] = useState({
    started: false,
    completed: false,
    step: 0,
    answers: {
      typology: null,
      budget_bucket: null,
      buying_timeframe: null,
      name: '',
      email: '',
      consent_marketing: false,
    },
  });
  const [onboardingConfig, setOnboardingConfig] = useState(null);

  // Hardcode client ID for testing purposes as requested by the user
  const TEST_CLIENT_ID = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';

  useEffect(() => {
    setSessionId(generateUUID());
    setChatStartTime(Date.now()); // Initialize chat start time

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

    // Load onboarding config
    const loadOnboardingConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/widget/config/${TEST_CLIENT_ID}`);
        const config = await response.json();
        setOnboardingConfig(config.onboardingConfig || null);
      } catch (error) {
        console.error('Failed to load onboarding config:', error);
        setOnboardingConfig(null);
      }
    };

    loadOnboardingConfig();
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


  const handleSend = async (messageText = null) => {
    const textToSend = messageText || input.trim();
    if (textToSend) {
      // Check if onboarding should start
      if (!onboarding.completed && !onboarding.started && onboardingConfig?.enabled !== false) {
        setOnboarding(prev => ({ ...prev, started: true, step: 1 }));

        const introMsg = {
          from: 'bot',
          text: onboardingConfig?.introMessage || 'Antes de continuar, posso fazer 3 perguntas rápidas para recomendar os melhores apartamentos? (leva < 30s)',
        };
        setMessages(prev => [...prev, introMsg]);
        return;
      }

      const userMessage = { from: 'user', text: textToSend };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setSuggestedQuestions([]); // Clear suggested questions when sending any message
      setIsLoading(true);

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': TEST_CLIENT_ID, // Use hardcoded client ID
          },
          body: JSON.stringify({
            query: textToSend,
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

        // Store suggested questions at bottom instead of as messages
        if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
          setSuggestedQuestions(data.suggestedQuestions);
        } else {
          setSuggestedQuestions([]);
        }

        // === EVENT LOGGING SECTION ===
        if (visitorId) {
          // 1. Log the question-based event
          const eventType = detectEventType(textToSend);
          await logEvent(visitorId, eventType, TEST_CLIENT_ID, selectedListingId, setCurrentLeadScore);

          // 2. Update question count and log engagement events
          setQuestionCount(prev => {
            const newCount = prev + 1;

            // Log question count events
            if (newCount >= 3 && newCount <= 5) {
              logEvent(visitorId, 'QUESTIONS_3_5', TEST_CLIENT_ID, selectedListingId, setCurrentLeadScore);
            } else if (newCount >= 6 && newCount <= 10) {
              logEvent(visitorId, 'QUESTIONS_6_10', TEST_CLIENT_ID, selectedListingId, setCurrentLeadScore);
            } else if (newCount > 10) {
              logEvent(visitorId, 'QUESTIONS_10_PLUS', TEST_CLIENT_ID, selectedListingId, setCurrentLeadScore);
            }

            return newCount;
          });

          // 3. Check for contact information and log conversion event
          const contactInfo = extractContactInfo(textToSend);
          if (contactInfo.email || contactInfo.phone) {
            console.log('📧 Contact info detected:', contactInfo);
            await logEvent(visitorId, 'SUBMITTED_CONTACT', TEST_CLIENT_ID, selectedListingId, setCurrentLeadScore);
          }

          // 4. Check chat duration and log time-based events
          if (chatStartTime) {
            const chatDuration = Date.now() - chatStartTime;
            const minutesInChat = Math.floor(chatDuration / (1000 * 60));

            if (minutesInChat >= 5 && minutesInChat < 10) {
              await logEvent(visitorId, 'TIME_5_10_MIN', TEST_CLIENT_ID, selectedListingId, setCurrentLeadScore);
            } else if (minutesInChat >= 10) {
              await logEvent(visitorId, 'TIME_10_PLUS_MIN', TEST_CLIENT_ID, selectedListingId, setCurrentLeadScore);
            }
          }
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        const errorMessage = { from: 'bot', text: 'Sorry, I am having trouble connecting.' };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };


  // Onboarding helper functions
  const setOnboardingAnswer = (field, value) => {
    setOnboarding(prev => ({
      ...prev,
      answers: { ...prev.answers, [field]: value },
    }));
  };

  const submitOnboarding = async () => {
    if (!visitorId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/v1/visitors/${visitorId}/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': TEST_CLIENT_ID,
        },
        body: JSON.stringify(onboarding.answers),
      });

      if (!response.ok) throw new Error('Failed to save onboarding');

      const data = await response.json();
      console.log('Onboarding saved:', data);

      setOnboarding(prev => ({ ...prev, completed: true }));

      // Show recommendations
      await showRecommendationsFromOnboarding();
    } catch (error) {
      console.error('Failed to submit onboarding:', error);
      // Show error message
      const errorMsg = { from: 'bot', text: 'Não foi possível guardar as respostas. Pode tentar novamente?' };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const showRecommendationsFromOnboarding = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': TEST_CLIENT_ID,
        },
        body: JSON.stringify({
          query: "Mostre-me recomendações de apartamentos baseadas nas minhas preferências do onboarding",
          context: null, // No specific listing context
          session_id: sessionId,
          visitor_id: visitorId,
          clientId: TEST_CLIENT_ID,
          onboardingContext: onboarding.answers // Pass onboarding data
        }),
      });

      const data = await response.json();
      const recMsg = { from: 'bot', text: data.response };
      setMessages(prev => [...prev, recMsg]);

      // Handle suggested questions if any
      if (data.suggestedQuestions) {
        setSuggestedQuestions(data.suggestedQuestions);
      }
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      const errorMsg = { from: 'bot', text: 'Desculpe, ocorreu um erro ao obter recomendações. Pode tentar novamente?' };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleSuggestedClick = (question) => {
    // Clear suggested questions and send as regular user message
    setSuggestedQuestions([]);
    handleSend(question);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
      <div style={{ width: '440px', height: '700px', display: 'grid', gridTemplateRows: 'auto 1fr auto', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Chatbot (Testing)</h2>
            <div style={{
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              backgroundColor: currentLeadScore >= 70 ? '#dcfce7' : currentLeadScore >= 40 ? '#fef3c7' : '#fecaca',
              color: currentLeadScore >= 70 ? '#166534' : currentLeadScore >= 40 ? '#92400e' : '#991b1b',
              border: `1px solid ${currentLeadScore >= 70 ? '#bbf7d0' : currentLeadScore >= 40 ? '#fde68a' : '#fca5a5'}`
            }}>
              Lead Score: {currentLeadScore}
              {currentLeadScore >= 70 ? ' 🔥 Hot Lead' : currentLeadScore >= 40 ? ' 🟡 Warm Lead' : ' 🆕 New Lead'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div>
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
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Questions: {questionCount} | Events logged: ✅
            </div>
          </div>
        </div>
        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((message, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: message.from === 'user' ? 'flex-end' : 'flex-start' }}>
              {message.from === 'bot' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#d1d5db', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563', fontWeight: 'bold' }}>CB</div>
              )}
              <div style={{
                borderRadius: '8px',
                padding: '8px 12px',
                backgroundColor: message.from === 'user' ? '#3b82f6' : '#e5e7eb',
                color: message.from === 'user' ? '#ffffff' : '#1f2937'
              }}>
                <div style={{ fontSize: '0.875rem' }}>
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
              </div>
              {message.from === 'user' && (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#9ca3af',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#ffffff',
                  fontWeight: 'bold'
                }}>
                  YOU
                </div>
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
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          {/* Onboarding UI */}
          {onboarding.started && !onboarding.completed && onboardingConfig?.questions && Array.isArray(onboardingConfig.questions) && (
            <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              {onboardingConfig.questions.map((question, index) => {
                const step = index + 1;
                if (onboarding.step !== step) return null;

                if (question.type === 'select') {
                  return (
                    <div key={question.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontWeight: '600' }}>{question.question}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {question.options.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setOnboardingAnswer(question.id, opt.value)}
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              backgroundColor: onboarding.answers[question.id] === opt.value ? '#3b82f6' : '#ffffff',
                              color: onboarding.answers[question.id] === opt.value ? '#ffffff' : '#374151',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {onboarding.answers[question.id] && (
                        <button
                          onClick={() => setOnboarding(prev => ({ ...prev, step: step + 1 }))}
                          style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-end' }}
                        >
                          Seguinte
                        </button>
                      )}
                    </div>
                  );
                } else if (question.type === 'contact') {
                  return (
                    <div key={question.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontWeight: '600' }}>{question.question}</div>
                      {question.fields.map(field => (
                        <input
                          key={field.id}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={onboarding.answers[field.id] || ''}
                          onChange={(e) => setOnboardingAnswer(field.id, e.target.value)}
                          style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      ))}
                      {question.consent && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={onboarding.answers.consent_marketing || false}
                            onChange={(e) => setOnboardingAnswer('consent_marketing', e.target.checked)}
                          />
                          {question.consent.text}
                        </label>
                      )}
                      <button
                        onClick={submitOnboarding}
                        disabled={!question.fields.every(field => onboarding.answers[field.id])}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: (!question.fields.every(field => onboarding.answers[field.id])) ? '#d1d5db' : '#3b82f6',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: (!question.fields.every(field => onboarding.answers[field.id])) ? 'not-allowed' : 'pointer',
                          alignSelf: 'flex-end'
                        }}
                      >
                        Concluir
                      </button>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}

          {suggestedQuestions.length > 0 && (
            <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
              {suggestedQuestions.map((question, index) => (
                <div
                  key={index}
                  onClick={() => handleSuggestedClick(question)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    border: '1px solid #3b82f6',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                >
                  {question}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              onClick={() => handleSend()}
              disabled={isLoading || !visitorId} // Disable if loading or visitorId is not set
              style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (isLoading || !visitorId) ? 0.7 : 1 }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterfaceTesting;