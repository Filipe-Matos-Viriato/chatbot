import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import supabase from '../src/config/supabase.js';

// Recreate __dirname for ES Modules and configure dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const configDirectory = path.join(__dirname, '..', 'configs');

async function migrateClientConfigs() {
    console.log('Starting client configuration migration...');

    try {
        const files = await fs.readdir(configDirectory);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
            const configPath = path.join(configDirectory, file);
            const rawData = await fs.readFile(configPath, 'utf-8');
            const clientConfig = JSON.parse(rawData);

            // Extract relevant fields and prepare for insertion
            const {
                clientId,
                clientName,
                chatbotName,
                theme,
                urlPattern,
                prompts,
                leadScoringRules,
                onboardingScoringRules,
                documentExtraction,
                chatHistoryTaggingRules,
                default_onboarding_questions,
                widgetSettings
            } = clientConfig;

            // Generate a UUID for the client if clientId is not already a UUID
            // For "client-abc", we'll generate a new UUID as per user's instruction
            let clientUuid = clientId;
            if (clientId === 'client-abc') {
                // This is a placeholder. In a real scenario, you'd generate a UUID once
                // and store it, or use a deterministic UUID generation if needed.
                // For this migration, we'll just use a fixed UUID for 'client-abc'
                // to ensure consistency if run multiple times for the same client.
                clientUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Example UUID for client-abc
            } else {
                // If other clients exist and their IDs are already UUIDs, use them directly.
                // Otherwise, a more robust UUID generation/mapping strategy would be needed.
                // For simplicity, assuming 'client-abc' is the only one needing conversion.
            }

            const { data, error } = await supabase
                .from('clients')
                .upsert({
                    client_id: clientUuid,
                    client_name: clientName,
                    chatbot_name: chatbotName,
                    theme: theme,
                    url_pattern: urlPattern,
                    prompts: prompts,
                    lead_scoring_rules: leadScoringRules,
                    onboarding_scoring_rules: onboardingScoringRules,
                    document_extraction: documentExtraction,
                    chat_history_tagging_rules: chatHistoryTaggingRules,
                    default_onboarding_questions: default_onboarding_questions,
                    widget_settings: widgetSettings,
                    updated_at: new Date().toISOString() // Update timestamp on upsert
                }, { onConflict: 'client_id' })
                .select();

            if (error) {
                console.error(`Error upserting client ${clientId} to database:`, error);
            } else {
                console.log(`Successfully migrated client: ${clientName} (ID: ${clientUuid})`);
            }
        }
        console.log('Client configuration migration completed.');
    } catch (error) {
        console.error('Error during client configuration migration:', error);
    }
}

migrateClientConfigs();