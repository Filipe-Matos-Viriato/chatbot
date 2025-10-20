-- packages/backend/supabase_sql_tables/batch_processing_settings.sql
-- Database schema for storing dynamic batch processing settings per client
-- Allows administrators to configure batch sizes for different processing systems per client

CREATE TABLE IF NOT EXISTS batch_processing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  system_name TEXT NOT NULL, -- 'learning_engine' or 'analytics_logger'
  batch_trigger_threshold INTEGER NOT NULL CHECK (batch_trigger_threshold > 0),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  UNIQUE(client_id, system_name) -- One setting per client per system
);

-- Insert default settings for existing clients and systems
-- This will be populated when clients are created or migrated
-- For now, we'll rely on application defaults

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_batch_processing_settings_client_system
ON batch_processing_settings(client_id, system_name);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_batch_processing_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_batch_processing_settings_updated_at
  BEFORE UPDATE ON batch_processing_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_processing_settings_updated_at();