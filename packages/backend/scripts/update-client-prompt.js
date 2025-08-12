/**
 * Update a client's system prompt in Supabase `clients` table by merging a new systemInstruction.
 * Usage:
 *   node -r dotenv/config packages/backend/scripts/update-client-prompt.js --clientId <CLIENT_ID>
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../src/config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  try {
    const fallbackConfigPath = path.join(__dirname, '../configs/e6f484a3-c3cb-4e01-b8ce-a276f4b7355c.json');
    const cfgRaw = fs.existsSync(fallbackConfigPath) ? fs.readFileSync(fallbackConfigPath, 'utf-8') : null;
    const cfgJson = cfgRaw ? JSON.parse(cfgRaw) : {};
    const defaultClientId = cfgJson.clientId || null;
    const newSystemInstruction = cfgJson?.prompts?.systemInstruction || null;

    const clientId = getArg('--clientId', process.env.CLIENT_ID || defaultClientId);
    if (!clientId) {
      console.error('Missing --clientId and no default found in configs.');
      process.exit(1);
    }
    if (!newSystemInstruction) {
      console.error('No new systemInstruction found in configs JSON.');
      process.exit(1);
    }

    console.log(`[update-client-prompt] Target clientId=${clientId}`);

    // Fetch current prompts
    const { data: row, error: fetchError } = await supabase
      .from('clients')
      .select('prompts')
      .eq('client_id', clientId)
      .single();
    if (fetchError) {
      console.error('Failed to fetch current client config:', fetchError);
      process.exit(1);
    }

    const currentPrompts = row?.prompts || {};
    const updatedPrompts = { ...currentPrompts, systemInstruction: newSystemInstruction };

    const { data: updated, error: updateError } = await supabase
      .from('clients')
      .update({ prompts: updatedPrompts })
      .eq('client_id', clientId)
      .select('*')
      .single();
    if (updateError) {
      console.error('Failed to update client prompts:', updateError);
      process.exit(1);
    }

    console.log(`[update-client-prompt] ✅ Updated systemInstruction for client ${clientId}.`);
    console.log(`[update-client-prompt] Preview (first 200 chars):\n${String(newSystemInstruction).slice(0, 200)}...`);
  } catch (err) {
    console.error('[update-client-prompt] Unhandled error:', err);
    process.exit(1);
  }
}

main();


