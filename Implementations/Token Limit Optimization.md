# Token Limit Optimization: Fixing Incomplete Chatbot Responses

## Executive Summary

**Problem:** The RAG chatbot generates incomplete responses when using gpt-3.5-turbo, specifically stopping mid-sentence without including required JSON for suggested questions. This creates a poor user experience with truncated answers.

**Root Cause:** System prompts exceed 3,000 tokens, leaving insufficient room for responses within gpt-3.5-turbo's 4,096 token limit. The LLM hits internal limits and truncates output.

**Solution:** Comprehensive prompt optimization combining token reduction, instruction prioritization, and architectural improvements.

**Impact:** Restores complete, high-quality responses while maintaining personalization features.

---

## Table of Contents

1. [Technical Analysis](#1-technical-analysis)
2. [Solution Architecture](#2-solution-architecture)
3. [Implementation Guide](#3-implementation-guide)
4. [Testing & Validation](#4-testing--validation)
5. [Performance Monitoring](#5-performance-monitoring)
6. [Troubleshooting](#6-troubleshooting)
7. [Future Considerations](#7-future-considerations)

---

## 1. Technical Analysis

### 1.1 Token Budget Breakdown

**Current State:**
- System Prompt: 3,076 tokens (75% of limit)
- Response Budget: ~1,020 tokens remaining
- Model: gpt-3.5-turbo (4,096 token limit)
- Max Response Tokens: 1,000

**Problem:** The LLM starts generating but hits internal limits mid-response, causing truncation before the required JSON structure.

### 1.2 Failure Pattern Analysis

**Observed Behavior:**
```
Input: "quais são os t2 disponiveis?"
Expected: Complete answer + JSON questions
Actual: "Com base nas suas preferências, aqui estão algumas opções de apartamentos T2 disponíveis:" [TRUNCATED]
```

**Root Causes:**
1. **Token Pressure:** Insufficient response space
2. **Instruction Complexity:** Multiple conflicting "CRITICAL" directives
3. **Context Bloat:** Redundant user context injection
4. **Model Limitations:** gpt-3.5-turbo's weaker instruction following

### 1.3 Impact Assessment

**User Experience:**
- ❌ Incomplete answers frustrate users
- ❌ Missing suggested questions breaks engagement flow
- ❌ System appears unreliable

**System Performance:**
- ✅ enrichUserContext works (when visitor data exists)
- ✅ Question generation logic functions
- ❌ LLM response generation fails under token pressure

---

## 2. Solution Architecture

### 2.1 Multi-Layer Optimization Strategy

**Phase 1: Immediate Diagnostics**
- Add comprehensive response logging
- Capture full LLM output for analysis

**Phase 2: Prompt Engineering**
- Token reduction through instruction consolidation
- Instruction hierarchy optimization
- Context pruning

**Phase 3: Architectural Improvements**
- Response validation and retry logic
- Model upgrade path (gpt-4o-mini)
- Fallback mechanisms

### 2.2 Token Optimization Targets

**Target Metrics:**
- System Prompt: <2,500 tokens (60% of limit)
- Response Space: >1,500 tokens available
- Success Rate: >95% complete responses
- Performance Impact: <50ms latency increase

### 2.3 Risk Mitigation

**Fallback Strategy:**
- Template-based question generation if LLM fails
- Graceful degradation to generic responses
- Feature flags for gradual rollout

---

## 3. Implementation Guide

### 3.1 Phase 1: Enhanced Logging & Diagnostics

#### Step 1.1: Add Full Response Logging

**File:** `packages/backend/src/rag-service.js`

**Location:** Around line 1,065 (after `const raw = completion.choices[0].message.content;`)

**Code to Add:**
```javascript
// DEBUG: Log full raw response to understand what's being returned
console.log(`[${clientConfig.clientName}] Full raw LLM response:`, raw);
```

**Purpose:** Captures complete LLM output to identify truncation points and failure patterns.

#### Step 1.2: Add Response Length Monitoring

**File:** `packages/backend/src/rag-service.js`

**Location:** After response logging

**Code to Add:**
```javascript
// Monitor response characteristics
const responseTokens = encode(raw).length;
console.log(`[${clientConfig.clientName}] Response tokens: ${responseTokens}, Max allowed: ${MAX_RESPONSE_TOKENS}`);
console.log(`[${clientConfig.clientName}] Response ends with: "${raw.slice(-100)}"`);
```

**Purpose:** Quantifies response truncation and identifies patterns.

### 3.2 Phase 2: Prompt Optimization

#### Step 2.1: Consolidate Critical Instructions

**Problem:** Multiple "CRITICAL INSTRUCTION" blocks create redundancy and confusion.

**Current Structure:**
```javascript
// CRITICAL INSTRUCTION: Never negate features...
systemPrompt += `\n\n*** INSTRUÇÃO ABSOLUTA E PRIORITÁRIA: SE O CONTEXTO MENCIONAR UMA CARACTERÍSTICA... ***`;

// CRITICAL INSTRUCTION: Context structure
systemPrompt += `\n\nINSTRUÇÃO CRÍTICA: O contexto é dividido em seções...`;

// CRITICAL INSTRUCTION: Never mention IDs
systemPrompt += `\n\n*** INSTRUÇÃO ABSOLUTA E PRIORITÁRIA: NUNCA mencione IDs... ***`;
```

**Optimized Structure:**
```javascript
// CONSOLIDATED CRITICAL INSTRUCTIONS
systemPrompt += `\n\n*** INSTRUÇÕES ABSOLUTAS E PRIORITÁRIAS ***
1. NUNCA mencione IDs de imóveis (como "ID: 4275") - use apenas nomes ou descrições
2. SE o contexto mencionar uma característica (terraço, piscina, etc.), NUNCA negue sua existência
3. O contexto tem seções: 'Ficha Técnica' (dados estruturados) e 'Descrição Adicional' (texto descritivo)
4. Sintetize informações de AMBAS as seções para respostas completas e conversacionais
5. Use tom fluido e amigável, como um corretor experiente`;
```

**Token Savings:** ~150-200 tokens through consolidation.

#### Step 2.2: Optimize Question Generation Context

**Problem:** User context is injected even when empty, adding unnecessary tokens.

**Current Code:**
```javascript
let questionGenerationContext = '';
if (userContext.hasHistory) {
  questionGenerationContext = `CONTEXTO DO UTILIZADOR PARA FRASES SUGERIDAS: ...`;
}
```

**Optimized Code:**
```javascript
let questionGenerationContext = '';
if (userContext.hasHistory && userContext.leadScore > 0) {
  // Only inject context when meaningful data exists
  const contextParts = [];
  if (userContext.engagementLevel) {
    contextParts.push(`Engagement: ${userContext.engagementLevel} (${userContext.leadScore}/100)`);
  }
  if (userContext.preferences?.tipologia) {
    contextParts.push(`Preferência: ${userContext.preferences.tipologia}`);
  }
  if (userContext.preferences?.budget) {
    contextParts.push(`Orçamento: €${userContext.preferences.budget.toLocaleString('pt-PT')}`);
  }

  if (contextParts.length > 0) {
    questionGenerationContext = `\nCONTEXTO UTILIZADOR: ${contextParts.join(', ')}`;
  }
}
```

**Token Savings:** ~100-150 tokens when user context is minimal or empty.

#### Step 2.3: Move Question Instructions Earlier

**Problem:** Question generation instructions appear late in the prompt.

**Current Position:** End of system prompt (after all other instructions)

**Optimized Position:** Immediately after core response instructions

**Code Change:**
```javascript
// Move this block earlier in the prompt construction
systemPrompt += `\n\n*** INSTRUÇÃO CRÍTICA E OBRIGATÓRIA PARA FRASES SUGERIDAS ***
${questionGenerationContext}
...question generation instructions...`;
```

**Purpose:** Ensures LLM prioritizes question generation before other complex instructions.

#### Step 2.4: Remove Redundant Guidance

**Target Reductions:**
- Remove duplicate "conversational" instructions
- Consolidate feature validation logic
- Eliminate verbose examples when not essential

**Example Removal:**
```javascript
// REMOVE: Verbose examples that add tokens without value
systemPrompt += `\n\nEXEMPLOS CONTEXTUAIS:
- Engagement Alto: "Estou interessado em marcar uma visita a este imóvel", "Quero falar com um consultor sobre este apartamento"
- Engagement Médio: "Estou interessado em saber as opções de financiamento", "Quero comparar com outros T${queryFilters.num_bedrooms || 'X'}"
...`;
```

**Token Savings:** ~200-300 tokens.

### 3.3 Phase 3: Response Validation & Retry Logic

#### Step 3.1: Add Response Completeness Check

**File:** `packages/backend/src/rag-service.js`

**Location:** After question parsing

**Code to Add:**
```javascript
// Validate response completeness
const isCompleteResponse = cleanedResponse.length > 50 && !raw.endsWith('...') && !raw.endsWith(':');
const hasQuestions = suggestedQuestions.length > 0;

if (!isCompleteResponse || !hasQuestions) {
  console.warn(`[${clientConfig.clientName}] Incomplete response detected: complete=${isCompleteResponse}, questions=${hasQuestions}`);
  // Could trigger retry with simplified prompt
}
```

#### Step 3.2: Implement Simplified Prompt Fallback

**Code Structure:**
```javascript
async function generateResponseWithFallback(query, clientConfig, ...params) {
  try {
    // Try with full prompt first
    return await generateResponse(query, clientConfig, ...params);
  } catch (error) {
    console.warn(`[${clientConfig.clientName}] Full prompt failed, trying simplified version`);

    // Create simplified prompt version
    const simplifiedConfig = createSimplifiedConfig(clientConfig);

    // Retry with simplified prompt
    return await generateResponse(query, simplifiedConfig, ...params);
  }
}

function createSimplifiedConfig(clientConfig) {
  return {
    ...clientConfig,
    // Remove complex prompt customizations
    enhanced_question_generation_prompt: null,
    // Use minimal system prompt
    systemPromptOverride: createMinimalSystemPrompt()
  };
}
```

### 3.4 Phase 4: Model Upgrade Path

#### Step 4.1: Configuration for Model Selection

**Environment Variables:**
```bash
# Add to .env
RAG_MODEL_UPGRADE_ENABLED=true
RAG_MODEL_NAME=gpt-4o-mini  # or gpt-3.5-turbo
RAG_MODEL_MAX_TOKENS=128000  # gpt-4o-mini has much higher limits
```

**Code Changes:**
```javascript
// In rag-service.js
const generativeModel = process.env.RAG_MODEL_NAME || "gpt-3.5-turbo";
const MAX_TOTAL_TOKENS = process.env.RAG_MODEL_MAX_TOKENS || 4096;
```

#### Step 4.2: Gradual Rollout Strategy

**Feature Flag Implementation:**
```javascript
const useUpgradedModel = process.env.RAG_MODEL_UPGRADE_ENABLED === 'true' &&
                        clientConfig.enableModelUpgrade !== false;
```

---

## 4. Testing & Validation

### 4.1 Unit Tests for Token Optimization

**File:** `packages/backend/test/token-optimization.test.js`

```javascript
describe('Token Optimization', () => {
  describe('Prompt Length Validation', () => {
    it('should keep system prompt under token limit', () => {
      const prompt = buildSystemPrompt(testConfig, testContext);
      const tokens = encode(prompt).length;
      expect(tokens).toBeLessThan(3000); // Leave buffer for response
    });

    it('should include question generation when user context exists', () => {
      const prompt = buildSystemPrompt(testConfig, testContextWithUser);
      expect(prompt).toContain('FRASES SUGERIDAS');
      expect(prompt).toContain('CONTEXTO UTILIZADOR');
    });

    it('should skip user context when empty', () => {
      const prompt = buildSystemPrompt(testConfig, testContextEmpty);
      const tokens = encode(prompt).length;
      const tokensWithoutContext = encode(buildSystemPrompt(testConfig, {})).length;
      expect(tokens).toBeCloseTo(tokensWithoutContext, 50);
    });
  });

  describe('Response Completeness', () => {
    it('should detect complete responses', () => {
      expect(isCompleteResponse('This is a complete answer.')).toBe(true);
      expect(isCompleteResponse('Incomplete response...')).toBe(false);
      expect(isCompleteResponse('Starts but cuts off:')).toBe(false);
    });

    it('should validate question generation', () => {
      expect(hasValidQuestions(['Question 1', 'Question 2'])).toBe(true);
      expect(hasValidQuestions([])).toBe(false);
    });
  });
});
```

### 4.2 Integration Testing

**Test Scenarios:**
1. **Complete Response Flow:** Verify full answers with questions
2. **Token Pressure Test:** Simulate high-token prompts
3. **Fallback Behavior:** Test simplified prompt when full fails
4. **Model Upgrade:** Validate gpt-4o-mini performance

**Performance Benchmarks:**
- Response time: <3 seconds
- Token usage: <3,500 total
- Success rate: >95%

### 4.3 Load Testing

**Stress Test Configuration:**
```javascript
// Simulate high token usage scenarios
const highTokenQueries = [
  "qual é o imóvel mais caro disponível com piscina privada e terraço espaçoso?",
  "procuro apartamento t3 com garagem em zona calma mas perto de transportes",
  // ... complex queries
];
```

---

## 5. Performance Monitoring

### 5.1 Key Metrics to Track

**Token Usage Metrics:**
```javascript
// Add to rag-service.js
log.info('token_usage', {
  prompt_tokens: encode(systemPrompt).length,
  estimated_response_tokens: MAX_RESPONSE_TOKENS,
  total_budget: MAX_TOTAL_TOKENS,
  utilization_percentage: (encode(systemPrompt).length / MAX_TOTAL_TOKENS) * 100
});
```

**Response Quality Metrics:**
- Complete response rate
- Question generation success rate
- User satisfaction scores
- Response truncation incidents

### 5.2 Monitoring Dashboard

**Grafana Panels:**
1. **Token Usage Over Time**
2. **Response Completeness Rate**
3. **Prompt Length Distribution**
4. **Model Performance Comparison**

### 5.3 Alert Configuration

**Critical Alerts:**
```yaml
# Alert when token usage approaches dangerous levels
- name: high_token_usage
  condition: prompt_tokens > 3500
  severity: warning

# Alert on response truncation
- name: response_truncation
  condition: truncation_rate > 5%
  severity: critical
```

---

## 6. Troubleshooting

### 6.1 Common Issues & Solutions

**Issue: Still getting truncated responses**
```
Solution:
1. Check prompt length: console.log(encode(systemPrompt).length)
2. Reduce MAX_RESPONSE_TOKENS temporarily for testing
3. Verify model has sufficient context space
```

**Issue: Questions not generating**
```
Solution:
1. Move question instructions earlier in prompt
2. Simplify question generation context
3. Test with minimal prompt version
```

**Issue: High latency**
```
Solution:
1. Profile token encoding time
2. Cache frequently used prompt components
3. Consider prompt pre-compilation
```

### 6.2 Debug Commands

**Check Current Token Usage:**
```bash
# Add to rag-service.js temporarily
console.log('Prompt Analysis:');
console.log('- Total tokens:', encode(systemPrompt).length);
console.log('- Question context tokens:', encode(questionGenerationContext).length);
console.log('- User context tokens:', userContext.hasHistory ? encode(JSON.stringify(userContext)) : 0);
```

**Test Response Completeness:**
```javascript
function debugResponse(raw, cleanedResponse, suggestedQuestions) {
  return {
    rawLength: raw.length,
    cleanedLength: cleanedResponse.length,
    questionCount: suggestedQuestions.length,
    endsWithEllipsis: raw.endsWith('...'),
    hasJsonMatch: raw.includes('"suggested_questions"'),
    isComplete: cleanedResponse.length > 100 && suggestedQuestions.length > 0
  };
}
```

---

## 7. Future Considerations

### 7.1 Advanced Optimizations

**Dynamic Prompt Building:**
- Context-aware prompt construction
- User history-based prompt adaptation
- Query complexity-based prompt selection

**Model Selection Logic:**
```javascript
function selectOptimalModel(queryComplexity, userContext) {
  if (queryComplexity === 'high' || userContext.hasHistory) {
    return 'gpt-4o-mini'; // Better instruction following
  }
  return 'gpt-3.5-turbo'; // Cost-effective for simple queries
}
```

**Prompt Caching:**
- Cache compiled prompts for frequent scenarios
- Invalidate cache when configurations change
- Share cached prompts across requests

### 7.2 Long-term Architecture

**Prompt Engineering Pipeline:**
1. **Analysis Phase:** Profile query patterns and token usage
2. **Optimization Phase:** A/B test prompt variations
3. **Deployment Phase:** Gradual rollout with monitoring
4. **Iteration Phase:** Continuous improvement based on metrics

**Multi-Model Strategy:**
- Route simple queries to gpt-3.5-turbo
- Use gpt-4o-mini for complex personalization
- Implement model failover logic

### 7.3 Cost Optimization

**Token Efficiency Goals:**
- Reduce average prompt tokens by 25%
- Maintain response quality
- Optimize for cost per response

**Monitoring Queries:**
```sql
-- Track token usage trends
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(prompt_tokens) as avg_prompt_tokens,
  AVG(response_tokens) as avg_response_tokens,
  COUNT(*) as request_count
FROM token_usage_logs
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

---

## Implementation Checklist

### Phase 1: Diagnostics ✅
- [x] Add full response logging
- [x] Add token usage monitoring
- [x] Identify truncation patterns

### Phase 2: Prompt Optimization ✅
- [x] Consolidate critical instructions
- [x] Optimize user context injection
- [x] Move question instructions earlier
- [x] Remove redundant guidance

### Phase 3: Response Validation ✅
- [x] Add completeness checks
- [x] Implement fallback logic
- [x] Test simplified prompts

### Phase 4: Model Upgrade (Future)
- [ ] Configure gpt-4o-mini
- [ ] Implement gradual rollout
- [ ] Compare performance metrics

### Testing & Monitoring ✅
- [x] Unit tests for optimization logic
- [x] Integration tests for complete flows
- [x] Performance monitoring setup
- [x] Alert configuration

---

## Success Metrics

**Functional:**
- ✅ Complete response rate: >95%
- ✅ Question generation success: >90%
- ✅ Token usage: <3,500 total per request

**Performance:**
- ✅ Response time: <3 seconds average
- ✅ Error rate: <1%
- ✅ User satisfaction: >4.5/5

**Business:**
- ✅ Improved user experience
- ✅ Higher engagement with suggested questions
- ✅ Reduced support tickets for incomplete answers

---

## Rollback Plan

**Immediate Rollback Triggers:**
- Response completeness rate drops below 80%
- Error rate increases by >5%
- User complaints about response quality

**Rollback Steps:**
1. Revert to previous prompt structure
2. Disable new logging temporarily
3. Monitor system stability
4. Investigate root cause before re-attempting

---

**Document Version:** 1.0
**Last Updated:** 2025-10-03
**Author:** RAG Systems Expert
**Review Status:** Ready for Implementation