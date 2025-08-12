-- File: packages/backend/supabase_sql_tables/get_unanswered_questions_summary.sql
-- Description: SQL function to retrieve a summary of unanswered questions per listing for a given client.
-- Why this file exists: To provide a robust and efficient way to query aggregated unanswered questions directly from Supabase, bypassing potential issues with the Supabase client library's query builder for complex aggregations.
-- Relevant files: packages/backend/src/index.js, packages/frontend/src/dashboard/listing-performance-tab/components/ListingsWithUnansweredQuestions.jsx, packages/backend/supabase_sql_tables/chat_messages.sql

CREATE OR REPLACE FUNCTION get_unanswered_questions_summary(p_client_id uuid)
RETURNS TABLE (listing_id text, unanswered_count bigint)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.listing_id,
    COUNT(cm.id) AS unanswered_count
  FROM
    public.chat_messages cm
  WHERE
    cm.client_id = p_client_id AND
    cm.is_unanswered = TRUE AND
    cm.sender_role = 'user' AND
    cm.listing_id IS NOT NULL
  GROUP BY
    cm.listing_id;
END;
$$;