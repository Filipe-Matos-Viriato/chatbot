-- packages/backend/supabase_sql_tables/exploration_history.sql
-- Database schema for tracking exploration vs exploitation patterns over time
-- Stores daily aggregated metrics for learning engine analytics dashboard

CREATE TABLE exploration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  exploration_rate DECIMAL(5,4) NOT NULL CHECK (exploration_rate >= 0 AND exploration_rate <= 1),
  exploitation_rate DECIMAL(5,4) NOT NULL CHECK (exploitation_rate >= 0 AND exploitation_rate <= 1),
  models_explored INTEGER DEFAULT 0,
  new_discoveries INTEGER DEFAULT 0,
  total_selections INTEGER DEFAULT 0,
  exploration_selections INTEGER DEFAULT 0,
  exploitation_selections INTEGER DEFAULT 0,
  average_confidence DECIMAL(5,4) CHECK (average_confidence >= 0 AND average_confidence <= 1),
  average_performance DECIMAL(5,2) CHECK (average_performance >= 0 AND average_performance <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_exploration_history_date ON exploration_history(date);
CREATE INDEX idx_exploration_history_created_at ON exploration_history(created_at);