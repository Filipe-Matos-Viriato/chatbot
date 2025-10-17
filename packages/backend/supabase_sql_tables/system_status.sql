-- packages/backend/supabase_sql_tables/system_status.sql
-- Database schema for tracking learning engine system status and parameters
-- Stores current system configuration and operational status

CREATE TABLE system_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('active', 'inactive', 'error', 'unknown')),
  current_value JSONB,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system status records
INSERT INTO system_status (component_name, status, current_value) VALUES
  ('learning_engine', 'active', '{"enabled": true, "adaptationRate": 0.1, "explorationRate": 0.1, "confidenceThreshold": 0.8}'),
  ('data_collection', 'active', '{"enabled": true, "bufferSize": 1000, "flushInterval": 60000}'),
  ('model_router', 'active', '{"fallbackModel": "gpt-4.1", "maxCost": 0.01, "maxResponseTime": 10000}'),
  ('performance_tracker', 'active', '{"cacheSize": 1000, "cacheTTL": 300000}'),
  ('real_time_learning', 'active', '{"windowSize": 1000, "minRetrainingInterval": 604800000}');

-- Indexes for performance
CREATE INDEX idx_system_status_component ON system_status(component_name);
CREATE INDEX idx_system_status_status ON system_status(status);
CREATE INDEX idx_system_status_updated ON system_status(last_updated);