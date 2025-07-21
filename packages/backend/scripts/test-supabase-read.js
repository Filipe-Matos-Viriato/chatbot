const dotenv = require('dotenv');
dotenv.config({ path: '../.env' }); // Load environment variables from .env in the backend package

const supabase = require('../src/config/supabase');

async function testSupabaseRead() {
  console.log('Attempting to read one record from Supabase "visitors" table...');
  try {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .limit(1); // Fetch only one record

    if (error) {
      console.error('Error reading from Supabase:', error);
    } else if (data && data.length > 0) {
      console.log('Successfully read one record from Supabase:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('No records found in "visitors" table.');
    }
  } catch (e) {
    console.error('An unexpected error occurred:', e);
  }
}

testSupabaseRead();