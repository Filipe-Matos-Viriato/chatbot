# Dynamic Widget Configuration Implementation PRD

## Executive Summary

**Problem**: The widget currently loads hardcoded configurations instead of dynamic client settings from the database, preventing real-time updates when clients modify their settings in the admin dashboard.

**Root Cause**: Dual backend architecture where production uses `api/index.js` (hardcoded) instead of `packages/backend/src/index.js` (database-integrated).

**Solution**: Consolidate to single database-driven backend and eliminate hardcoded client configurations.

---

## Current System Analysis

### 🔴 Issues Identified

1. **Dual Backend Architecture**:
   - `api/index.js` - Vercel API with hardcoded Up Investments config
   - `packages/backend/src/index.js` - Full backend with database integration
   - Production deployment uses hardcoded version

2. **Hardcoded Client Configuration**:
   - Up Investments client (`e6f484a3-c3cb-4e01-b8ce-a276f4b7355c`) bypasses database
   - Widget settings, onboarding questions, and prompts are static
   - Changes in admin dashboard don't reflect in widget

3. **Configuration Loading Inconsistency**:
   - Admin dashboard works with database (`/v1/clients` endpoints)
   - Widget loads from hardcoded middleware (`/api/v1/widget/config/{clientId}`)
   - Two different data sources causing sync issues

---

## 🎯 **PHASE 1: Backend Consolidation (High Priority)**

### Task 1.1: Remove Hardcoded Client Configuration
**Objective**: Eliminate hardcoded fallback for Up Investments client

**Implementation**:
- [ ] Remove hardcoded client config from `clientConfigMiddleware` in `api/index.js` (lines 40-70)
- [ ] Remove hardcoded fallback in `/api/v1/widget/config/:clientId` endpoint (lines 574-695)
- [ ] Replace with database lookup using `client-config-service.js`
- [ ] Add proper error handling for missing client configurations

**Files to Modify**:
- `api/index.js`

**Dependencies**: Database migration script must be run first

### Task 1.2: Integrate Database Service in Vercel API
**Objective**: Use existing `client-config-service.js` in Vercel deployment

**Implementation**:
- [ ] Import `client-config-service.js` in `api/index.js`
- [ ] Replace hardcoded config logic with `getClientConfig(clientId)` calls
- [ ] Add Supabase connection to Vercel API environment
- [ ] Test database connectivity in Vercel environment

**Files to Modify**:
- `api/index.js`
- `.env.vercel` (add database credentials if missing)

**Dependencies**: Task 1.1 completion

### Task 1.3: Widget Configuration Endpoint Enhancement
**Objective**: Return complete client config including onboarding questions

**Implementation**:
- [ ] Modify `/api/v1/widget/config/:clientId` to return full client configuration
- [ ] Include `default_onboarding_questions` field in response
- [ ] Add `widgetSettings` derived from client theme settings
- [ ] Ensure proper error handling for missing configurations

**Expected Response Format**:
```json
{
  "clientId": "e6f484a3-c3cb-4e01-b8ce-a276f4b7355c",
  "clientName": "Up Investments",
  "chatbotName": "Real Estate Chatbot",
  "theme": { "primaryColor": "#007bff" },
  "urlPattern": "https://upinvestments.pt/...",
  "prompts": { "systemInstruction": "..." },
  "widgetSettings": { "primaryColor": "#007bff" },
  "default_onboarding_questions": { "questions": [...] }
}
```

---

## 🚀 **PHASE 2: Widget Integration (Medium Priority)**

### Task 2.1: Widget Onboarding Questions Loading
**Objective**: Widget dynamically loads client-specific onboarding questions

**Implementation**:
- [ ] Modify `packages/widget/src/App.jsx` `loadConfig()` method
- [ ] Extract `default_onboarding_questions` from config response
- [ ] Store onboarding questions in widget state
- [ ] Use client-specific questions instead of hardcoded templates

**Files to Modify**:
- `packages/widget/src/App.jsx`

### Task 2.2: Widget Settings Dynamic Loading
**Objective**: Widget appearance reflects admin dashboard settings

**Implementation**:
- [ ] Use `theme.primaryColor` for widget styling
- [ ] Apply `widgetSettings.welcomeMessage` as default message
- [ ] Use `widgetSettings.headerText` for chat header
- [ ] Implement CSS variable injection for dynamic theming

**Files to Modify**:
- `packages/widget/src/App.jsx`
- `packages/widget/src/styles.css`

---

## 🔧 **PHASE 3: Admin Dashboard Integration (Medium Priority)**

### Task 3.1: Real-time Widget Preview
**Objective**: Admin dashboard shows how changes will appear in widget

**Implementation**:
- [ ] Add "Preview Widget" button in `EditClientForm.jsx`
- [ ] Create widget preview modal component
- [ ] Simulate widget with current form data (before save)
- [ ] Show onboarding questions preview in widget context

**Files to Create/Modify**:
- `packages/frontend/src/dashboard/admin-dashboard/components/WidgetPreview.jsx` (new)
- `packages/frontend/src/dashboard/admin-dashboard/components/EditClientForm.jsx`

### Task 3.2: Widget Settings Editor
**Objective**: Dedicated UI for widget-specific settings

**Implementation**:
- [ ] Create `WidgetSettingsEditor.jsx` component
- [ ] Add fields for `welcomeMessage`, `headerText`, `primaryColor`
- [ ] Integrate with existing `EditClientForm.jsx`
- [ ] Add validation for color hex codes

**Files to Create/Modify**:
- `packages/frontend/src/dashboard/admin-dashboard/components/WidgetSettingsEditor.jsx` (new)
- `packages/frontend/src/dashboard/admin-dashboard/components/EditClientForm.jsx`

---

## 🧪 **PHASE 4: Testing & Validation (High Priority)**

### Task 4.1: End-to-End Testing Suite
**Objective**: Verify complete configuration flow works

**Test Cases**:
- [ ] Admin saves onboarding questions → Widget loads new questions
- [ ] Admin changes widget theme → Widget appearance updates
- [ ] Admin modifies prompts → Chatbot behavior changes
- [ ] Client without configuration → Proper error handling

### Task 4.2: Production Deployment Testing
**Objective**: Verify changes work on upinvestments.pt

**Implementation**:
- [ ] Deploy to staging environment first
- [ ] Test widget configuration loading from database
- [ ] Verify onboarding questions appear correctly
- [ ] Test admin dashboard → widget update flow
- [ ] Performance testing for database queries

---

## 📊 **PHASE 5: Performance & Monitoring (Low Priority)**

### Task 5.1: Configuration Caching
**Objective**: Reduce database queries for widget configurations

**Implementation**:
- [ ] Add Redis/memory caching for client configurations
- [ ] Cache invalidation when admin saves changes
- [ ] Set appropriate TTL (Time To Live) for cached configs
- [ ] Add cache hit/miss metrics

### Task 5.2: Configuration Change Monitoring
**Objective**: Track when and what client configurations change

**Implementation**:
- [ ] Add audit log for client configuration changes
- [ ] Track which admin user made changes
- [ ] Log previous vs new values for troubleshooting
- [ ] Add admin dashboard analytics for config changes

---

## 🚨 **Critical Dependencies & Prerequisites**

### Database Requirements
- [ ] Verify `clients` table has `default_onboarding_questions` column
- [ ] Ensure database migrations from `DATABASE_MIGRATION_MANUAL.md` are applied
- [ ] Confirm Supabase connection works in Vercel environment

### Environment Configuration
- [ ] Verify `.env.vercel` has all required database credentials
- [ ] Test Supabase connection from Vercel deployment
- [ ] Ensure API rate limits support widget traffic

### Backwards Compatibility
- [ ] Ensure existing widgets continue working during transition
- [ ] Graceful degradation if database is unavailable
- [ ] Default fallback configurations for new clients

---

## 🎯 **Success Criteria**

### Primary Goals
1. **Real-time Updates**: Changes in admin dashboard immediately reflected in widget
2. **Database-driven**: All client configurations loaded from Supabase
3. **No Hardcoded Configs**: Elimination of static client configurations

### Secondary Goals
4. **Performance**: Widget loads within 2 seconds
5. **Error Handling**: Graceful fallbacks for missing configurations
6. **Scalability**: System supports multiple clients without hardcoding

### Validation Tests
- [ ] Admin updates onboarding questions → Widget shows new questions within 1 minute
- [ ] Admin changes theme color → Widget reflects new color immediately  
- [ ] New client created → Widget works without code changes
- [ ] Database unavailable → Widget shows graceful error message

---

## 📋 **Implementation Priority**

### Sprint 1 (Week 1): Foundation
- Task 1.1: Remove hardcoded configurations
- Task 1.2: Integrate database service
- Task 4.1: Basic testing setup

### Sprint 2 (Week 2): Widget Integration  
- Task 1.3: Enhanced widget config endpoint
- Task 2.1: Widget onboarding loading
- Task 4.2: Production testing

### Sprint 3 (Week 3): Admin Enhancement
- Task 2.2: Dynamic widget styling
- Task 3.1: Widget preview
- Task 3.2: Widget settings editor

### Sprint 4 (Week 4): Polish & Monitoring
- Task 5.1: Performance optimization
- Task 5.2: Change monitoring
- Final production deployment

---

## 🔗 **Related Documentation**
- `DATABASE_MIGRATION_MANUAL.md` - Required database schema changes
- `ONBOARDING_QUESTIONS_PRD.md` - Onboarding system architecture
- `EMBEDDABLE_CHATBOT_WIDGET_PRD.md` - Widget technical specifications