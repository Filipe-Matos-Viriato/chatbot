-- packages/backend/supabase_sql_tables/policy_performance.sql
-- Database schema for tracking policy performance and confidence metrics
-- Stores detailed performance data for each policy across complexity levels

CREATE TABLE policy_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complexity_level DECIMAL(3,2) NOT NULL CHECK (complexity_level >= 0 AND complexity_level <= 1),
  policy_version INTEGER NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  sample_size INTEGER DEFAULT 0,
  average_reward DECIMAL(8,4),
  reward_variance DECIMAL(12,8),
  total_selections INTEGER DEFAULT 0,
  successful_selections INTEGER DEFAULT 0,
  average_response_time INTEGER,
  average_cost DECIMAL(8,6),
  average_quality DECIMAL(5,2) CHECK (average_quality >= 0 AND average_quality <= 100),
  policy_weights JSONB,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(complexity_level, policy_version)
);

-- Indexes for performance
CREATE INDEX idx_policy_performance_complexity ON policy_performance(complexity_level);
CREATE INDEX idx_policy_performance_version ON policy_performance(policy_version);
CREATE INDEX idx_policy_performance_confidence ON policy_performance(confidence_score);
CREATE INDEX idx_policy_performance_updated ON policy_performance(last_updated);