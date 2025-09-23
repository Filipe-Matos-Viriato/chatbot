// Test script for configurable fallback responses
// This script tests the new fallback response functionality

import { generateResponse } from './src/rag-service.js';

// Mock client config with new fallback responses
const mockClientConfig = {
  clientId: 'test-client',
  clientName: 'Test Client',
  prompts: {
    systemInstruction: 'You are a helpful assistant.',
    fallbackResponse: 'Default fallback response',
    fallbackResponseWithContact: 'Custom message when visitor has contact info - we will follow up.',
    fallbackResponseWithoutContact: 'Custom message asking for contact info.'
  }
};

// Mock empty search results (no matches)
const mockQueryResponse = { matches: [] };

// Test function
async function testFallbackResponses() {
  console.log('🧪 Testing Configurable Fallback Responses\n');

  // Test 1: Visitor with contact info
  console.log('Test 1: Visitor WITH contact info');
  console.log('Expected: Use fallbackResponseWithContact');

  const result1 = await generateResponse(
    'What is the price of apartment 123?',
    mockClientConfig,
    [0.1, 0.2, 0.3], // dummy embedding
    null, // external context
    null, // user context
    null, // chat history
    null, // page url
    false, // context shifted
    'visitor-with-contact' // visitor ID
  );

  console.log('Response:', result1.response);
  console.log('Is Unanswered:', result1.isUnanswered);
  console.log('');

  // Test 2: Visitor without contact info
  console.log('Test 2: Visitor WITHOUT contact info');
  console.log('Expected: Use fallbackResponseWithoutContact');

  const result2 = await generateResponse(
    'What is the price of apartment 456?',
    mockClientConfig,
    [0.1, 0.2, 0.3], // dummy embedding
    null, // external context
    null, // user context
    null, // chat history
    null, // page url
    false, // context shifted
    'visitor-without-contact' // visitor ID
  );

  console.log('Response:', result2.response);
  console.log('Is Unanswered:', result2.isUnanswered);
  console.log('');

  // Test 3: Client config without custom fallbacks (should use defaults)
  console.log('Test 3: Client config WITHOUT custom fallbacks');
  console.log('Expected: Use default hardcoded messages');

  const mockClientConfigNoCustom = {
    clientId: 'test-client-2',
    clientName: 'Test Client 2',
    prompts: {
      systemInstruction: 'You are a helpful assistant.',
      fallbackResponse: 'Default fallback response'
      // No custom fallbackResponseWithContact or fallbackResponseWithoutContact
    }
  };

  const result3 = await generateResponse(
    'What is the price of apartment 789?',
    mockClientConfigNoCustom,
    [0.1, 0.2, 0.3], // dummy embedding
    null, // external context
    null, // user context
    null, // chat history
    null, // page url
    false, // context shifted
    'visitor-no-custom-config' // visitor ID
  );

  console.log('Response:', result3.response);
  console.log('Is Unanswered:', result3.isUnanswered);
  console.log('');

  console.log('✅ All tests completed!');
}

// Run the test
testFallbackResponses().catch(console.error);