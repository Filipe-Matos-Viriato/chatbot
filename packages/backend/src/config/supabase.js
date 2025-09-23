// packages/backend/src/config/supabase.js
// Configuration module for Supabase database client, handling connection and environment setup.
// To provide a centralized database connection for storing and retrieving application data like listings, visitors, and chat messages.
// Relevant files: index.js, services/listing-service.js, services/visitor-service.js, services/user-service.js
import { createClient } from '@supabase/supabase-js';
// Add dotenv config to load environment variables in scripts
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;