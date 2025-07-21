const dotenv = require('dotenv');
dotenv.config({ path: '../.env' }); // Load environment variables from .env in the backend package

const fetch = require('node-fetch');
const { setTimeout } = require('timers/promises');

const BASE_URL = 'http://localhost:3006';
const CLIENT_ID = 'client-abc'; // Assuming a default client ID for simulation

const EVENT_TYPES = {
  ENGAGEMENT: [
    'QUESTIONS_3_5', 'QUESTIONS_6_10', 'QUESTIONS_10_PLUS',
    'TIME_5_10_MIN', 'TIME_10_PLUS_MIN',
    'CLICKED_LISTING', 'RETURNED_WITHIN_48H'
  ],
  INTENT_QUALITY: [
    'ASKED_PRICING', 'ASKED_LOCATION', 'ASKED_LEGAL', 'ASKED_REMOTE_BUYING',
    'ASKED_DETAILS', 'ASKED_AVAILABILITY'
  ],
  CONVERSION: [
    'SUBMITTED_CONTACT', 'BOOKED_VIEWING', 'ASKED_CONTACT_AGENT', 'REQUESTED_BROCHURE'
  ]
};

async function createVisitorSession() {
  const response = await fetch(`${BASE_URL}/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID }),
  });
  console.log('Raw response status:', response.status);
  const responseText = await response.text();
  console.log('Raw response text:', responseText);
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse JSON response:', e);
    throw new Error('Failed to create visitor session: Invalid JSON response');
  }

  if (!data.visitor_id) {
    console.error('Failed to create visitor session:', data);
    throw new Error('Failed to create visitor session');
  }
  return data.visitor_id;
}

async function logEvent(visitorId, eventType) {
  const response = await fetch(`${BASE_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': CLIENT_ID,
    },
    body: JSON.stringify({ visitorId, eventType }),
  });
  const data = await response.json();
  if (!data.success) {
    console.error(`Failed to log event ${eventType} for ${visitorId}:`, data);
  } else {
    console.log(`Logged event ${eventType} for ${visitorId}. New score: ${data.new_lead_score}`);
  }
  await setTimeout(50); // Small delay to simulate real-world interaction
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function simulateUser(userIndex) {
  console.log(`Simulating user ${userIndex + 1}...`);
  const visitorId = await createVisitorSession();

  // Simulate diverse chat interactions (random number of messages)
  const numChatInteractions = getRandomInt(3, 20);
  for (let i = 0; i < numChatInteractions; i++) {
    // In a real scenario, this would be actual chat messages, but for lead scoring,
    // we're primarily interested in the events they trigger.
    // For simplicity, we'll just log a random engagement event.
    await logEvent(visitorId, getRandomElement(EVENT_TYPES.ENGAGEMENT));
  }

  // Simulate diverse lead scores by logging a random number of intent/conversion events
  const numIntentEvents = getRandomInt(0, 5);
  for (let i = 0; i < numIntentEvents; i++) {
    await logEvent(visitorId, getRandomElement(EVENT_TYPES.INTENT_QUALITY));
  }

  const numConversionEvents = getRandomInt(0, 2);
  for (let i = 0; i < numConversionEvents; i++) {
    await logEvent(visitorId, getRandomElement(EVENT_TYPES.CONVERSION));
  }

  console.log(`Finished simulating user ${userIndex + 1} (${visitorId}).`);
}

async function populateSimulatedData(numUsers) {
  console.log(`Starting simulation for ${numUsers} users...`);
  for (let i = 0; i < numUsers; i++) {
    await simulateUser(i);
  }
  console.log(`Simulation completed for ${numUsers} users.`);
}

// Run the simulation
const NUM_SIMULATED_USERS = 30;
populateSimulatedData(NUM_SIMULATED_USERS).catch(console.error);