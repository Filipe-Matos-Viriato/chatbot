import dotenv from 'dotenv';
import path from 'path'; // Add path module
dotenv.config(); // Load .env from current working directory

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // Import uuidv4

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const QUESTIONS_PER_VISITOR_PER_LISTING = 2;
const UNANSWERED_PERCENTAGE = 0.2; // 20% of questions will be marked as unanswered

const sampleQuestions = [
  "What is the price of this property?",
  "How many bedrooms does it have?",
  "Is there a garden?",
  "What are the nearest schools?",
  "Can I book a viewing?",
  "What are the property taxes?",
  "Is this property pet-friendly?",
  "What is the total area in square meters?",
  "Are there any recent renovations?",
  "What is the average utility cost?",
  "Is it close to public transport?",
  "What's the neighborhood like?",
  "Are there any open houses scheduled?",
  "What's the closing process like?",
  "Can I get a virtual tour?",
  "What's the energy efficiency rating?",
  "Is there parking available?",
  "How old is the building?",
  "What amenities are included?",
  "Is it furnished?",
  "What is the office's operating hours?",
  "Can you tell me more about the financing options?",
  "What is the return on investment for this property?",
  "Are there any legal considerations I should be aware of?",
  "Is it possible to buy this property remotely?",
  "What are the investment options for this area?",
  "Can you provide more details about the property's condition?",
  "What are the specific amenities included?",
  "Can you describe the layout of the property?",
  "Is the property currently available?",
  "What is the urgency to sell this property?"
];

const sampleResponses = [
  "The price of this property is $500,000.",
  "It has 3 bedrooms.",
  "Yes, there is a spacious garden.",
  "The nearest schools are ABC Elementary and XYZ High School.",
  "Yes, you can book a viewing by contacting our agent.",
  "Property taxes are approximately $2,500 per year.",
  "Yes, this property is pet-friendly.",
  "The total area is 150 square meters.",
  "It was recently renovated last year.",
  "The average utility cost is around $200 per month.",
  "Yes, it's conveniently located near public transport.",
  "The neighborhood is quiet and family-friendly.",
  "No open houses are scheduled at the moment, but private viewings are available.",
  "Our team will guide you through the closing process step-by-step.",
  "Yes, a virtual tour is available on our website.",
  "It has an energy efficiency rating of B.",
  "Yes, there is a dedicated parking space.",
  "The building was constructed in 1990.",
  "Amenities include a swimming pool and a gym.",
  "No, the property is unfurnished.",
  "Our office operates from 9 AM to 5 PM, Monday to Friday.",
  "We offer various financing options, please contact us for details.",
  "The return on investment for this property is estimated at 7% annually.",
  "Please consult with a legal professional for specific legal considerations.",
  "Yes, remote buying options are available, we can assist you with the process.",
  "This area is known for its strong rental market and potential for appreciation.",
  "The property is in excellent condition, well-maintained by the current owners.",
  "The specific amenities include a modern kitchen, built-in wardrobes, and a balcony.",
  "The layout is open-plan with a large living area and separate dining space.",
  "Yes, the property is currently available for sale.",
  "What is the urgency to sell this property?"
];

async function populateQuestionsTable() {
  console.log('Populating questions table with simulated data...');

  // Fetch existing visitors
  const { data: visitors, error: visitorsError } = await supabase
    .from('visitors')
    .select('visitor_id');

  if (visitorsError) {
    console.error('Error fetching visitors:', visitorsError);
    return;
  }
  if (!visitors || visitors.length === 0) {
    console.log('No visitors found. Please run populate-simulated-data.js first.');
    return;
  }
  console.log(`Found ${visitors.length} visitors.`);

  // Fetch existing listings
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id');

  if (listingsError) {
    console.error('Error fetching listings:', listingsError);
    return;
  }
  if (!listings || listings.length === 0) {
    console.log('No listings found. Please ensure the listings table is populated.');
    return;
  }
  console.log(`Found ${listings.length} listings.`);

  const questionsToInsert = [];

  for (const visitor of visitors) {
    for (const listing of listings) {
      for (let i = 0; i < QUESTIONS_PER_VISITOR_PER_LISTING; i++) {
        const randomQuestion = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
        const isUnanswered = Math.random() < UNANSWERED_PERCENTAGE;

        questionsToInsert.push({
          visitor_id: visitor.visitor_id,
          listing_id: listing.id,
          question_text: randomQuestion,
          chatbot_response: isUnanswered ? null : sampleResponses[Math.floor(Math.random() * sampleResponses.length)],
          asked_at: new Date().toISOString(), // Use 'asked_at' column
          status: isUnanswered ? 'unanswered' : 'answered', // Use 'status' column
          visitor_id: visitor.visitor_id // Use visitor_id
        });
      }
    }
  }

  console.log(`Inserting ${questionsToInsert.length} questions...`);

  const { error: insertError } = await supabase
    .from('questions')
    .insert(questionsToInsert);

  if (insertError) {
    console.error('Error inserting questions:', insertError);
  } else {
    console.log('Successfully populated questions table.');
  }
}

populateQuestionsTable().catch(console.error);