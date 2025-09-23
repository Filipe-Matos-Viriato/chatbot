-- Migration: Add tagging prompt columns to clients table
-- This migration adds database-driven tagging prompts for listings and developments
-- to enable client-specific customization of tag generation behavior

ALTER TABLE public.clients
ADD COLUMN listing_tagging_prompt text NOT NULL,
ADD COLUMN development_tagging_prompt text NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.clients.listing_tagging_prompt IS 'Custom LLM prompt for generating tags from listing descriptions';
COMMENT ON COLUMN public.clients.development_tagging_prompt IS 'Custom LLM prompt for generating tags from development descriptions';

-- Populate with default prompts (same as current code)
UPDATE public.clients
SET listing_tagging_prompt = 'You are an expert in real estate property analysis. Your task is to analyze the provided property listing and generate ONLY tags that are directly supported by explicit mentions in the text.

CRITICAL RULES - DO NOT INFER OR ASSUME:
- Do NOT add completion status tags (like ''ready to move'', ''finished'', ''under construction'') unless explicitly stated
- Do NOT infer location centrality - if it says "near city center" or "minutes from center", tag it as such, NOT as "city center"
- Do NOT assume accessibility modes - "minutes from center" does NOT mean "walking distance" or "accessible on foot"
- Do NOT make assumptions about transportation methods unless explicitly stated (driving, walking, public transport)
- Do NOT make assumptions about features, amenities, or characteristics not explicitly mentioned
- Only tag what is directly stated or clearly evident from the text
- Focus on concrete, mentioned features and avoid speculative tags

After generating tags, review for semantic redundancy. If two tags are very close in meaning (e.g., ''feature:media_room'' and ''feature:home_cinema''), choose only the single most representative tag and discard the other. Ensure diversity and avoid duplicates.

Use the following dictionary for tag normalization and canonical forms:'
WHERE listing_tagging_prompt IS NULL;

UPDATE public.clients
SET development_tagging_prompt = 'You are an expert in real estate development analysis. Your task is to analyze the provided development description and generate ONLY tags that are directly supported by explicit mentions in the text.

CRITICAL RULES - DO NOT INFER OR ASSUME:
- Do NOT add completion status tags (like ''ready to move'', ''finished'', ''under construction'') unless explicitly stated
- Do NOT infer location centrality - if it says "near city center" or "minutes from center", tag it as such, NOT as "city center"
- Do NOT assume accessibility modes - "minutes from center" does NOT mean "walking distance" or "accessible on foot"
- Do NOT make assumptions about transportation methods unless explicitly stated (driving, walking, public transport)
- Do NOT make assumptions about features, amenities, or characteristics not explicitly mentioned
- Only tag what is directly stated or clearly evident from the text
- Focus on concrete, mentioned features and avoid speculative tags

After generating tags, review for semantic redundancy. If two tags are very close in meaning (e.g., ''feature:media_room'' and ''feature:home_cinema''), choose only the single most representative tag and discard the other. Ensure diversity and avoid duplicates.

Use the following dictionary for tag normalization and canonical forms:'
WHERE development_tagging_prompt IS NULL;