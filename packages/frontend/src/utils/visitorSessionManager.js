/**
 * Visitor Session Manager
 * Handles visitor session persistence, validation, and recovery for testing interface
 */
class VisitorSessionManager {
  constructor(clientId, apiBaseUrl) {
    this.clientId = clientId;
    this.apiBaseUrl = apiBaseUrl;
    this.storageKey = `visitor_session_${clientId}`;
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get or create a valid visitor session
   * @returns {Promise<Object>} Session object with visitorId and sessionId
   */
  async getOrCreateSession() {
    try {
      // Try to recover existing session
      const existingSession = this.loadSession();
      if (existingSession && await this.validateSession(existingSession)) {
        console.log('[VisitorSession] Recovered valid session:', existingSession.visitorId);
        return existingSession;
      }

      // Create new session
      console.log('[VisitorSession] Creating new session');
      const newSession = await this.createNewSession();
      this.saveSession(newSession);
      return newSession;
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
   * Clear session from storage
   */
  clearSession() {
    localStorage.removeItem(this.storageKey);
    console.log('[VisitorSession] Session cleared');
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