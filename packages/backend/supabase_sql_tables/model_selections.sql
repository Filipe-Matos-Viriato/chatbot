-- packages/backend/supabase_sql_tables/model_selections.sql
-- Database schema for model selection tracking and performance analytics
-- Stores model selection decisions, performance metrics, and learning signals
-- performance-tracker.js, real-time-learning-engine.js, model-router.js

CREATE TABLE model_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id TEXT NOT NULL UNIQUE,
  selected_model TEXT NOT NULL,
  complexity_score DECIMAL(3,2) NOT NULL CHECK (complexity_score >= 0 AND complexity_score <= 1),
  token_count INTEGER,
  estimated_cost DECIMAL(8,6),
  actual_cost DECIMAL(8,6),
  response_quality_score DECIMAL(3,2) CHECK (response_quality_score >= 0 AND response_quality_score <= 1),
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_type TEXT,
  token_usage INTEGER,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,
  constraints JSONB,
  exploration_used BOOLEAN DEFAULT false,
  policy_applied BOOLEAN DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_model_selections_query_id ON model_selections(query_id);
CREATE INDEX idx_model_selections_selected_model ON model_selections(selected_model);
CREATE INDEX idx_model_selections_timestamp ON model_selections(timestamp);
CREATE INDEX idx_model_selections_complexity ON model_selections(complexity_score);
CREATE INDEX idx_model_selections_success ON model_selections(success);