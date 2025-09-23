#!/usr/bin/env node

// packages/backend/scripts/apply-score-decay.js
import * as clientConfigService from '../src/services/client-config-service.js';
import visitorService from '../src/services/visitor-service.js';

/**
 * Daily cron job to apply score decay to stagnant visitors across all clients
 */
async function applyScoreDecayToAllClients() {
  try {
    console.log('🔄 Starting daily score decay process...');

    // Get all client IDs
    const clients = await clientConfigService.getAllClients();

    if (!clients || clients.length === 0) {
      console.log('No clients found');
      return;
    }

    console.log(`Found ${clients.length} clients to process`);

    // Apply decay to each client
    for (const client of clients) {
      console.log(`Processing client: ${client.client_id || client.id}`);
      await visitorService.applyScoreDecay(client.client_id || client.id);
    }

    console.log('✅ Daily score decay process completed');
  } catch (error) {
    console.error('❌ Error in daily score decay process:', error);
    process.exit(1);
  }
}

// Run the script
applyScoreDecayToAllClients();