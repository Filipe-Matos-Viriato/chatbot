const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const { createDevelopment } = require('../src/services/development-service');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables. Please ensure your .env file is correctly configured.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  const client_id = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';
  const developmentName = 'Evergreen Pure';
  const developmentDescription = 'Projeto exclusivo localizado a 5 minutos do centro de Aveiro. Combina charme, modernidade e funcionalidade. Harmonia perfeita entre design e vida urbana. Refúgio de sofisticação, conforto e tranquilidade próximo ao centro vibrante';

  const developmentData = {
    client_id: client_id,
    name: developmentName,
    description: developmentDescription,
  };

  try {
    const newDevelopment = await createDevelopment(developmentData);
    console.log('Development created successfully:', newDevelopment);
  } catch (error) {
    console.error('Error creating development:', error.message);
  } finally {
    // In a real application, you might not close the connection here
    // but for a script, it's good practice. Supabase client manages connections.
  }
}

main();