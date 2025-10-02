import VisitorSessionManager from '../visitorSessionManager';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

describe('VisitorSessionManager', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
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

    it('should create new session when none exists', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ visitor_id: 'new-visitor-123' })
      });

      const session = await manager.getOrCreateSession();

      expect(session.visitorId).toBe('new-visitor-123');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should handle session validation failure', async () => {
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
});