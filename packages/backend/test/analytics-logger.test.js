// packages/backend/test/analytics-logger.test.js
// Unit tests for analytics logging functionality
// To verify that analytics data is properly captured and logged without affecting main application flow
// Relevant files: src/utils/analytics-logger.js, src/rag-service.js, config/supabase.js

const { expect } = require('chai');
const sinon = require('sinon');
const analyticsLogger = require('../src/utils/analytics-logger').default;
const supabase = require('../src/config/supabase');

describe('Analytics Logger', () => {
  let supabaseStub;

  beforeEach(() => {
    // Stub supabase operations
    supabaseStub = sinon.stub(supabase, 'from');
    const mockQuery = {
      insert: sinon.stub().resolves({ data: null, error: null }),
      update: sinon.stub().resolves({ data: null, error: null })
    };
    supabaseStub.returns(mockQuery);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('logModelSelection', () => {
    it('should log model selection data when enabled', async () => {
      analyticsLogger.enabled = true;

      const modelData = {
        chatMessageId: 'msg-123',
        clientId: 'client-abc',
        modelSelected: 'gpt-4o-mini',
        queryComplexityScore: 0.8,
        selectionConfidence: 0.9,
        estimatedCost: 0.002,
        modelReasoning: 'High complexity query',
        fallbackUsed: false
      };

      await analyticsLogger.logModelSelection(modelData);

      expect(supabaseStub.calledOnce).to.be.true;
      expect(supabaseStub.calledWith('chat_message_analytics')).to.be.true;

      const insertCall = supabaseStub().insert;
      expect(insertCall.calledOnce).to.be.true;

      const loggedData = insertCall.firstCall.args[0];
      expect(loggedData).to.have.property('chat_message_id', 'msg-123');
      expect(loggedData).to.have.property('client_id', 'client-abc');
      expect(loggedData).to.have.property('model_selected', 'gpt-4o-mini');
      expect(loggedData).to.have.property('query_complexity_score', 0.8);
      expect(loggedData).to.have.property('selection_confidence', 0.9);
      expect(loggedData).to.have.property('estimated_cost', 0.002);
      expect(loggedData).to.have.property('model_reasoning', 'High complexity query');
      expect(loggedData).to.have.property('fallback_used', false);
    });

    it('should not log when disabled', async () => {
      analyticsLogger.enabled = false;

      await analyticsLogger.logModelSelection({
        chatMessageId: 'msg-123',
        clientId: 'client-abc'
      });

      expect(supabaseStub.notCalled).to.be.true;
    });

    it('should handle database errors gracefully', async () => {
      analyticsLogger.enabled = true;

      // Mock database error
      supabaseStub.returns({
        insert: sinon.stub().resolves({ data: null, error: { message: 'DB error' } })
      });

      // Should not throw
      await expect(analyticsLogger.logModelSelection({
        chatMessageId: 'msg-123',
        clientId: 'client-abc'
      })).to.not.be.rejected;

      // Should still attempt to log
      expect(supabaseStub.calledOnce).to.be.true;
    });
  });

  describe('updateActualMetrics', () => {
    it('should update actual cost and response time', async () => {
      analyticsLogger.enabled = true;

      await analyticsLogger.updateActualMetrics('msg-123', 0.003, 1500);

      expect(supabaseStub.calledOnce).to.be.true;
      expect(supabaseStub.calledWith('chat_message_analytics')).to.be.true;

      const updateCall = supabaseStub().update;
      expect(updateCall.calledOnce).to.be.true;

      const updateData = updateCall.firstCall.args[0];
      expect(updateData).to.have.property('actual_cost', 0.003);
      expect(updateData).to.have.property('response_time_ms', 1500);

      const whereClause = updateCall.firstCall.args[1];
      expect(whereClause).to.have.property('chat_message_id', 'msg-123');
    });

    it('should not update when disabled', async () => {
      analyticsLogger.enabled = false;

      await analyticsLogger.updateActualMetrics('msg-123', 0.003, 1500);

      expect(supabaseStub.notCalled).to.be.true;
    });
  });

  describe('logResponseMetrics', () => {
    it('should log comprehensive response metrics', async () => {
      analyticsLogger.enabled = true;

      const responseData = {
        chatMessageId: 'msg-123',
        clientId: 'client-abc',
        responseTokens: 150,
        responseTimeMs: 1200,
        actualTotalCost: 0.004,
        isCompleteResponse: true,
        hasQuestions: true,
        queryScope: 'LISTING_SPECIFIC',
        matchesFound: 5,
        contextualMatchStatus: 'MATCH_IN_CONTEXT'
      };

      await analyticsLogger.logResponseMetrics(responseData);

      expect(supabaseStub.calledOnce).to.be.true;
      const insertCall = supabaseStub().insert;
      expect(insertCall.calledOnce).to.be.true;

      const loggedData = insertCall.firstCall.args[0];
      expect(loggedData).to.have.property('chat_message_id', 'msg-123');
      expect(loggedData).to.have.property('client_id', 'client-abc');
      expect(loggedData).to.have.property('response_tokens', 150);
      expect(loggedData).to.have.property('response_time_ms', 1200);
      expect(loggedData).to.have.property('actual_cost', 0.004);
      expect(loggedData).to.have.property('is_complete_response', true);
      expect(loggedData).to.have.property('has_questions', true);
      expect(loggedData).to.have.property('query_scope', 'LISTING_SPECIFIC');
      expect(loggedData).to.have.property('matches_found', 5);
      expect(loggedData).to.have.property('contextual_match_status', 'MATCH_IN_CONTEXT');
    });

    it('should skip logging when required fields are missing', async () => {
      analyticsLogger.enabled = true;

      // Missing chatMessageId
      await analyticsLogger.logResponseMetrics({
        clientId: 'client-abc'
      });

      expect(supabaseStub.notCalled).to.be.true;
    });

    it('should handle partial data gracefully', async () => {
      analyticsLogger.enabled = true;

      await analyticsLogger.logResponseMetrics({
        chatMessageId: 'msg-123',
        clientId: 'client-abc',
        // Missing optional fields
      });

      expect(supabaseStub.calledOnce).to.be.true;
      const loggedData = supabaseStub().insert.firstCall.args[0];
      expect(loggedData).to.have.property('chat_message_id', 'msg-123');
      expect(loggedData).to.have.property('client_id', 'client-abc');
      // Should handle undefined values appropriately
    });
  });

  describe('Error Handling', () => {
    it('should not throw errors that affect main application flow', async () => {
      analyticsLogger.enabled = true;

      // Mock supabase to throw
      supabaseStub.throws(new Error('Network error'));

      // Should not throw
      await expect(analyticsLogger.logModelSelection({
        chatMessageId: 'msg-123',
        clientId: 'client-abc'
      })).to.not.be.rejected;
    });

    it('should log errors internally for debugging', async () => {
      analyticsLogger.enabled = true;

      const consoleSpy = sinon.spy(console, 'error');
      supabaseStub.throws(new Error('Network error'));

      await analyticsLogger.logModelSelection({
        chatMessageId: 'msg-123',
        clientId: 'client-abc'
      });

      expect(consoleSpy.called).to.be.true;
      consoleSpy.restore();
    });
  });
});