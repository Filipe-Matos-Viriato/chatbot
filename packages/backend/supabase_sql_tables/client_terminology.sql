-- packages/backend/supabase_sql_tables/client_terminology.sql
-- Client-specific terminology configurations for Portuguese language localization
-- To store terminology mappings and rules for European Portuguese localization

-- Client terminology configurations
CREATE TABLE client_terminology (
  client_id UUID PRIMARY KEY REFERENCES clients(client_id),
  primary_dialect TEXT NOT NULL DEFAULT 'european',
  term_mappings JSONB NOT NULL DEFAULT '[]',
  custom_rules JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Terminology usage analytics
CREATE TABLE terminology_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  visitor_id TEXT,
  original_term TEXT NOT NULL,
  replaced_term TEXT NOT NULL,
  context TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced analytics for terminology effectiveness tracking
CREATE TABLE terminology_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  prompt_strategy TEXT NOT NULL,
  postprocessing_applied BOOLEAN NOT NULL,
  terms_corrected INTEGER NOT NULL DEFAULT 0,
  response_quality_score DECIMAL(3,2),
  user_feedback_score DECIMAL(3,2),
  processing_time_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B testing for localization strategies
CREATE TABLE localization_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  client_id UUID REFERENCES clients(client_id),
  variant_a TEXT NOT NULL, -- e.g., "llm_only"
  variant_b TEXT NOT NULL, -- e.g., "hybrid"
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  results JSONB
);

-- Add indexes for performance
CREATE INDEX idx_terminology_analytics_client_timestamp ON terminology_analytics(client_id, timestamp);
CREATE INDEX idx_terminology_effectiveness_client ON terminology_effectiveness(client_id);
CREATE INDEX idx_localization_ab_tests_status ON localization_ab_tests(status);