const { generateResponse } = require('../src/rag-service');
const supabase = require('../src/config/supabase');

describe('Question Generation Integration', () => {
  let testVisitorId;
  let testClientId;

  beforeAll(async () => {
    // Setup test data
    testClientId = 'test-client-uuid';
    testVisitorId = 'test-visitor-id';

    // Create test visitor with specific lead score
    await supabase.from('visitors').insert({
      visitor_id: testVisitorId,
      client_id: testClientId,
      lead_score: 75,
      tipologia: 'T2',
      budget: 250000
    });

    // Create test events
    await supabase.from('events').insert([
      {
        visitor_id: testVisitorId,
        client_id: testClientId,
        event_type: 'property_inquiry',
        score_impact: 10
      },
      {
        visitor_id: testVisitorId,
        client_id: testClientId,
        event_type: 'pricing_inquiry',
        score_impact: 15
      }
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('events')
      .delete()
      .eq('visitor_id', testVisitorId);
    await supabase.from('visitors')
      .delete()
      .eq('visitor_id', testVisitorId);
  });

  it('should generate personalized questions for high-engagement user', async () => {
    const response = await generateResponse(
      "Quanto custa este apartamento?",
      mockClientConfig,
      mockEmbedding,
      { type: 'listing', value: 'test-listing-id' },
      null,
      null,
      null,
      false,
      testVisitorId
    );

    expect(response.suggestedQuestions).toHaveLength(3);
    expect(response.suggestedQuestions[0]).toContain('marcar');
  });

  it('should fallback to templates when LLM fails', async () => {
    // Mock LLM failure
    jest.spyOn(openai.chat.completions, 'create')
      .mockRejectedValueOnce(new Error('LLM timeout'));

    const response = await generateResponse(
      "Quanto custa este apartamento?",
      mockClientConfig,
      mockEmbedding,
      { type: 'listing', value: 'test-listing-id' },
      null,
      null,
      null,
      false,
      testVisitorId
    );

    expect(response.suggestedQuestions).toHaveLength(3);
    expect(response.suggestedQuestions).toBeTruthy();
  });
});