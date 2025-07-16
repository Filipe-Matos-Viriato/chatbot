const fs = require('fs').promises;
const path = require('path');

const configDirectory = path.join(__dirname, '..', '..', 'configs');

/**
 * Loads the configuration for a specific client.
 * @param {string} clientId The ID of the client to load configuration for.
 * @returns {Promise<object>} A promise that resolves to the client's configuration object.
 */
async function getClientConfig(clientId) {
  const configPath = path.join(configDirectory, `${clientId}.json`);
  try {
    const rawData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Configuration file not found for client: ${clientId}`);
      throw new Error(`Configuration not found for client: ${clientId}`);
    }
    console.error(`Error reading or parsing config for client: ${clientId}`, error);
    throw new Error(`Error loading configuration for client: ${clientId}`);
  }
}

module.exports = {
  getClientConfig,
};