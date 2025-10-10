// File location: packages/frontend/src/utils/visitorSessionManager.js
// Description: Manages visitor sessions with onboarding status persistence for the chatbot testing interface.
// Why this file exists: To provide session management that remembers if a visitor has completed onboarding, preventing re-prompting.
// Relevant files: packages/frontend/src/chatbot/ChatInterface_testing.jsx, packages/backend/src/services/visitor-service.js, packages/backend/src/index.js

import { API_BASE_URL } from '../config/apiClient';

/**
 * Visitor Session Manager
 * Handles visitor session persistence, validation, and recovery for testing interface
 * Now includes onboarding status tracking to prevent re-prompting completed users
 * Includes session deduplication to prevent multiple visitor records
 */
class VisitorSessionManager {
  constructor(clientId, apiBaseUrl = API_BASE_URL) {
    this.clientId = clientId;
    this.apiBaseUrl = apiBaseUrl;
    this.storageKey = `visitor_session_${clientId}`;
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.sessionPromise = null; // For preventing concurrent session creation
  }

  /**
   * Get or create a valid visitor session with onboarding status
   * Uses promise-based synchronization to prevent concurrent session creation
   * @returns {Promise<Object>} Session object with visitorId, sessionId, and onboarding status
   */
  async getOrCreateSession() {
    // If a session creation is already in progress, wait for it
    if (this.sessionPromise) {
      console.log('[VisitorSession] Waiting for existing session creation...');
      return await this.sessionPromise;
    }

    // Start session creation and store the promise to prevent concurrent calls
    this.sessionPromise = this._getOrCreateSessionInternal();

    try {
      const result = await this.sessionPromise;
      return result;
    } finally {
      // Clear the promise after completion
      this.sessionPromise = null;
    }
  }

  async _getOrCreateSessionInternal() {
    try {
      // Try to recover existing session
      const existingSession = this.loadSession();
      if (existingSession && await this.validateSession(existingSession)) {
        console.log('[VisitorSession] Recovered valid session:', existingSession.visitorId);
        // Refresh onboarding status for recovered sessions
        const onboardingStatus = await this.getOnboardingStatus(existingSession.visitorId);
        const sessionWithOnboarding = { ...existingSession, ...onboardingStatus };
        this.saveSession(sessionWithOnboarding);
        return sessionWithOnboarding;
      }

      // Double-check localStorage in case another instance saved a session
      const doubleCheckSession = this.loadSession();
      if (doubleCheckSession && await this.validateSession(doubleCheckSession)) {
        console.log('[VisitorSession] Found session on double-check:', doubleCheckSession.visitorId);
        const onboardingStatus = await this.getOnboardingStatus(doubleCheckSession.visitorId);
        const sessionWithOnboarding = { ...doubleCheckSession, ...onboardingStatus };
        this.saveSession(sessionWithOnboarding);
        return sessionWithOnboarding;
      }

      // Create new session
      console.log('[VisitorSession] Creating new session');
      const newSession = await this.createNewSession();

      // Clean up any old sessions for this client
      this.cleanupOldSessions();

      // Get onboarding status for new session
      const onboardingStatus = await this.getOnboardingStatus(newSession.visitorId);
      const sessionWithOnboarding = { ...newSession, ...onboardingStatus };
      this.saveSession(sessionWithOnboarding);
      return sessionWithOnboarding;
    } catch (error) {
      console.error('[VisitorSession] Session management error:', error);
      throw error;
    }
  }

  /**
   * Load session from storage
   * @returns {Object|null} Session object or null
   */
  loadSession() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;

      const session = JSON.parse(stored);

      // Check if session is expired
      if (Date.now() - session.createdAt > this.sessionTimeout) {
        console.log('[VisitorSession] Session expired, removing');
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('[VisitorSession] Error loading session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Save session to storage
   * @param {Object} session - Session object to save
   */
  saveSession(session) {
    try {
      const sessionWithTimestamp = {
        ...session,
        createdAt: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(sessionWithTimestamp));
      console.log('[VisitorSession] Session saved:', session.visitorId);
    } catch (error) {
      console.error('[VisitorSession] Error saving session:', error);
    }
  }

  /**
   * Validate session with backend
   * @param {Object} session - Session to validate
   * @returns {Promise<boolean>} True if session is valid
   */
  async validateSession(session) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/visitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: session.visitorId })
      });
      return response.ok;
    } catch (error) {
      console.warn('[VisitorSession] Validation failed:', error.message);
      return false;
    }
  }

  /**
   * Create new session via backend
   * @returns {Promise<Object>} New session object
   */
  async createNewSession() {
    const response = await fetch(`${this.apiBaseUrl}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: this.clientId })
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    const data = await response.json();
    return {
      visitorId: data.visitor_id,
      sessionId: `session_${Date.now()}`,
      createdAt: Date.now()
    };
  }

  /**
   * Get onboarding status for a visitor
   * @param {string} visitorId - Visitor ID
   * @returns {Promise<Object>} Onboarding status object
   */
  async getOnboardingStatus(visitorId) {
    const startTime = performance.now();
    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/visitors/${visitorId}/onboarding-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`[VisitorSession] Onboarding status API call took ${duration.toFixed(2)}ms`);

      if (!response.ok) {
        console.warn(`[VisitorSession] Failed to get onboarding status: ${response.status} (${duration.toFixed(2)}ms)`);
        return {
          onboarding_completed: false,
          onboarding_data: null
        };
      }

      const data = await response.json();
      console.log(`[VisitorSession] Onboarding status for ${visitorId}: completed=${data.onboarding_completed} (${duration.toFixed(2)}ms)`);
      return {
        onboarding_completed: data.onboarding_completed,
        onboarding_data: data.onboarding_data
      };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.warn(`[VisitorSession] Error getting onboarding status after ${duration.toFixed(2)}ms:`, error.message);
      return {
        onboarding_completed: false,
        onboarding_data: null
      };
    }
  }

  /**
   * Clear session from storage
   */
  clearSession() {
    localStorage.removeItem(this.storageKey);
    console.log('[VisitorSession] Session cleared');
  }

  /**
   * Clean up old sessions for this client (keeps only the most recent)
   * Helps prevent accumulation of stale sessions
   */
  cleanupOldSessions() {
    try {
      // Look for any other session keys for this client
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`visitor_session_${this.clientId}_`) && key !== this.storageKey) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('[VisitorSession] Cleaned up old session:', key);
      });

      if (keysToRemove.length > 0) {
        console.log(`[VisitorSession] Cleaned up ${keysToRemove.length} old sessions`);
      }
    } catch (error) {
      console.warn('[VisitorSession] Error during cleanup:', error);
    }
  }

  /**
   * Get current session without validation
   * @returns {Object|null} Current session or null
   */
  getCurrentSession() {
    return this.loadSession();
  }
}

export default VisitorSessionManager;