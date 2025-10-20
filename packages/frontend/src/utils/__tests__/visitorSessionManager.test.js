import { describe, it, expect, beforeEach, vi } from 'vitest';
import VisitorSessionManager from '../visitorSessionManager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = vi.fn();

describe('VisitorSessionManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new VisitorSessionManager('test-client', 'http://api.test');
  });

  describe('getOrCreateSession', () => {
    it('should recover valid existing session', async () => {
      const existingSession = {
        visitorId: 'visitor-123',
        sessionId: 'session-456',
        createdAt: Date.now()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingSession));
      global.fetch.mockResolvedValueOnce({ ok: true });

      const session = await manager.getOrCreateSession();

      expect(session).toEqual(existingSession);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://api.test/v1/visitor',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ visitorId: 'visitor-123' })
        })
      );
    });

    it('should handle session validation failure gracefully', async () => {
      const existingSession = {
        visitorId: 'visitor-123',
        sessionId: 'session-456',
        createdAt: Date.now()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingSession));
      global.fetch.mockResolvedValueOnce({ ok: false }); // Validation fails
      global.fetch.mockResolvedValueOnce({ // Create new session
        ok: true,
        json: () => Promise.resolve({ visitor_id: 'fallback-visitor-456' })
      });

      const session = await manager.getOrCreateSession();

      expect(session.visitorId).toBe('fallback-visitor-456');
      expect(session.sessionId).toMatch(/^session_/);
      expect(typeof session.createdAt).toBe('number');
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://api.test/v1/visitor', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ visitorId: 'visitor-123' })
      }));
      expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://api.test/v1/sessions', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ clientId: 'test-client' })
      }));
    });
  });

  describe('loadSession', () => {
    it('should return null for missing session', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(manager.loadSession()).toBeNull();
    });

    it('should return parsed session', () => {
      const session = { visitorId: 'test', sessionId: 'session', createdAt: Date.now() };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(session));

      expect(manager.loadSession()).toEqual(session);
    });

    it('should clear expired session', () => {
      const expiredSession = {
        visitorId: 'test',
        sessionId: 'session',
        createdAt: Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredSession));

      expect(manager.loadSession()).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('visitor_session_test-client');
    });
  });

  describe('validateSession', () => {
    it('should return true for valid session', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const isValid = await manager.validateSession({ visitorId: 'visitor-123' });

      expect(isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://api.test/v1/visitor',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ visitorId: 'visitor-123' })
        })
      );
    });

    it('should return false for invalid session', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false });

      const isValid = await manager.validateSession({ visitorId: 'visitor-123' });

      expect(isValid).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const isValid = await manager.validateSession({ visitorId: 'visitor-123' });

      expect(isValid).toBe(false);
    });
  });

  describe('createNewSession', () => {
    it('should create new session successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ visitor_id: 'new-visitor-123' })
      });

      const session = await manager.createNewSession();

      expect(session.visitorId).toBe('new-visitor-123');
      expect(session.sessionId).toMatch(/^session_/);
      expect(typeof session.createdAt).toBe('number');
    });

    it('should throw error on API failure', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(manager.createNewSession()).rejects.toThrow('Failed to create session: 500');
    });
  });

  describe('saveSession and clearSession', () => {
    it('should save session to localStorage', () => {
      const session = { visitorId: 'test', sessionId: 'session-123' };

      manager.saveSession(session);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'visitor_session_test-client',
        expect.stringContaining('"visitorId":"test"')
      );
    });

    it('should clear session from localStorage', () => {
      manager.clearSession();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('visitor_session_test-client');
    });
  });
});