-- packages/backend/supabase_sql_tables/model_discovery_events.sql
-- Database schema for tracking model discovery and usage patterns
-- Records when models are first discovered and their ongoing performance metrics

CREATE TABLE model_discovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  discovery_date DATE NOT NULL,
  first_used_at TIMESTAMP WITH TIME ZONE NOT NULL,
  current_usage_percentage DECIMAL(5,2) DEFAULT 0 CHECK (current_usage_percentage >= 0 AND current_usage_percentage <= 100),
  total_selections INTEGER DEFAULT 0,
  successful_selections INTEGER DEFAULT 0,
  average_performance DECIMAL(5,2) CHECK (average_performance >= 0 AND average_performance <= 100),
  average_cost DECIMAL(8,6),
  average_response_time INTEGER,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  discovery_method TEXT DEFAULT 'exploration', -- 'exploration', 'manual', 'fallback'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_name)
);

-- Indexes for performance
CREATE INDEX idx_model_discovery_model_name ON model_discovery_events(model_name);
CREATE INDEX idx_model_discovery_discovery_date ON model_discovery_events(discovery_date);
CREATE INDEX idx_model_discovery_active ON model_discovery_events(is_active);