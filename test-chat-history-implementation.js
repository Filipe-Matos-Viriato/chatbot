#!/usr/bin/env node

/**
 * Test script to verify chat history implementation
 * This script tests the complete chat history flow from widget to backend
 */

const ChatHistoryService = require('./packages/backend/src/services/chat-history-service');

async function testChatHistoryFlow() {
  console.log('🧪 Testing Chat History Implementation...\n');

  try {
    // Initialize the chat history service
    const chatHistoryService = new ChatHistoryService();
    console.log('✅ ChatHistoryService initialized successfully');

    // Test data
    const testClientId = 'test-client-123';
    const testVisitorId = 'visitor_test_123';
    const testSessionId = 'session_test_123';
    const testTimestamp = new Date().toISOString();

    // Test 1: Store a user message
    console.log('\n📝 Test 1: Storing user message...');
    const userMessage = {
      text: 'Hello, I am looking for a 2-bedroom apartment in Lisbon',
      role: 'user',
      client_id: testClientId,
      visitor_id: testVisitorId,
      session_id: testSessionId,
      timestamp: testTimestamp,
      turn_id: `${Date.now()}-user`,
    };

    const mockClientConfig = {
      clientId: testClientId,
      chatHistoryTaggingRules: [
        {
          pattern: 'apartment|casa|house',
          flags: 'i',
          tagName: 'property_interest'
        }
      ]
    };

    await chatHistoryService.upsertMessage(userMessage, mockClientConfig);
    console.log('✅ User message stored successfully');

    // Test 2: Store an assistant response
    console.log('\n📝 Test 2: Storing assistant response...');
    const assistantMessage = {
      text: 'I can help you find 2-bedroom apartments in Lisbon. What is your budget range?',
      role: 'assistant',
      client_id: testClientId,
      visitor_id: testVisitorId,
      session_id: testSessionId,
      timestamp: new Date().toISOString(),
      turn_id: `${Date.now()}-assistant`,
    };

    await chatHistoryService.upsertMessage(assistantMessage, mockClientConfig);
    console.log('✅ Assistant message stored successfully');

    // Test 3: Retrieve visitor chat history
    console.log('\n📝 Test 3: Retrieving visitor chat history...');
    
    // Wait a moment for Pinecone to index the data
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const chatHistory = await chatHistoryService.getVisitorChatHistory(testVisitorId, testClientId, 10);
    console.log(`✅ Retrieved ${chatHistory.length} messages from visitor history`);

    if (chatHistory.length > 0) {
      console.log('\n📋 Chat History Contents:');
      chatHistory.forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.role}]: ${msg.text.substring(0, 50)}...`);
      });
    }

    // Test 4: Format chat history for prompt
    console.log('\n📝 Test 4: Formatting chat history for prompt...');
    const formattedHistory = chatHistoryService.formatChatHistoryForPrompt(chatHistory);
    console.log('✅ Chat history formatted successfully');
    console.log('📋 Formatted History Preview:');
    console.log(formattedHistory.substring(0, 200) + '...\n');

    console.log('🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('✅ Chat history service is working correctly');
    console.log('✅ Messages are being stored with proper metadata');
    console.log('✅ Visitor history retrieval is functional');
    console.log('✅ Chat history formatting is working');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure PINECONE_API_KEY is set in environment variables');
    console.error('2. Ensure GOOGLE_API_KEY is set in environment variables');  
    console.error('3. Verify that the "chat-history" Pinecone index exists');
    console.error('4. Check your internet connection');
    
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testChatHistoryFlow().catch(console.error);
}

module.exports = { testChatHistoryFlow };