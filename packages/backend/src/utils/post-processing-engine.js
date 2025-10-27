// packages/backend/src/utils/post-processing-engine.js
// Post-processing engine for Portuguese language localization with context-aware term replacement
// To provide deterministic term replacement as safety net for LLM terminology consistency
// Relevant files: terminology-manager.js, rag-service.js
import terminologyManager from '../services/terminology-manager.js';

/**
 * PostProcessingEngine class for context-aware term replacement
 */
class PostProcessingEngine {
  constructor(terminologyConfig) {
    this.config = terminologyConfig;
    this.compiledPatterns = this.compilePatterns();
  }

  /**
   * Processes text with terminology replacement
   * @param {string} text - Input text
   * @param {string} context - Optional context for filtering
   * @param {string} visitorId - Optional visitor ID for analytics
   * @returns {Object} Processing result
   */
  processText(text, context = null, visitorId = null) {
    const startTime = Date.now();
    let processedText = text;
    const replacements = [];

    if (!this.config.enabled) {
      return {
        originalText: text,
        localizedText: text,
        termsReplaced: [],
        processingTimeMs: Date.now() - startTime
      };
    }

    // Apply term mappings in priority order
    for (const mapping of this.config.termMappings) {
      if (this.shouldApplyMapping(mapping, context)) {
        const result = this.applyMapping(processedText, mapping);
        if (result.applied) {
          processedText = result.text;
          replacements.push(result.replacement);

          // Log terminology usage for analytics
          if (visitorId) {
            terminologyManager.logTerminologyUsage(
              this.config.clientId,
              visitorId,
              result.replacement.originalTerm,
              result.replacement.replacedTerm,
              context
            ).catch(error => {
              console.error('[PostProcessingEngine] Error logging terminology usage:', error);
            });
          }
        }
      }
    }

    // Apply custom rules
    for (const rule of this.config.customRules) {
      processedText = this.applyCustomRule(processedText, rule);
    }

    return {
      originalText: text,
      localizedText: processedText,
      termsReplaced: replacements,
      processingTimeMs: Date.now() - startTime
    };
  }

  /**
   * Compiles regex patterns for performance
   * @returns {Map} Compiled patterns
   */
  compilePatterns() {
    const patterns = new Map();

    for (const mapping of this.config.termMappings) {
      const flags = mapping.caseSensitive === false ? 'gi' : 'g';
      let pattern = mapping.sourceTerm;

      if (mapping.wordBoundary) {
        pattern = `\\b${this.escapeRegex(mapping.sourceTerm)}\\b`;
      }

      patterns.set(mapping.sourceTerm, new RegExp(pattern, flags));
    }

    return patterns;
  }

  /**
   * Determines if a mapping should be applied based on context
   * @param {Object} mapping - Term mapping
   * @param {string} context - Context string
   * @returns {boolean} Whether to apply the mapping
   */
  shouldApplyMapping(mapping, context) {
    if (mapping.context && context) {
      return context.toLowerCase().includes(mapping.context.toLowerCase());
    }
    return true;
  }

  /**
   * Applies a single term mapping
   * @param {string} text - Input text
   * @param {Object} mapping - Term mapping
   * @returns {Object} Application result
   */
  applyMapping(text, mapping) {
    const pattern = this.compiledPatterns.get(mapping.sourceTerm);
    if (!pattern) {
      return { applied: false };
    }

    const matches = text.match(pattern);
    if (!matches) {
      return { applied: false };
    }

    const replacedText = text.replace(pattern, mapping.targetTerm);

    return {
      applied: true,
      text: replacedText,
      replacement: {
        originalTerm: mapping.sourceTerm,
        replacedTerm: mapping.targetTerm,
        occurrences: matches.length,
        context: mapping.context
      }
    };
  }

  /**
   * Applies a custom rule
   * @param {string} text - Input text
   * @param {Object} rule - Custom rule
   * @returns {string} Processed text
   */
  applyCustomRule(text, rule) {
    // Placeholder for custom rule implementation
    // Rules can be more complex transformations
    return text;
  }

  /**
   * Escapes special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Updates configuration and recompiles patterns
   * @param {Object} newConfig - New terminology configuration
   */
  updateConfig(newConfig) {
    this.config = newConfig;
    this.compiledPatterns = this.compilePatterns();
  }

  /**
   * Tests terminology replacement
   * @param {string} text - Test text
   * @param {string} context - Test context
   * @returns {Object} Test result
   */
  testReplacement(text, context = null) {
    return this.processText(text, context);
  }
}

export default PostProcessingEngine;
export { PostProcessingEngine };