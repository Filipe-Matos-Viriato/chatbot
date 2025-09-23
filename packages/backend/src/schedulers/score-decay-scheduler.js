// packages/backend/src/schedulers/score-decay-scheduler.js
// Scheduler service that automatically applies lead score decay to visitors daily using cron jobs.
// To maintain accurate lead scoring by gradually reducing scores over time, ensuring only active and engaged visitors remain as high-priority leads.
// Relevant files: services/client-config-service.js, services/visitor-service.js
import cron from 'node-cron';
import * as clientConfigService from '../services/client-config-service.js';
import visitorService from '../services/visitor-service.js';

class ScoreDecayScheduler {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('📅 Score decay scheduler is already running');
      return;
    }

    // Schedule daily score decay at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🔄 Running automated score decay...');

      try {
        // Automatically get all clients
        const clients = await clientConfigService.getAllClients();

        if (!clients || clients.length === 0) {
          console.log('No clients found for score decay');
          return;
        }

        console.log(`Processing score decay for ${clients.length} clients`);

        // Process each client
        for (const client of clients) {
          console.log(`Processing client: ${client.client_id}`);
          try {
            await visitorService.applyScoreDecay(client.client_id);
          } catch (clientError) {
            console.error(`Error processing client ${client.client_id}:`, clientError);
            // Continue with other clients even if one fails
          }
        }

        console.log('✅ Automated score decay completed successfully');
      } catch (error) {
        console.error('❌ Error in automated score decay:', error);
      }
    }, {
      timezone: "Europe/Lisbon" // Adjust to your timezone
    });

    this.isRunning = true;
    console.log('📅 Score decay scheduler started - will run daily at 2 AM');
  }

  stop() {
    // Note: node-cron doesn't provide a direct way to stop individual jobs
    // This would require keeping track of the scheduled job and destroying it
    console.log('📅 Score decay scheduler stop requested - restart required to take effect');
    this.isRunning = false;
  }

  // Manual trigger for testing
  async runNow() {
    console.log('🔄 Running manual score decay...');

    try {
      const clients = await clientConfigService.getAllClients();

      if (!clients || clients.length === 0) {
        console.log('No clients found for score decay');
        return;
      }

      console.log(`Processing score decay for ${clients.length} clients`);

      for (const client of clients) {
        console.log(`Processing client: ${client.client_id}`);
        await visitorService.applyScoreDecay(client.client_id);
      }

      console.log('✅ Manual score decay completed successfully');
    } catch (error) {
      console.error('❌ Error in manual score decay:', error);
      throw error;
    }
  }
}

export default new ScoreDecayScheduler();