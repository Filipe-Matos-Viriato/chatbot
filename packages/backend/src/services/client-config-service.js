// packages/backend/src/services/client-config-service.js
// Service for managing client-specific configurations stored in Supabase with caching.
// To provide dynamic, database-driven configuration management for multi-tenant chatbot system.
// Relevant files: index.js, config/supabase.js
import supabase from '../config/supabase.js';
import NodeCache from 'node-cache';

// Initialize cache with a standard TTL of 15 minutes (900 seconds)
const configCache = new NodeCache({ stdTTL: 900 });

/**
 * Loads the configuration for a specific client from the database.
 * It uses a cache to avoid repeated database calls.
 * @param {string} clientId The ID of the client to load configuration for.
 * @returns {Promise<object>} A promise that resolves to the client's configuration object.
 */
async function getClientConfig(clientId) {
  const cacheKey = `clientConfig_${clientId}`;
  const cachedConfig = configCache.get(cacheKey);

  if (cachedConfig) {
    console.log(`[Cache] HIT for client: ${clientId}`);
    return cachedConfig;
  }

  console.log(`[Cache] MISS for client: ${clientId}. Fetching from database.`);
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('client_id', clientId)
    .single();

  if (error) {
    console.error(`Error fetching configuration for client ${clientId}:`, error);
    throw new Error(`Configuration not found or error fetching for client: ${clientId}`);
  }

  if (!data) {
    throw new Error(`Configuration not found for client: ${clientId}`);
  }

  // Reconstruct the client config object from the database row
  const clientConfig = {
    clientId: data.client_id,
    clientName: data.client_name,
    chatbotName: data.chatbot_name,
    theme: data.theme,
    urlPattern: data.url_pattern,
    prompts: data.prompts,
    leadScoringRules: data.lead_scoring_rules,
    onboardingScoringRules: data.onboarding_scoring_rules || null,
    documentExtraction: data.document_extraction,
    chatHistoryTaggingRules: data.chat_history_tagging_rules,
    chunking_rules: data.chunking_rules,
    tagging_rules: data.tagging_rules,
    listing_tagging_prompt: data.listing_tagging_prompt,
    development_tagging_prompt: data.development_tagging_prompt,
    defaultOnboardingQuestions: data.default_onboarding_questions, // Add onboarding questions field
    // Use widget_settings from the database, with a fallback to the old structure
    widgetSettings: data.widget_settings || {
      primaryColor: data.theme?.primaryColor || "#007bff",
      welcomeMessage: "Olá! Como posso ajudar?",
      headerText: "Fala conosco!"
    },
    // Add onboarding configuration
    onboardingConfig: {
      enabled: data.onboarding_enabled !== false, // Default true
      questions: data.default_onboarding_questions?.questions || null,
      introMessage: data.default_onboarding_questions?.introMessage || null,
      completionMessage: data.default_onboarding_questions?.completionMessage || null
    }
  };

  configCache.set(cacheKey, clientConfig);
  return clientConfig;
}

/**
 * Creates a new client configuration in the database.
 * @param {object} clientData The client configuration data to create.
 * @returns {Promise<object>} A promise that resolves to the newly created client configuration object.
 */
async function createClientConfig(clientData) {
  const { data, error } = await supabase
    .from('clients')
    .insert([clientData])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating client configuration:', error);
    throw new Error('Failed to create client configuration.');
  }
  // No need to cache here, as a get will follow if needed.
  return data;
}

/**
 * Updates an existing client configuration in the database and invalidates the cache.
 * @param {string} clientId The ID of the client to update.
 * @param {object} updates The updates to apply to the client configuration.
 * @returns {Promise<object>} A promise that resolves to the updated client configuration object.
 */
async function updateClientConfig(clientId, updates) {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('client_id', clientId)
    .select('*')
    .single();

  if (error) {
    console.error(`Error updating client configuration for ${clientId}:`, error);
    throw new Error('Failed to update client configuration.');
  }

  // Invalidate the cache for this client
  const cacheKey = `clientConfig_${clientId}`;
  configCache.del(cacheKey);
  console.log(`[Cache] Invalidated for client: ${clientId}`);

  return data;
}

/**
 * Deletes a client configuration from the database and invalidates the cache.
 * @param {string} clientId The ID of the client to delete.
 * @returns {Promise<void>} A promise that resolves when the client configuration is deleted.
 */
async function deleteClientConfig(clientId) {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('client_id', clientId);

  if (error) {
    console.error(`Error deleting client configuration for ${clientId}:`, error);
    throw new Error('Failed to delete client configuration.');
  }

  // Invalidate the cache for this client
  const cacheKey = `clientConfig_${clientId}`;
  configCache.del(cacheKey);
  console.log(`[Cache] Deleted for client: ${clientId}`);
}

/**
 * Gets all client IDs from the database.
 * @returns {Promise<Array>} A promise that resolves to an array of client objects with client_id.
 */
async function getAllClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('client_id, client_name')
    .order('client_id');

  if (error) {
    console.error('Error fetching all clients:', error);
    throw new Error('Failed to fetch clients.');
  }

  return data || [];
}

export {
  getClientConfig,
  createClientConfig,
  updateClientConfig,
  deleteClientConfig,
  getAllClients,
};