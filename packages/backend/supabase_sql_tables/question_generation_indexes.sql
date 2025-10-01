-- Database indexes for question generation performance optimization
-- These indexes support the enrichUserContext query in rag-service.js

-- Ensure these indexes exist for optimal performance

-- Visitors table
CREATE INDEX IF NOT EXISTS idx_visitors_visitor_client
ON visitors(visitor_id, client_id);

-- Events table
CREATE INDEX IF NOT EXISTS idx_events_visitor_timestamp
ON events(visitor_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_client_visitor
ON events(client_id, visitor_id);

-- Composite index for the enrichUserContext query
CREATE INDEX IF NOT EXISTS idx_events_visitor_client_timestamp
ON events(visitor_id, client_id, timestamp DESC);