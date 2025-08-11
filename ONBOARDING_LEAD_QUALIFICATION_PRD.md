# Onboarding & Lead Qualification PRD

## 1. Overview

This PRD defines a quick onboarding and lead qualification flow that triggers after a user's first message in the chatbot. The flow captures the user's property typology preference, budget, and buying timeframe via a multiple-options survey, then asks for name and email. The data is saved to Supabase (authoritative system of record) and selectively to Pinecone (preference signals without PII) to enable personalized recommendations and follow-up.

Primary goal: improve lead capture rate and quality while keeping conversation momentum and adapting next steps to the user’s initial intent.

## 2. Objectives

- Increase qualified lead capture conversion rate with a sub-30s, low-friction survey
- Personalize recommendations using captured preferences in the very next bot turn
- Respect privacy by storing PII only in Supabase; store non-PII preferences in Pinecone
- Make the feature configurable per client (copy, options, enable/disable)
- Ensure re-entry logic: skip or shorten onboarding for returning/known visitors

## 3. User Stories

- As a new visitor, I want a fast survey with clear options so I can share my preferences without typing long messages.
- As a sales team member, I want qualified leads (typology, budget, timeframe, contact) automatically recorded for follow-up.
- As a returning user, I do not want to repeat onboarding, but I want to update my preferences if they change.
- As a product owner, I want the bot to either show relevant listings immediately or handle other intents if the user’s first message isn’t about buying.

## 4. UX & Conversation Flow

Trigger: Immediately after first user message, unless suppressed by configuration or if the message indicates non-buying intent (see Intent Routing below).

Survey steps (quick replies / multiple choice):
1) Typology preference (configurable): T0, T1, T2, T3, T3 Duplex, T4, Other/Not sure
2) Budget: €100–200k, €200–300k, €300–400k, €400–500k, €500k+, Prefer not to say
3) Buying timeframe: ASAP (<1 month), 1–3 months, 3–6 months, 6+ months, Just browsing

Contact capture:
- Name (free text with simple validation)
- Email (email validation, privacy consent copy configurable)

Controls & safeguards:
- Skip/back options at each step; skip allowed but lowers qualification score
- Persist partial progress; if user abandons, don’t block normal chat
- For returning users, pre-fill or skip if data exists; offer “Update my preferences”

## 5. Intent Routing (Post-Onboarding Next Step)

After collecting answers:
- If initial message intent ∈ {buy, purchase, invest, listings}, fetch and present listings matching preferences (via `listing-service` filters).
- Else, proceed to answer the original request. The captured preferences remain available for later personalization.

Intent detection sources (combined):
- Existing tagging rules per client configuration (keywords)
- Lightweight classifier step in backend (simple heuristic or model call; configurable)

## 6. Data Model

Supabase (system of record; PII allowed):
- Use existing table: `public.visitors`
  - Columns in use:
    - `visitor_id` (text): stable ID per session/installation
    - `client_id` (text): tenancy scoping
    - `lead_score` (smallint): qualification score (we update)
    - `onboarding_questions` (jsonb): stores captured onboarding payload
      - Shape v1:
        ```json
        {
          "typology": "T2",
          "budget_bucket": "200-300k",
          "buying_timeframe": "1-3 months",
          "name": "Jane Doe",
          "email": "jane@example.com",
          "consent_marketing": true
        }
        ```
    - `onboarding_completed` (boolean): set true upon successful completion
    - `created_at`, `updated_at`: maintained on writes
    - `is_acknowledged` (boolean): for downstream CRM ops (unchanged here)

Notes:
- PII (name/email) is stored only in Supabase inside `onboarding_questions`.
- Returning users: read from `visitors.onboarding_questions` to prefill/skip steps.

Pinecone (no PII; for personalization and retrieval):
- Upsert a compact “visitor preference profile” vector document under client namespace:
  - id: `visitor_profile_{visitorId}`
  - metadata: { typology, budget_bucket, buying_timeframe, client_id, visitor_id }
  - content: short natural language summary for semantic retrieval

Privacy:
- Do not store name/email in Pinecone. PII only in Supabase (`visitors.onboarding_questions`).

## 7. Backend Scope

New/updated services:
- visitor-service.js (update):
  - Upsert onboarding payload into `visitors.onboarding_questions`
  - Set `onboarding_completed` and update `lead_score`
  - Detect returning visitor and fetch stored preferences
- rag-service.js (update):
  - Accept `onboardingAnswers` in request payload and include a structured, non-PII snapshot in system prompt context
  - Route post-onboarding: listing recommendations vs general assistance
  - Upsert Pinecone preference profile (non-PII)
- listing-service.js (update): accept filters from onboarding (typology, budget bucket) for relevant listing retrieval

API endpoints:
- POST `/v1/visitors/:visitorId/onboarding` → save onboarding (typology, budget, timeframe, name, email, consent) to `visitors.onboarding_questions`, set `onboarding_completed`, update `lead_score`; returns updated visitor
- POST `/v1/onboarding/profile` → upsert Pinecone non-PII preference profile; returns status
- Existing `/api/chat` or `/v1/chat` → accept `onboardingAnswers` and/or look up stored onboarding by `visitorId` for immediate personalization

Config surface (per client):
- Enable/disable onboarding; step order and copy; option lists; consent text; routing thresholds

## 8. Frontend Scope (Widget + Web App)

Widget (`packages/widget/src/App.jsx`):
- Add multi-step quick-reply survey components (typology, budget, timeframe)
- Add Name/Email capture with validation and consent checkbox
- Persist to state and call new endpoint (`/v1/visitors/:visitorId/onboarding`); show graceful errors; allow skip/back
- After submit: either present listing recommendations or continue with original intent flow

Dashboard (optional future):
- In Admin Dashboard, expose configuration editor for copy/options and analytics for conversion funnel

## 9. Decision Logic

Qualification score (simple heuristic v1):
- Base 0; +2 if timeframe <= 3 months; +1 if budget not "prefer not to say"; +1 if specific typology selected
- Use in lead routing and internal analytics (not shown to user)

Routing rule:
- If initial-intent = buying/investing OR user selected concrete typology/budget, immediately recommend top 3–6 listings matching filters
- Else, continue answering original question and keep preferences available for future steps

## 10. Non-Functional Requirements

- Latency: onboarding UI must feel instant (local rendering); network calls < 300ms p95
- Resilience: failures to save data must not block conversation; retry with backoff
- Security: never send PII to Pinecone; validate inputs server-side; rate-limit endpoints
- Compliance: consent copy configurable; email stored with lawful basis; support deletion on request

## 11. Analytics & Events

Track in `events` (and client analytics):
- `onboarding_started`, `onboarding_completed`, `onboarding_skipped`
- `lead_created`, `lead_create_failed`
- Funnel steps with step name and outcome

## 12. Acceptance Criteria

- New visitors are shown a 3-step survey + name/email capture after their first message (unless intent ≠ buying)
- Data persists to Supabase (`visitors.onboarding_questions`, `visitors.onboarding_completed`, `visitors.lead_score`) and non-PII profile to Pinecone
- Returning visitors skip onboarding and can update preferences on demand
- Bot can immediately recommend listings matching captured preferences
- PII never stored in Pinecone; endpoints protected and validated

## 13. Success Metrics

- +25% increase in qualified leads (baseline: current weekly lead count)
- >60% onboarding completion rate among new visitors who start it
- <10% error rate on save operations
- CTR > 20% on recommended listings shown post-onboarding

## 14. Implementation Plan (High-Level)

Phase 1: Backend foundations
- Extend `visitor-service` with onboarding upsert into `visitors`
- Add `/v1/visitors/:visitorId/onboarding` and `/v1/onboarding/profile` endpoints

Phase 2: Frontend onboarding UI
- Implement survey and contact capture in widget; wire to endpoints
- Add re-entry logic for returning users

Phase 3: Personalization & routing
- Update `rag-service` to use `onboardingAnswers` and route to listing recommendations when relevant
- Update `listing-service` to support filters from onboarding

Phase 4: Config, analytics, QA
- Add client-config options; track funnel events; validate privacy and error handling

## 15. Risks & Mitigations

- User drop-off during onboarding → Keep steps minimal, allow skip; show value (personalized picks)
- Privacy concerns → Store PII only in Supabase; audit logs; clear consent copy
- Misclassification of intent → Conservative routing; always allow user to steer back
- Data model drift across clients → Centralize config; validation layer; migrations

## 16. Open Questions

- Exact option labels per client (languages/market)?
- Should we support phone number collection v1 or v2?
- Do we gate recommendations until email is provided, or allow recommendations with partial data?


