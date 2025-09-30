# Onboarding Questions Feature Implementation Plan

## Executive Summary

This document outlines a comprehensive implementation plan to restore and enhance the onboarding questions feature for the RAG chatbot system. The plan includes per-client enable/disable functionality, dynamic question loading from database configuration, and restoration of the feature in the testing interface.

**Key Objectives:**
- Add per-client enable/disable toggle for onboarding questions
- Restore onboarding flow in `ChatInterface_testing.jsx`
- Implement dynamic question loading from client configuration
- Ensure backward compatibility and graceful degradation
- Maintain performance and reliability standards

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Requirements](#2-requirements)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Backend Implementation](#5-backend-implementation)
6. [Frontend Implementation](#6-frontend-implementation)
7. [Testing Strategy](#7-testing-strategy)
8. [Deployment Plan](#8-deployment-plan)
9. [Monitoring & Rollback](#9-monitoring--rollback)

---

## 1. Current State Analysis

### 1.1 Existing Implementation Status

**✅ Functional Components:**
- Backend API endpoint: `POST /v1/visitors/:visitorId/onboarding`
- Service methods: `visitor-service.js` (saveOnboarding, computeLeadScoreFromOnboarding)
- Database schema: `visitors.onboarding_questions`, `clients.default_onboarding_questions`
- Widget UI: Hardcoded questions in `packages/widget/src/App.jsx`

**❌ Missing Components:**
- Per-client enable/disable flag
- Dynamic question loading from database
- Onboarding in testing interface (`ChatInterface_testing.jsx`)
- Client configuration validation

### 1.2 Current Limitations

- Onboarding questions are hardcoded in Portuguese
- No way to disable onboarding per client
- Testing interface lacks onboarding flow
- Questions not configurable through admin interface

---

## 2. Requirements

### 2.1 Functional Requirements

**FR-1: Per-Client Enable/Disable**
- Add `onboarding_enabled` boolean field to `clients` table
- Default value: `true` for backward compatibility
- Widget and backend must check this flag before starting onboarding

**FR-2: Dynamic Question Loading**
- Load questions from `clients.default_onboarding_questions` JSONB column
- Support multiple languages and client-specific content
- Fallback to hardcoded questions if database config unavailable

**FR-3: Testing Interface Restoration**
- Implement complete onboarding flow in `ChatInterface_testing.jsx`
- Match functionality of production widget
- Include proper state management and UI

**FR-4: Configuration Management**
- Admin interface support for onboarding settings
- Validation of question configurations
- Runtime configuration updates

### 2.2 Non-Functional Requirements

**NFR-1: Performance**
- Onboarding check: <10ms latency
- Question loading: <50ms
- No impact on chat response time

**NFR-2: Reliability**
- Graceful degradation if database unavailable
- Fallback to hardcoded questions
- Error handling for malformed configurations

**NFR-3: Maintainability**
- Clean separation of concerns
- Comprehensive logging
- Easy configuration updates

---

## 3. Architecture Overview

### 3.1 System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin UI      │    │   Database       │    │   Testing UI    │
│                 │    │                  │    │                 │
│ • Configure     │◄──►│ • clients table  │◄──►│ • Onboarding    │
│   onboarding    │    │   - onboarding_  │    │   flow          │
│ • Enable/disable│    │     enabled      │    │ • Dynamic       │
└─────────────────┘    │   - default_      │    │   questions     │
                       │     onboarding_  │    └─────────────────┘
                       │     questions    │
                       └─────────────────┘
                                ▲
                                │
                       ┌─────────────────┐
                       │   Production    │
                       │   Widget        │
                       │                 │
                       │ • Check flag    │
                       │ • Load config   │
                       │ • Onboarding UI │
                       └─────────────────┘
```

### 3.2 Data Flow

1. **Configuration Phase:**
   - Admin sets `onboarding_enabled` and `default_onboarding_questions` in database
   - Client config service loads and validates configuration

2. **Runtime Phase:**
   - Widget loads client config from `/api/v1/widget/config/:clientId`
   - Checks `onboarding_enabled` flag
   - If enabled, loads questions from `default_onboarding_questions`
   - Starts onboarding flow on first user message

3. **Submission Phase:**
   - User answers submitted to `/v1/visitors/:visitorId/onboarding`
   - Backend saves answers, computes lead score
   - Returns recommendations based on preferences

---

## 4. Database Schema Changes

### 4.1 New Column Addition

**Table:** `clients`

**New Column:**
```sql
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS onboarding_enabled BOOLEAN DEFAULT true;
```

**Migration Script:**
```sql
-- Add onboarding_enabled column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS onboarding_enabled BOOLEAN DEFAULT true;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_clients_onboarding_enabled
ON clients(onboarding_enabled);

-- Update existing clients to have onboarding enabled by default
UPDATE clients
SET onboarding_enabled = true
WHERE onboarding_enabled IS NULL;
```

### 4.2 Configuration Schema

**JSONB Structure for `default_onboarding_questions`:**
```json
{
  "enabled": true,
  "questions": [
    {
      "id": "typology",
      "type": "select",
      "question": "Que tipologia procura?",
      "required": true,
      "options": [
        {"value": "T0", "label": "T0"},
        {"value": "T1", "label": "T1"},
        {"value": "T2", "label": "T2"},
        {"value": "T3", "label": "T3"},
        {"value": "T3 Duplex", "label": "T3 Duplex"},
        {"value": "T4", "label": "T4"},
        {"value": "Indiferente", "label": "Indiferente"}
      ]
    },
    {
      "id": "budget_bucket",
      "type": "select",
      "question": "Qual o seu orçamento?",
      "required": true,
      "options": [
        {"value": "€100–200k", "label": "€100–200k"},
        {"value": "€200–300k", "label": "€200–300k"},
        {"value": "€300–400k", "label": "€300–400k"},
        {"value": "€400–500k", "label": "€400–500k"},
        {"value": "€500k+", "label": "€500k+"},
        {"value": "Prefer not to say", "label": "Prefiro não dizer"}
      ]
    },
    {
      "id": "buying_timeframe",
      "type": "select",
      "question": "Para quando pretende comprar?",
      "required": true,
      "options": [
        {"value": "ASAP (<1 mês)", "label": "ASAP (<1 mês)"},
        {"value": "1–3 meses", "label": "1–3 meses"},
        {"value": "3–6 meses", "label": "3–6 meses"},
        {"value": "6+ meses", "label": "6+ meses"},
        {"value": "Apenas a explorar", "label": "Apenas a explorar"}
      ]
    },
    {
      "id": "contact",
      "type": "contact",
      "question": "Quase lá! Como o podemos contactar?",
      "required": true,
      "fields": [
        {"id": "name", "type": "text", "placeholder": "Nome", "required": true},
        {"id": "email", "type": "email", "placeholder": "Email", "required": true}
      ],
      "consent": {
        "required": true,
        "text": "Aceito receber comunicações relevantes sobre este empreendimento."
      }
    }
  ],
  "introMessage": "Antes de continuar, posso fazer 3 perguntas rápidas para recomendar os melhores apartamentos? (leva < 30s)",
  "completionMessage": "Obrigado! Com base nas suas preferências, aqui estão algumas opções:"
}
```

---

## 5. Backend Implementation

### 5.1 Client Configuration Service Updates

**File:** `packages/backend/src/services/client-config-service.js`

**Add to `getClientConfig` function:**
```javascript
async function getClientConfig(clientId) {
  // ... existing code ...

  // NEW: Load onboarding configuration
  const onboardingConfig = {
    enabled: clientData.onboarding_enabled !== false, // Default true
    questions: clientData.default_onboarding_questions || getDefaultOnboardingQuestions()
  };

  return {
    // ... existing fields ...
    onboardingConfig
  };
}

// NEW: Default onboarding questions fallback
function getDefaultOnboardingQuestions() {
  return {
    enabled: true,
    questions: [
      // ... hardcoded questions as JSON structure ...
    ],
    introMessage: "Antes de continuar, posso fazer 3 perguntas rápidas...",
    completionMessage: "Obrigado! Com base nas suas preferências..."
  };
}
```

### 5.2 Widget Configuration Endpoint Enhancement

**File:** `packages/backend/src/index.js`

**Update `/api/v1/widget/config/:clientId` endpoint:**
```javascript
app.get('/api/v1/widget/config/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const clientConfig = await clientConfigService.getClientConfig(clientId);

    // Include onboarding configuration in response
    res.json({
      ...clientConfig,
      onboardingConfig: clientConfig.onboardingConfig
    });
  } catch (error) {
    console.error(`Error fetching widget config for client ${req.params.clientId}:`, error);
    res.status(404).json({ error: 'Configuration not found.' });
  }
});
```

### 5.3 Admin API for Configuration Management

**File:** `packages/backend/src/index.js`

**Add new endpoints:**
```javascript
// Get onboarding configuration for a client
app.get('/api/admin/clients/:clientId/onboarding-config', clientConfigMiddleware(clientConfigService), async (req, res) => {
  try {
    const { clientConfig } = req;
    res.json({
      onboarding_enabled: clientConfig.onboardingConfig.enabled,
      default_onboarding_questions: clientConfig.onboardingConfig.questions
    });
  } catch (error) {
    console.error('Error fetching onboarding config:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding configuration.' });
  }
});

// Update onboarding configuration for a client
app.put('/api/admin/clients/:clientId/onboarding-config', clientConfigMiddleware(clientConfigService), async (req, res) => {
  try {
    const { clientId } = req.params;
    const { onboarding_enabled, default_onboarding_questions } = req.body;

    // Validate input
    if (typeof onboarding_enabled !== 'boolean') {
      return res.status(400).json({ error: 'onboarding_enabled must be a boolean.' });
    }

    // Update database
    const { error } = await supabase
      .from('clients')
      .update({
        onboarding_enabled,
        default_onboarding_questions
      })
      .eq('client_id', clientId);

    if (error) {
      throw error;
    }

    res.json({ success: true, message: 'Onboarding configuration updated.' });
  } catch (error) {
    console.error('Error updating onboarding config:', error);
    res.status(500).json({ error: 'Failed to update onboarding configuration.' });
  }
});
```

---

## 6. Frontend Implementation

### 6.1 Production Widget Updates

**File:** `packages/widget/src/App.jsx`

**Key Changes:**
1. Load onboarding config from widget config endpoint
2. Check `onboardingConfig.enabled` before starting flow
3. Use dynamic questions from `onboardingConfig.questions`
4. Update intro message from config

**Configuration Loading:**
```javascript
loadConfig = async () => {
  // ... existing code ...

  const configResponse = await fetch(`${apiUrl}/api/v1/widget/config/${clientId}`);
  const config = await configResponse.json();

  // NEW: Store onboarding configuration
  this.setState({
    config: {
      ...config,
      onboardingEnabled: config.onboardingConfig?.enabled ?? true,
      onboardingQuestions: config.onboardingConfig?.questions || this.getDefaultQuestions()
    }
  });
};
```

**Onboarding Flow Updates:**
```javascript
// Check if onboarding should start
if (!hasSentFirstMessage && !onboarding.completed && !onboarding.started && this.state.config.onboardingEnabled) {
  // Start onboarding with dynamic questions
  this.setState({
    onboarding: { ...onboarding, started: true, step: 1 },
    initialUserMessageBuffer: inputValue,
    isTyping: false,
    hasSentFirstMessage: true,
  });

  // Use dynamic intro message
  const introMsg = {
    id: Date.now() + 1,
    text: this.state.config.onboardingQuestions.introMessage ||
          'Antes de continuar, posso fazer algumas perguntas rápidas?',
    sender: 'bot',
    timestamp: new Date(),
  };
  this.setState(prev => ({ messages: [...prev.messages, introMsg] }));
  return;
}
```

### 6.2 Testing Interface Implementation

**File:** `packages/frontend/src/chatbot/ChatInterface_testing.jsx`

**Complete Onboarding Implementation:**

```javascript
// Add to state
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

// Load onboarding config
useEffect(() => {
  const loadOnboardingConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/widget/config/${TEST_CLIENT_ID}`);
      const config = await response.json();
      setOnboardingConfig(config.onboardingConfig || getDefaultOnboardingConfig());
    } catch (error) {
      console.error('Failed to load onboarding config:', error);
      setOnboardingConfig(getDefaultOnboardingConfig());
    }
  };

  loadOnboardingConfig();
}, []);

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
    const response = await fetch(`${API_BASE_URL}/v1/clients/${TEST_CLIENT_ID}/listings`);
    const listings = response.ok ? await response.json() : [];

    const { typology, budget_bucket } = onboarding.answers;
    const range = (bucket) => {
      if (!bucket) return [0, Infinity];
      const m = bucket.match(/(\d+)[kK].*(\d+)[kK]/);
      if (m) return [parseInt(m[1], 10) * 1000, parseInt(m[2], 10) * 1000];
      if (/500k\+/.test(bucket)) return [500000, Infinity];
      return [0, Infinity];
    };
    const [minPrice, maxPrice] = range(budget_bucket || '0-9999k');

    const filtered = (listings || [])
      .filter(l => {
        const typeOk = typology ? String(l.type || '').toUpperCase().includes(String(typology).toUpperCase()) : true;
        const price = Number(l.price) || Number(l.price_eur) || 0;
        const priceOk = price >= minPrice && price <= maxPrice;
        return typeOk && priceOk;
      })
      .slice(0, 5);

    if (filtered.length === 0) {
      const msg = { from: 'bot', text: 'Não encontrei imóveis que correspondam exatamente às preferências. Posso ajudá-lo a afinar os critérios?' };
      setMessages(prev => [...prev, msg]);
      return;
    }

    const listMd = filtered.map((l, idx) => `- ${idx + 1}. ${l.name || 'Imóvel'} — €${(l.price || l.price_eur || 0).toLocaleString()}${l.id ? ` (ID: ${l.id})` : ''}`).join('\n');
    const recMsg = {
      from: 'bot',
      text: `${onboardingConfig?.completionMessage || 'Com base nas suas preferências, aqui estão algumas opções:'}\n\n${listMd}\n\nQuer falar sobre algum destes?`,
    };
    setMessages(prev => [...prev, recMsg]);
  } catch (error) {
    console.error('Failed to fetch listings for recommendations:', error);
  }
};

// Update sendMessage to trigger onboarding
const handleSend = async (messageText = null) => {
  const textToSend = messageText || input.trim();
  if (textToSend) {
    const userMessage = { from: 'user', text: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSuggestedQuestions([]);
    setIsLoading(true);

    try {
      // Check if onboarding should start
      if (!onboarding.completed && !onboarding.started && onboardingConfig?.enabled !== false) {
        setOnboarding(prev => ({ ...prev, started: true, step: 1 }));

        const introMsg = {
          from: 'bot',
          text: onboardingConfig?.introMessage || 'Antes de continuar, posso fazer 3 perguntas rápidas para recomendar os melhores apartamentos? (leva < 30s)',
        };
        setMessages(prev => [...prev, introMsg]);
        setIsLoading(false);
        return;
      }

      // ... rest of existing sendMessage logic ...
    } catch (error) {
      // ... error handling ...
    } finally {
      setIsLoading(false);
    }
  }
};

// Add onboarding UI to render
return (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
    <div style={{ width: '440px', height: '700px', display: 'grid', gridTemplateRows: 'auto 1fr auto', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
      {/* ... existing header ... */}

      <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ... existing messages ... */}

        {/* Onboarding UI */}
        {onboarding.started && !onboarding.completed && (
          <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            {onboarding.step === 1 && onboardingConfig?.questions?.[0] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: '600' }}>{onboardingConfig.questions[0].question}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {onboardingConfig.questions[0].options.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setOnboardingAnswer('typology', opt.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        backgroundColor: onboarding.answers.typology === opt.value ? '#3b82f6' : '#ffffff',
                        color: onboarding.answers.typology === opt.value ? '#ffffff' : '#374151',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {onboarding.answers.typology && (
                  <button
                    onClick={() => setOnboarding(prev => ({ ...prev, step: 2 }))}
                    style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-end' }}
                  >
                    Seguinte
                  </button>
                )}
              </div>
            )}

            {/* Similar structure for steps 2, 3, and 4 */}
            {onboarding.step === 2 && onboardingConfig?.questions?.[1] && (
              // Budget selection UI
            )}

            {onboarding.step === 3 && onboardingConfig?.questions?.[2] && (
              // Timeframe selection UI
            )}

            {onboarding.step === 4 && onboardingConfig?.questions?.[3] && (
              // Contact information UI
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: '600' }}>{onboardingConfig.questions[3].question}</div>
                <input
                  type="text"
                  placeholder="Nome"
                  value={onboarding.answers.name}
                  onChange={(e) => setOnboardingAnswer('name', e.target.value)}
                  style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={onboarding.answers.email}
                  onChange={(e) => setOnboardingAnswer('email', e.target.value)}
                  style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={onboarding.answers.consent_marketing}
                    onChange={(e) => setOnboardingAnswer('consent_marketing', e.target.checked)}
                  />
                  Aceito receber comunicações relevantes sobre este empreendimento.
                </label>
                <button
                  onClick={submitOnboarding}
                  disabled={!onboarding.answers.name || !onboarding.answers.email}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: (!onboarding.answers.name || !onboarding.answers.email) ? '#d1d5db' : '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (!onboarding.answers.name || !onboarding.answers.email) ? 'not-allowed' : 'pointer',
                    alignSelf: 'flex-end'
                  }}
                >
                  Concluir
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ... existing input area ... */}
    </div>
  </div>
);
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**File:** `packages/backend/test/onboarding-config.test.js`

```javascript
const { getClientConfig } = require('../src/services/client-config-service');

describe('Onboarding Configuration', () => {
  it('should load onboarding config with enabled flag', async () => {
    const config = await getClientConfig('test-client-id');
    expect(config.onboardingConfig).toBeDefined();
    expect(typeof config.onboardingConfig.enabled).toBe('boolean');
  });

  it('should provide default questions when none configured', async () => {
    // Test with client that has no onboarding questions configured
    const config = await getClientConfig('client-without-onboarding');
    expect(config.onboardingConfig.questions).toBeDefined();
    expect(Array.isArray(config.onboardingConfig.questions)).toBe(true);
  });
});
```

### 7.2 Integration Tests

**File:** `packages/backend/test/onboarding-flow.test.js`

```javascript
const request = require('supertest');
const app = require('../src/index').createApp();

describe('Onboarding Flow Integration', () => {
  let visitorId;
  let clientId = 'test-client-id';

  beforeAll(async () => {
    // Create test visitor
    const response = await request(app)
      .post('/v1/sessions')
      .send({ clientId });
    visitorId = response.body.visitor_id;
  });

  it('should save onboarding answers', async () => {
    const onboardingData = {
      typology: 'T2',
      budget_bucket: '€200–300k',
      buying_timeframe: '1–3 meses',
      name: 'Test User',
      email: 'test@example.com',
      consent_marketing: true
    };

    const response = await request(app)
      .post(`/v1/visitors/${visitorId}/onboarding`)
      .set('x-client-id', clientId)
      .send(onboardingData);

    expect(response.status).toBe(200);
    expect(response.body.visitor.onboarding_completed).toBe(true);
  });

  it('should return recommendations after onboarding', async () => {
    const response = await request(app)
      .post(`/v1/visitors/${visitorId}/onboarding`)
      .set('x-client-id', clientId)
      .send({
        typology: 'T2',
        budget_bucket: '€200–300k',
        buying_timeframe: '1–3 meses',
        name: 'Test User',
        email: 'test@example.com',
        consent_marketing: true
      });

    expect(response.status).toBe(200);
    expect(response.body.recommendations).toBeDefined();
    expect(Array.isArray(response.body.recommendations)).toBe(true);
  });
});
```

### 7.3 End-to-End Tests

**File:** `packages/frontend/cypress/integration/onboarding.spec.js`

```javascript
describe('Onboarding Flow', () => {
  it('should complete onboarding and show recommendations', () => {
    cy.visit('/chat-testing');

    // Type first message
    cy.get('input').type('Olá, quero comprar um apartamento{enter}');

    // Should show onboarding intro
    cy.contains('Antes de continuar, posso fazer 3 perguntas rápidas');

    // Complete onboarding steps
    cy.contains('Que tipologia procura?');
    cy.contains('T2').click();
    cy.contains('Seguinte').click();

    cy.contains('Qual o seu orçamento?');
    cy.contains('€200–300k').click();
    cy.contains('Seguinte').click();

    cy.contains('Para quando pretende comprar?');
    cy.contains('1–3 meses').click();
    cy.contains('Seguinte').click();

    // Contact form
    cy.get('input[placeholder="Nome"]').type('Test User');
    cy.get('input[placeholder="Email"]').type('test@example.com');
    cy.get('input[type="checkbox"]').check();
    cy.contains('Concluir').click();

    // Should show recommendations
    cy.contains('Com base nas suas preferências');
  });

  it('should skip onboarding if disabled for client', () => {
    // Configure client with onboarding disabled
    cy.request('PUT', '/api/admin/clients/test-client/onboarding-config', {
      onboarding_enabled: false
    });

    cy.visit('/chat-testing');
    cy.get('input').type('Olá{enter}');

    // Should not show onboarding
    cy.contains('Antes de continuar').should('not.exist');
  });
});
```

---

## 8. Deployment Plan

### 8.1 Pre-Deployment Checklist

- [ ] Database migration applied to add `onboarding_enabled` column
- [ ] Default onboarding questions populated for existing clients
- [ ] Backend services updated and tested
- [ ] Frontend components implemented and tested
- [ ] Admin interface supports onboarding configuration
- [ ] Documentation updated

### 8.2 Deployment Phases

**Phase 1: Database Migration (Day 1)**
- Deploy database schema changes
- Run migration scripts
- Verify data integrity

**Phase 2: Backend Deployment (Day 2)**
- Deploy backend changes
- Test API endpoints
- Verify configuration loading

**Phase 3: Frontend Deployment (Day 3)**
- Deploy widget updates
- Deploy testing interface updates
- Test end-to-end flows

**Phase 4: Admin Interface (Day 4)**
- Deploy admin configuration UI
- Test configuration management
- Train admin users

### 8.3 Rollback Plan

**Immediate Rollback Triggers:**
- Error rate >5% in onboarding endpoints
- Configuration loading failures
- Database connection issues

**Rollback Steps:**
1. Set `onboarding_enabled = false` for all clients via database
2. Revert frontend to previous version
3. Revert backend to previous version
4. Clear client configuration caches

---

## 9. Monitoring & Rollback

### 9.1 Key Metrics

**Performance Metrics:**
- Onboarding completion rate
- Average time to complete onboarding
- API response times for onboarding endpoints
- Error rates

**Business Metrics:**
- Lead score improvement from onboarding
- Conversion rate from onboarding recommendations
- User engagement with recommended listings

### 9.2 Logging

**Structured Logging:**
```javascript
// Onboarding events
logger.info('onboarding_started', {
  visitor_id: visitorId,
  client_id: clientId,
  timestamp: new Date().toISOString()
});

logger.info('onboarding_completed', {
  visitor_id: visitorId,
  client_id: clientId,
  lead_score: newScore,
  recommendations_count: recommendations.length,
  duration_ms: Date.now() - startTime
});
```

### 9.3 Alerts

**Critical Alerts:**
- Onboarding API error rate >5%
- Configuration loading failures
- Database update failures

**Warning Alerts:**
- Onboarding completion rate <50%
- Average completion time >2 minutes

---

## Implementation Timeline

**Week 1: Foundation**
- Database schema changes
- Backend configuration service updates
- Basic API endpoints

**Week 2: Core Implementation**
- Frontend widget updates
- Testing interface implementation
- Integration testing

**Week 3: Enhancement & Testing**
- Admin interface
- Comprehensive testing
- Performance optimization

**Week 4: Deployment & Monitoring**
- Staged deployment
- Monitoring setup
- Documentation

---

## Risk Assessment

**High Risk:**
- Database migration could affect existing data
- Configuration changes might break existing flows

**Medium Risk:**
- Frontend changes could affect user experience
- API changes might impact integrations

**Low Risk:**
- New features are additive
- Fallback mechanisms in place

**Mitigation Strategies:**
- Comprehensive testing before deployment
- Feature flags for gradual rollout
- Monitoring and quick rollback procedures

---

## Success Criteria

**Functional:**
- ✅ Onboarding can be enabled/disabled per client
- ✅ Dynamic questions load from database
- ✅ Testing interface includes full onboarding flow
- ✅ Backward compatibility maintained

**Performance:**
- ✅ <50ms impact on chat initialization
- ✅ <200ms onboarding submission time
- ✅ 99.9% API availability

**Quality:**
- ✅ 95% test coverage
- ✅ Zero critical bugs in production
- ✅ User satisfaction scores >4.5/5

---

**End of Implementation Plan**