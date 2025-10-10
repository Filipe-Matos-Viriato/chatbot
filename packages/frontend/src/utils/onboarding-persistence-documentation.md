# Onboarding Persistence Feature Documentation

## Overview

The Onboarding Persistence feature ensures that users who have completed the chatbot onboarding process are not prompted to complete it again when they return to the chat interface. This improves user experience by eliminating redundant onboarding flows while maintaining the ability to provide personalized recommendations based on previously collected preferences.

## Problem Solved

**Before:** Users would be re-prompted for onboarding information every time they refreshed the page or returned to the chat, even if they had already completed the onboarding process.

**After:** The system remembers completed onboarding and seamlessly continues conversations with personalized context.

## Architecture

### Components

1. **Backend API Endpoint** (`/v1/visitors/:visitorId/onboarding-status`)
   - Checks if visitor has completed onboarding
   - Returns onboarding status and data
   - Implements caching for performance

2. **VisitorSessionManager** (Frontend)
   - Manages session persistence with onboarding status
   - Handles session recovery and validation
   - Includes performance monitoring

3. **ChatInterface Testing** (Frontend)
   - Skips onboarding for completed users
   - Maintains onboarding state across sessions
   - Provides seamless user experience

4. **VisitorService** (Backend)
   - Caches onboarding status checks (5-minute TTL)
   - Validates onboarding completion logic
   - Handles database queries efficiently

## Implementation Details

### Onboarding Completion Detection

Onboarding is considered complete when all required fields are populated in the `visitors` table:

- `tipologia` (property type preference)
- `budget` (budget range)
- `name` (user's name)
- `email` (contact email)

### API Endpoints

#### GET `/v1/visitors/:visitorId/onboarding-status`

**Request:**
```http
GET /v1/visitors/{visitorId}/onboarding-status
Headers:
  x-client-id: {clientId}
```

**Response:**
```json
{
  "visitor_id": "visitor_123456789",
  "onboarding_completed": true,
  "onboarding_data": {
    "typology": "T2",
    "budget": 250000,
    "name": "João Silva",
    "email": "joao@example.com"
  }
}
```

**Error Response:**
```json
{
  "error": "Visitor not found"
}
```

### Caching Strategy

- **Backend Cache:** 5-minute TTL in VisitorService
- **Frontend Cache:** Session-based localStorage persistence
- **Cache Keys:** `onboarding_status_{clientId}:{visitorId}`

### Session Management

The VisitorSessionManager now includes onboarding status in session data:

```javascript
{
  visitorId: "visitor_123",
  sessionId: "session_456",
  onboarding_completed: true,
  onboarding_data: { /* ... */ },
  createdAt: 1640995200000
}
```

## User Flow

### New User (First Visit)
1. User loads chat interface
2. Session created, onboarding status checked → `false`
3. User sends first message → onboarding starts
4. User completes onboarding → data saved
5. Onboarding marked as completed

### Returning User (Onboarding Completed)
1. User loads chat interface
2. Session recovered, onboarding status checked → `true`
3. Onboarding UI skipped
4. Chat continues with personalized context
5. Previous preferences used for recommendations

### Session Recovery
1. User refreshes page or returns later
2. Session recovered from localStorage
3. Onboarding status refreshed from API
4. UI state restored appropriately

## Performance Considerations

### Metrics Monitored
- API response time (< 500ms target)
- Cache hit rate (> 80% target)
- Session initialization time (< 2 seconds)
- Error rate (< 1%)

### Optimizations
- 5-minute caching reduces database load
- Efficient queries with proper indexing
- Graceful error handling with fallbacks
- Performance logging for monitoring

## Error Handling

### Graceful Degradation
- If onboarding status API fails → assume not completed (fallback to onboarding)
- If session recovery fails → create new session
- If localStorage unavailable → continue without persistence

### Error Scenarios
1. **API Timeout:** Falls back to onboarding flow
2. **Invalid Session:** Creates new session
3. **Database Error:** Returns cached data if available
4. **Network Issues:** Continues with local session data

## Testing

### Manual Testing Checklist
- [ ] Complete onboarding flow
- [ ] Refresh page → verify no re-prompt
- [ ] Close/reopen browser → verify persistence
- [ ] Clear localStorage → verify graceful handling
- [ ] API failure simulation → verify fallback

### Automated Testing
- Unit tests for VisitorSessionManager
- Integration tests for API endpoints
- E2E tests for complete user flows

## Monitoring & Logging

### Key Metrics
```javascript
// Performance monitoring
console.log(`[VisitorSession] Onboarding status API call took ${duration}ms`);

// Status logging
console.log(`[Onboarding Status] Visitor ${visitorId} onboarding completed: ${completed}`);
```

### Alert Conditions
- API response time > 1 second
- Error rate > 5%
- Cache miss rate > 50%

## Future Enhancements

### Potential Improvements
1. **Cross-device sync:** Sync onboarding status across devices
2. **Onboarding updates:** Allow users to update preferences
3. **Partial completion:** Handle partially completed onboarding
4. **Analytics:** Track onboarding completion rates

### Configuration Options
- Configurable cache TTL
- Customizable completion criteria
- Client-specific onboarding flows

## Files Modified

### Backend
- `packages/backend/src/index.js` - Added API endpoint
- `packages/backend/src/services/visitor-service.js` - Added caching and status method

### Frontend
- `packages/frontend/src/utils/visitorSessionManager.js` - Enhanced with onboarding status
- `packages/frontend/src/chatbot/ChatInterface_testing.jsx` - Updated onboarding logic

## Deployment Notes

### Backward Compatibility
- Existing sessions without onboarding status handled gracefully
- API endpoint optional for other interfaces
- No breaking changes to existing functionality

### Rollback Plan
1. Disable feature flag in VisitorSessionManager
2. Remove onboarding status checks
3. Clear cached session data
4. Monitor for any issues

## Success Criteria

✅ **Functional:** Users with completed onboarding skip the flow on return visits
✅ **Performance:** < 500ms API response time, < 2s session initialization
✅ **Reliability:** < 1% error rate, graceful fallbacks
✅ **User Experience:** Seamless continuation of conversations
✅ **Maintainability:** Clear logging, comprehensive error handling

---

**Implementation Date:** October 2025
**Status:** ✅ Completed and Deployed
**Version:** 1.0