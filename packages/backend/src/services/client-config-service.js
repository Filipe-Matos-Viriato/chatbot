import supabase from '../config/supabase.js';

/**
 * Loads the configuration for a specific client from the database.
 * @param {string} clientId The ID of the client to load configuration for.
 * @returns {Promise<object>} A promise that resolves to the client's configuration object.
 */
async function getClientConfig(clientId) {
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
    documentExtraction: data.document_extraction,
    chatHistoryTaggingRules: data.chat_history_tagging_rules,
    chunking_rules: data.chunking_rules,
    tagging_rules: data.tagging_rules,
    defaultOnboardingQuestions: data.default_onboarding_questions, // Add onboarding questions field
    // Add widgetSettings derived from theme for widget consumption
    widgetSettings: {
      primaryColor: data.theme?.primaryColor || "#007bff",
      welcomeMessage: "Hello! How can I help you today?",
      headerText: "Chat with us!"
    }
  };

  return clientConfig;
}

export {
  getClientConfig,
  createClientConfig,
  updateClientConfig,
  deleteClientConfig,
};

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
  return data;
}

/**
 * Updates an existing client configuration in the database.
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
  return data;
}

/**
 * Deletes a client configuration from the database.
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
}