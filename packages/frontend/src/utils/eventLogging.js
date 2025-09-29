// packages/frontend/src/utils/eventLogging.js
// Shared utilities for event logging and lead scoring across chat interfaces.
// This module provides reusable functions for detecting event types, extracting contact info, and logging events.
// Relevant files: chatbot/ChatInterface.jsx, chatbot/ChatInterface_testing.jsx, config/apiClient.js

import { API_BASE_URL } from '../config/apiClient';

/**
 * Detect event type based on message content analysis
 * @param {string} messageText - The user's message text
 * @returns {string} - The detected event type
 */
export const detectEventType = (messageText) => {
  const text = messageText.toLowerCase();

  // Question Intent & Quality events (10 points each)
  if (text.includes('preço') || text.includes('custo') || text.includes('valor') || text.includes('price') || text.includes('cost')) {
    return 'ASKED_PRICING';
  }
  if (text.includes('localização') || text.includes('zona') || text.includes('área') || text.includes('location') || text.includes('area')) {
    return 'ASKED_LOCATION';
  }
  if (text.includes('legal') || text.includes('contrato') || text.includes('documentos') || text.includes('advogado') || text.includes('legal') || text.includes('contract') || text.includes('documents')) {
    return 'ASKED_LEGAL';
  }
  if (text.includes('remoto') || text.includes('online') || text.includes('remote') || text.includes('virtual')) {
    return 'ASKED_REMOTE_BUYING';
  }
  if (text.includes('detalhes') || text.includes('características') || text.includes('details') || text.includes('features')) {
    return 'ASKED_DETAILS';
  }
  if (text.includes('disponibilidade') || text.includes('disponível') || text.includes('availability') || text.includes('available')) {
    return 'ASKED_AVAILABILITY';
  }

  // Conversion events
  if (text.includes('contacto') || text.includes('contato') || text.includes('email') || text.includes('telefone') || text.includes('phone') || text.includes('contact')) {
    return 'ASKED_CONTACT_AGENT';
  }
  if (text.includes('visita') || text.includes('visitar') || text.includes('viewing') || text.includes('visit')) {
    return 'BOOKED_VIEWING';
  }
  if (text.includes('brochura') || text.includes('folheto') || text.includes('brochure') || text.includes('catalog')) {
    return 'REQUESTED_BROCHURE';
  }

  // Default to general question
  return 'GENERAL_QUESTION';
};

/**
 * Extract contact information from message text
 * @param {string} messageText - The user's message text
 * @returns {Object} - Object with email and phone properties
 */
export const extractContactInfo = (messageText) => {
  const contactInfo = { email: null, phone: null };

  // Email regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emailMatch = messageText.match(emailRegex);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }

  // Phone regex (Portuguese format)
  const phoneRegex = /(\+351\s?)?[9|2|3]\d{1,2}(\s|\.)?\d{3}(\s|\.)?\d{3}/g;
  const phoneMatch = messageText.match(phoneRegex);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0].replace(/[\s\.]/g, '');
  }

  return contactInfo;
};

/**
 * Log an event to the backend and optionally update lead score display
 * @param {string} visitorId - The visitor ID
 * @param {string} eventType - The type of event to log
 * @param {string} clientId - The client ID
 * @param {string} listingId - Optional listing ID
 * @param {Function} setCurrentLeadScore - Optional callback to update lead score display
 * @returns {Promise<void>}
 */
export const logEvent = async (visitorId, eventType, clientId, listingId = null, setCurrentLeadScore = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
      },
      body: JSON.stringify({
        visitorId,
        eventType,
        clientId,
        listingId
      }),
    });

    const data = await response.json();
    if (data.success) {
      console.log(`✅ Event '${eventType}' logged. New score: ${data.new_lead_score}`);
      // Update the displayed lead score if callback provided
      if (setCurrentLeadScore) {
        setCurrentLeadScore(data.new_lead_score);
      }
    } else {
      console.error(`❌ Failed to log event '${eventType}':`, data);
    }
  } catch (error) {
    console.error('Error logging event:', error);
  }
};