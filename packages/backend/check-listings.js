import 'dotenv/config';
import supabase from './src/config/supabase.js';

async function checkListings() {
  try {
    // Get a sample listing to see structure
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error fetching listings:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('Sample listings:');
      console.log(JSON.stringify(data, null, 2));
      console.log(`\nColumns in listings table: ${Object.keys(data[0]).join(', ')}`);
    } else {
      console.log('No listings found in the table');
    }
  } catch (err) {
    console.error('Script error:', err);
  }
}

checkListings();
