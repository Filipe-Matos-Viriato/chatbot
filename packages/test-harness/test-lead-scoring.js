/**
 * Test script for the new lead scoring model
 */
const fetch = require('node-fetch');
const { setTimeout } = require('timers/promises');

async function testLeadScoring() {
  console.log('Starting lead scoring test...');

  // 1. Create a new visitor
  console.log('1. Creating a new visitor...');
  const createVisitorResponse = await fetch('http://localhost:3006/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ clientId: 'client-abc' }),
  });

  const createVisitorData = await createVisitorResponse.json();
  if (!createVisitorData.visitor_id) {
    console.error('Failed to create visitor:', createVisitorData);
    return;
  }

  const visitorId = createVisitorData.visitor_id;
  console.log(`Created visitor with ID: ${visitorId}`);

  // 2. Test engagement behavior events
  console.log('2. Testing engagement behavior events...');

  // Test time spent events
  await testEvent(visitorId, 'TIME_5_10_MIN', 5);
  await testEvent(visitorId, 'TIME_10_PLUS_MIN', 10);

  // Test questions asked events
  await testEvent(visitorId, 'QUESTIONS_3_5', 5);
  await testEvent(visitorId, 'QUESTIONS_6_10', 10);
  await testEvent(visitorId, 'QUESTIONS_10_PLUS', 15);

  // Test other engagement events
  await testEvent(visitorId, 'CLICKED_LISTING', 5);
  await testEvent(visitorId, 'RETURNED_WITHIN_48H', 10);

  // 3. Test question intent & quality events
  console.log('3. Testing question intent & quality events...');
  await testEvent(visitorId, 'ASKED_PRICING', 10);
  await testEvent(visitorId, 'ASKED_LOCATION', 10);
  await testEvent(visitorId, 'ASKED_LEGAL', 10);
  await testEvent(visitorId, 'ASKED_REMOTE_BUYING', 10);
  await testEvent(visitorId, 'ASKED_DETAILS', 5);
  await testEvent(visitorId, 'ASKED_AVAILABILITY', 5);

  // 4. Test conversion actions events
  console.log('4. Testing conversion actions events...');
  await testEvent(visitorId, 'SUBMITTED_CONTACT', 15);
  await testEvent(visitorId, 'BOOKED_VIEWING', 30);
  await testEvent(visitorId, 'ASKED_CONTACT_AGENT', 20);
  await testEvent(visitorId, 'REQUESTED_BROCHURE', 10);

  // 5. Get final visitor score
  console.log('5. Getting final visitor score...');
  const finalVisitor = await fetchVisitor(visitorId);
  console.log(`Final lead score: ${finalVisitor.lead_score}`);

  // 6. Verify lead qualification thresholds
  console.log('6. Verifying lead qualification thresholds...');
  if (finalVisitor.lead_score >= 70) {
    console.log('✅ Lead qualification: HOT LEAD (Ready for agent follow-up)');
  } else if (finalVisitor.lead_score >= 40) {
    console.log('✅ Lead qualification: WARM LEAD (Nurture with follow-up content)');
  } else {
    console.log('✅ Lead qualification: COLD LEAD (Keep in CRM for future re-engagement)');
  }

  console.log('Lead scoring test completed!');
}

async function testEvent(visitorId, eventType, expectedScoreImpact) {
  const response = await fetch('http://localhost:3006/v1/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': 'client-abc',
    },
    body: JSON.stringify({ visitorId, eventType }),
  });

  const data = await response.json();
  if (data.success) {
    console.log(`✅ Event '${eventType}' tracked. New score: ${data.new_lead_score} (expected impact: ${expectedScoreImpact})`);
  } else {
    console.error(`❌ Failed to track event '${eventType}':`, data);
  }

  // Wait a moment between events to simulate real usage
  await setTimeout(100);
}

async function fetchVisitor(visitorId) {
  const response = await fetch('http://localhost:3006/v1/visitor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ visitorId }),
  });

  return await response.json();
}

// Run the test
testLeadScoring().catch(console.error);