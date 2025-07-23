const dotenv = require('dotenv');
const path = require('path'); // Add path module
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Use absolute path

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables. Please ensure your .env file is correctly configured.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey); // Use service role key

async function createTables() {
  try {
    // Create 'listings' table
    const { error: listingsError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS listings (
          id TEXT PRIMARY KEY,
          name TEXT,
          address TEXT,
          type TEXT,
          price TEXT,
          beds INTEGER,
          baths INTEGER,
          amenities TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `
    });
    if (listingsError) throw listingsError;
    console.log('Table "listings" created or already exists.');

    // Create 'listing_metrics' table
    const { error: listingMetricsError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS listing_metrics (
          listing_id TEXT PRIMARY KEY REFERENCES listings(id),
          chatbot_views INTEGER DEFAULT 0,
          inquiries INTEGER DEFAULT 0,
          unacknowledged_hot_leads INTEGER DEFAULT 0,
          conversion_rate TEXT DEFAULT '0%',
          lead_score_distribution_hot INTEGER DEFAULT 0,
          lead_score_distribution_warm INTEGER DEFAULT 0,
          lead_score_distribution_cold INTEGER DEFAULT 0,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `
    });
    if (listingMetricsError) throw listingMetricsError;
    console.log('Table "listing_metrics" created or already exists.');

    // Create 'questions' table
    const { error: questionsError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS questions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          listing_id TEXT REFERENCES listings(id),
          question_text TEXT,
          status TEXT, -- Changed from is_unanswered BOOLEAN to status TEXT
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(), -- Added timestamp with default
          visitor_id TEXT -- Changed from client_id to visitor_id
        );
      `
    });
    if (questionsError) throw questionsError;
    console.log('Table "questions" created or already exists.');

    // Create 'handoffs' table
    const { error: handoffsError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS handoffs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          visitor_id TEXT, -- Assuming visitor_id is TEXT, adjust if UUID
          listing_id TEXT REFERENCES listings(id),
          reason TEXT,
          handoff_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          client_id TEXT
        );
      `
    });
    if (handoffsError) throw handoffsError;
    console.log('Table "handoffs" created or already exists.');

    // Create 'events' table
    const { error: eventsError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          visitor_id TEXT,
          event_type TEXT NOT NULL,
          score_impact INTEGER DEFAULT 0,
          listing_id TEXT REFERENCES listings(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `
    });
    if (eventsError) throw eventsError;
    console.log('Table "events" created or already exists.');

    // Alter 'visitors' table to add 'chat_history' column and remove listing_id
    const { error: alterVisitorsError } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE visitors
        ADD COLUMN IF NOT EXISTS chat_history TEXT;
      `
    });
    if (alterVisitorsError) throw alterVisitorsError;
    console.log('Column "chat_history" added to "visitors" table if it did not exist.');

    console.log('All tables and columns processed successfully.');

  } catch (error) {
    console.error('Error creating tables:', error.message);
  } finally {
    // In a real application, you might not close the connection here
    // but for a script, it's good practice. Supabase client manages connections.
  }
}

createTables();