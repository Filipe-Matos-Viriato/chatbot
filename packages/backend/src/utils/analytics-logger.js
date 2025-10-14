/**
 * Analytics Logger for Intelligent Model Selection
 * Logs model selection decisions and performance metrics to chat_message_analytics table
 * Enhanced with client-specific capabilities and integration with AdvancedAnalyticsLogger
 */

import supabase from '../config/supabase.js';
import advancedAnalyticsLogger from './advanced-analytics-logger.js';

// Analytics Logger for Intelligent Model Selection
class AnalyticsLogger {
  constructor() {
    this.enabled = String(process.env.RAG_ANALYTICS_LOGGING_ENABLED || 'true') === 'true';
  }

  /**
   * Logs model selection analytics for a chat message
   * Enhanced with client-specific capabilities and AdvancedAnalyticsLogger integration
   * @param {Object} analyticsData - Analytics data to log
   */
  async logModelSelection(analyticsData) {
    if (!this.enabled) return;

    try {
      const {
        chatMessageId,
        clientId,
        modelSelected,
        queryComplexityScore,
        selectionConfidence,
        estimatedCost,
        actualCost,
        responseTimeMs,
        modelReasoning,
        fallbackUsed = false,
        // Enhanced fields for dashboard
        tokenUsage = {},
        contextQuality = 0,
        userIntent = '',
        responseQuality = 0,
        conversationContext = {}
      } = analyticsData;

      // Validate required fields
      if (!chatMessageId || !clientId || !modelSelected) {
        console.warn('[AnalyticsLogger] Missing required fields for analytics logging');
        return;
      }

      // Log to both legacy and advanced analytics systems
      const analyticsRecord = {
        chat_message_id: chatMessageId,
        client_id: clientId,
        model_selected: modelSelected,
        query_complexity_score: queryComplexityScore,
        selection_confidence: selectionConfidence,
        estimated_cost: estimatedCost,
        actual_cost: actualCost,
        response_time_ms: responseTimeMs,
        model_reasoning: modelReasoning,
        fallback_used: fallbackUsed,
        // Enhanced fields
        prompt_tokens: tokenUsage.promptTokens || 0,
        completion_tokens: tokenUsage.completionTokens || 0,
        total_tokens: tokenUsage.totalTokens || 0,
        context_quality_score: contextQuality,
        user_intent: userIntent,
        response_quality_score: responseQuality,
        conversation_turns: conversationContext.turns || 0,
        has_follow_up_questions: conversationContext.hasFollowUp || false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('chat_message_analytics')
        .insert(analyticsRecord);

      if (error) {
        console.error('[AnalyticsLogger] Failed to log analytics:', error);
      } else {
        console.log(`[AnalyticsLogger] ✅ Logged enhanced analytics for message ${chatMessageId}`);

        // Also log to advanced analytics system for real-time dashboard
        await advancedAnalyticsLogger.logModelSelection({
          ...analyticsData,
          tokenUsage,
          contextQuality,
          userIntent,
          responseQuality,
          conversationContext
        });
      }

    } catch (error) {
      console.error('[AnalyticsLogger] Error logging analytics:', error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  /**
   * Updates actual cost and response time for a completed request
   * @param {string} chatMessageId - Chat message ID
   * @param {number} actualCost - Actual cost incurred
   * @param {number} responseTimeMs - Response time in milliseconds
   */
  async updateActualMetrics(chatMessageId, actualCost, responseTimeMs) {
    if (!this.enabled || !chatMessageId) return;

    try {
      const { error } = await supabase
        .from('chat_message_analytics')
        .update({
          actual_cost: actualCost,
          response_time_ms: responseTimeMs
        })
        .eq('chat_message_id', chatMessageId);

      if (error) {
        console.error('[AnalyticsLogger] Failed to update actual metrics:', error);
      }
    } catch (error) {
      console.error('[AnalyticsLogger] Error updating actual metrics:', error);
    }
  }

  /**
   * Logs response generation metrics for a completed request
   * @param {Object} responseData - Response metrics to log
   */
  async logResponseMetrics(responseData) {
    if (!this.enabled) return;

    try {
      const {
        chatMessageId,
        clientId,
        responseTokens,
        responseTimeMs,
        actualTotalCost,
        isCompleteResponse,
        hasQuestions,
        queryScope,
        matchesFound,
        contextualMatchStatus
      } = responseData;

      // Validate required fields
      if (!chatMessageId || !clientId) {
        console.warn('[AnalyticsLogger] Missing required fields for response metrics logging');
        return;
      }

      const { data, error } = await supabase
        .from('chat_message_analytics')
        .insert({
          chat_message_id: chatMessageId,
          client_id: clientId,
          response_tokens: responseTokens,
          response_time_ms: responseTimeMs,
          actual_cost: actualTotalCost,
          is_complete_response: isCompleteResponse,
          has_questions: hasQuestions,
          query_scope: queryScope,
          matches_found: matchesFound,
          contextual_match_status: contextualMatchStatus,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('[AnalyticsLogger] Failed to log response metrics:', error);
      } else {
        console.log(`[AnalyticsLogger] ✅ Logged response metrics for message ${chatMessageId}`);
      }

    } catch (error) {
      console.error('[AnalyticsLogger] Error logging response metrics:', error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  /**
   * Calculates actual cost based on token usage and model
   * @param {string} modelName - Model name
   * @param {number} promptTokens - Input tokens used
   * @param {number} completionTokens - Output tokens used
   * @returns {number} Actual cost in USD
   */
  calculateActualCost(modelName, promptTokens, completionTokens) {
    // Import model configurations (you might want to centralize this)
    const models = {
      'gpt-4o-mini': { inputCost: 0.00000015, outputCost: 0.0000006 },
      'gpt-4.1': { inputCost: 0.00001, outputCost: 0.00003 },
      'gpt-3.5-turbo': { inputCost: 0.0000015, outputCost: 0.000002 }
    };

    const model = models[modelName];
    if (!model) return 0;

    const inputCost = promptTokens * model.inputCost;
    const outputCost = completionTokens * model.outputCost;

    return inputCost + outputCost;
  }
}

export default new AnalyticsLogger();